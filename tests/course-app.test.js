'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const courses = require('../docs/course-context.js');
const engine = require('../docs/exam-dashboard-engine.js');
const app = fs.readFileSync(require.resolve('../docs/app.js'), 'utf8');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
function node() {
  return {innerHTML:'', textContent:'', value:'', disabled:false, hidden:false, handlers:{}, classList:{toggle(){}},
    addEventListener(type, handler) {this.handlers[type] = handler;}, focus(){}, scrollIntoView(){}};
}

function application(search = '?course=advanced-algorithms') {
  const registry = courses.createContext(search), selected = registry.current();
  const nodes = new Map(), events = [], data = new Map();
  const get = key => {if (!nodes.has(key)) nodes.set(key, node()); return nodes.get(key);};
  const window = {
    STUDY_CONFIG:{course:selected, plannerEnabled:!!selected?.planner, invalidCourse:!selected},
    StudyCourses:registry, StudyLessons:{flush:async()=>{events.push('flush');}}
  };
  const context = {
    window, StudyCourses:registry, currentCourse:selected,
    courseHasPlanner:()=>!!selected?.planner, courseSupports:page=>registry.supports(page),
    LABELS:{overview:'Overview','exam-map':'Map',reference:'References',lessons:'Lessons',schedule:'Schedule',questions:'Questions',flashcards:'Cards',readiness:'Records',library:'Sources'},
    ICONS:{}, esc:escape, page:'exam-map', curriculum:{sources:{},problems:[],topics:[],meta:{}}, schedule:{sessions:[]},
    state:{revision:0,settings:{},problemProgress:{},sessionUpdates:{},dayOverrides:{},journal:[]},
    main:get('#main'), $:get,
    document:{title:'',querySelector:get,querySelectorAll:()=>[]},
    location:{search,hash:'#exam-map',assign:url=>events.push({navigate:url})},
    sessionStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)},
    StudyTheme:{apply(){}}, saveQueue:Promise.resolve(), notify:message=>events.push({notice:message}),
    StudyCourseSetup:{render:page=>{events.push({setup:page});return '<p>Selected course</p>';},afterRender(){}},
    StudyLessons:{reader(){throw new Error('Random Algorithms lesson must not render');}},
    StudyExamProblems:{reader(){throw new Error('Random Algorithms problem must not render');}},
    StudyReference:{reader(){throw new Error('Random Algorithms glossary must not render');}}
  };
  vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf('function currentPage('),app.indexOf('function heading(')), context);
  return {context, nodes, get, events, data};
}

test('course switching awaits both lesson drafts and queued saves before navigating', async () => {
  const h = application('?course=random-algorithms'), flush = deferred(), saving = deferred();
  h.context.window.StudyLessons.flush = () => {h.events.push('flush');return flush.promise;};
  h.context.saveQueue = saving.promise;
  h.context.installCourseSelector();
  const select = h.get('#course-select');select.value = 'advanced-algorithms';
  const switchWork = select.handlers.change();
  assert.equal(select.disabled, true);
  await tick();assert.equal(h.events.some(event=>event.navigate), false);
  flush.resolve();await tick();assert.equal(h.events.some(event=>event.navigate), false);
  saving.resolve();await switchWork;
  const target = new URL(h.events.find(event=>event.navigate).navigate, 'https://example.test/Courses/');
  assert.equal(target.searchParams.get('course'), 'advanced-algorithms');
  assert.equal(target.searchParams.get('offering'), 'exam-prep');
  assert.equal(target.hash, '#exam-map');
});

test('failed draft flush, rejected save, and unresolved save feedback each prevent switching', async () => {
  for (const failure of ['draft','queue','feedback']) {
    const h = application('?course=random-algorithms');
    if (failure === 'draft') h.context.window.StudyLessons.flush = async()=>{throw new Error('Draft not saved');};
    if (failure === 'feedback') h.get('#save-status').textContent = 'Unsaved work';
    const saving = deferred();
    if (failure === 'queue') h.context.saveQueue = saving.promise;
    h.context.installCourseSelector();
    const select = h.get('#course-select');select.value = 'advanced-algorithms';
    const switchWork = select.handlers.change();
    if (failure === 'queue') {await tick();saving.reject(new Error('Save failed'));}
    await switchWork;
    assert.equal(h.events.some(event=>event.navigate), false, failure);
    assert.equal(select.disabled, false, failure);
    assert.equal(select.value, 'random-algorithms', failure);
    assert.ok(h.events.some(event=>event.notice), failure);
  }
});

test('switching resumes the target course route without overwriting its saved location', async () => {
  const h = application('?course=random-algorithms');
  const advanced = courses.resolve('?course=advanced-algorithms').course;
  h.context.location.hash = '#exam-problem/synthetic-question';h.context.page = 'exam-problem';
  const targetKey = h.context.courseLocationKey(advanced);h.data.set(targetKey, '#library');
  h.context.installCourseSelector();const select = h.get('#course-select');select.value = advanced.id;
  await select.handlers.change();
  assert.equal(new URL(h.events.find(event=>event.navigate).navigate,'https://example.test/').hash, '#library');
  assert.equal(h.data.get(targetKey), '#library');
  assert.equal(h.data.get(h.context.courseLocationKey(h.context.currentCourse)), '#exam-problem/synthetic-question');
});

test('unsupported Advanced Algorithms routes cannot call legacy course readers or save a false resume route', () => {
  for (const route of ['#lesson/synthetic/part','#exam-problem/synthetic','#reference/synthetic','#schedule','#flashcards']) {
    const h = application();h.context.location.hash = route;h.context.render();
    assert.equal(h.events.some(event=>event.setup), false, route);
    assert.match(h.get('#main').innerHTML, /href="#exam-map"/);
    assert.equal(h.data.size, 0, route);
    assert.doesNotMatch(h.get('#nav').innerHTML, /href="#(?:lessons|schedule|reference|flashcards)"/);
  }
  const h = application();h.context.location.hash = '';h.context.render();
  assert.equal(h.context.page, 'exam-map');
  assert.equal(h.events.find(event=>event.setup).setup, 'exam-map');
});

test('invalid course context shows recovery links without bootstrapping progress or fetching data', async () => {
  const h = application('?course=unknown');let bootstrap = 0;
  h.context.StudyStorage = {bootstrap:async()=>{bootstrap++;throw new Error('must not bootstrap');}};
  h.context.fetch = async()=>{throw new Error('must not fetch');};
  vm.runInContext(app.slice(app.indexOf('async function init('),app.lastIndexOf('\ninit();')),h.context);
  await h.context.init();
  assert.equal(bootstrap, 0);
  assert.match(h.get('#main').innerHTML, /course=advanced-algorithms/);
  assert.match(h.get('#main').innerHTML, /course=random-algorithms/);
  assert.equal(h.get('.exam-card').hidden, true);
});

function setupHarness(payload) {
  const registry = courses.createContext('?course=advanced-algorithms');
  const handlers = {}, nodes = new Map(), get = key => {if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);};
  const context = {
    window:{StudyCourses:registry}, StudyExamDashboardEngine:engine,
    sessionStorage:{getItem:()=>null,setItem(){}},
    document:{addEventListener:(type,handler)=>{handlers[type]=handler;},getElementById:get,querySelector:()=>null},
    fetch:async()=>({ok:true,json:async()=>payload}),
    state:{revision:0,settings:{},problemProgress:{},sessionUpdates:{},dayOverrides:{},journal:[]},
    curriculum:{sources:{}},Date,
    save:async mutate=>{const next=JSON.parse(JSON.stringify(context.state));mutate(next);context.state=next;}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../docs/course-setup-ui.js'),'utf8'),context);
  return {context,handlers,get,ui:context.window.StudyCourseSetup};
}
function backlog() {
  return {kind:'legacy-research-backlog',courseId:'advanced-algorithms',offeringId:'exam-prep',
    topics:[{id:'topic-a',label:'Synthetic topic'}],
    items:[{id:'legacy-1',legacyId:1,title:'Synthetic item',topic:'topic-a',contentStatus:'needs-review',lessonUrl:null}]};
}

test('opening and filtering archived research does not mark it learned; explicit marks can be reversed', async () => {
  const h = setupHarness(backlog()), before = JSON.stringify(h.context.state);
  await h.ui.load();h.ui.render('exam-map');
  h.handlers.input({target:{id:'course-search',value:'Synthetic'}});
  assert.equal(JSON.stringify(h.context.state), before);
  const checkbox={id:'',dataset:{courseLearned:'legacy-1'},checked:true,disabled:false};
  await h.handlers.change({target:checkbox});
  assert.equal(engine.getLearned(h.context.state,'legacy-1'),true);
  assert.equal(h.context.state.examPreparation.learned['legacy-1'].origin,'self-report');
  checkbox.checked=false;await h.handlers.change({target:checkbox});
  assert.equal(engine.getLearned(h.context.state,'legacy-1'),false);
  assert.deepEqual(h.context.state.problemProgress,{});
});

test('setup refuses foreign-course and malformed research before rendering imported markup', async () => {
  for (const mutate of [
    value=>{value.courseId='random-algorithms';},
    value=>{value.items[0].legacyId='<img src=x onerror=alert(1)>';},
    value=>{value.items[0].legacyId=2;},
    value=>{value.items.push({...value.items[0]});}
  ]) {
    const payload=backlog();mutate(payload);const h=setupHarness(payload);
    await assert.rejects(h.ui.load());
    assert.equal(h.context.state.examPreparation,undefined);
  }
  const payload=backlog();payload.items[0].title='<img src=x onerror=alert(1)>';
  const h=setupHarness(payload);await h.ui.load();const html=h.ui.render('exam-map');
  assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
});

test('failed explicit study save restores the checkbox and retains the previous state', async () => {
  const h=setupHarness(backlog());await h.ui.load();const before=JSON.stringify(h.context.state);
  h.context.save=async()=>{throw new Error('Storage full');};
  const checkbox={id:'',dataset:{courseLearned:'legacy-1'},checked:true,disabled:false};
  await h.handlers.change({target:checkbox});
  assert.equal(checkbox.checked,false);assert.equal(checkbox.disabled,false);
  assert.equal(JSON.stringify(h.context.state),before);
});

test('theme bootstrap restores scoped envelope and legacy flat preferences without changing learner data', () => {
  const code=fs.readFileSync(require.resolve('../docs/theme.js'),'utf8');
  const key='erdos:advanced-algorithms:exam-prep:progress:v1';
  for(const saved of [
    {formatVersion:1,state:{revision:7,settings:{theme:'light',themePalette:'clay'},problemProgress:{synthetic:{status:'read'}}},backups:[]},
    {revision:7,settings:{theme:'light',themePalette:'clay'},problemProgress:{synthetic:{status:'read'}}}
  ]) {
    const encoded=JSON.stringify(saved),data=new Map([[key,encoded]]),reads=[],handlers={},select={};
    const window={
      STUDY_CONFIG:{storageKey:key,invalidCourse:false},
      document:{documentElement:{dataset:{}},getElementById:()=>select,querySelector:()=>({})},
      localStorage:{getItem:name=>{reads.push(name);return data.get(name);},setItem:()=>assert.fail('Theme restore must not write progress')},
      addEventListener:(type,handler)=>{handlers[type]=handler;}
    };
    vm.runInNewContext(code,{window});
    assert.equal(select.value,'light-clay');
    assert.equal(window.document.documentElement.dataset.theme,'light');
    assert.deepEqual(reads,[key]);
    handlers.storage({key:'matzpen:22902:2026-s3:progress:v1'});
    assert.deepEqual(reads,[key]);
    handlers.storage({key});assert.deepEqual(reads,[key,key]);
    assert.equal(data.get(key),encoded);
  }
});

test('invalid-context theme bootstrap and storage events never read the legacy course key', () => {
  let access=0;const handlers={},select={};
  const window={
    STUDY_CONFIG:{invalidCourse:true,storageKey:'matzpen:22902:2026-s3:progress:v1'},
    document:{documentElement:{dataset:{}},getElementById:()=>select,querySelector:()=>({})},
    addEventListener:(type,handler)=>{handlers[type]=handler;}
  };
  Object.defineProperty(window,'localStorage',{get(){access++;throw new Error('Invalid course must not read saved progress');}});
  vm.runInNewContext(fs.readFileSync(require.resolve('../docs/theme.js'),'utf8'),{window});
  handlers.storage({key:window.STUDY_CONFIG.storageKey});
  assert.equal(access,0);assert.equal(select.value,'dark-ink');
});

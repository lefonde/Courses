'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=require('../docs/lesson-engine.js'),storage=require('../docs/storage.js'),{lessons}=require('../docs/lesson-content.js');
const clone=x=>JSON.parse(JSON.stringify(x)),first=lessons[0];
function memoryStorage(){const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem(k,v){values.set(k,v);}};}
test('lesson drafts round trip through export/import without changing learning or calendar records',async()=>{
 const state=storage.defaultState();state.sessionUpdates[first.sessionId]={status:'in-progress',note:'keep',learned:false};
 state.problemProgress['m12-q1']={status:'guided'};state.dayOverrides['2026-10-16']={note:'existing appointment'};
 const before=clone(state);engine.update(state,first,'practice',{draft:'E[T] = 1/2',hints:1});engine.update(state,first,'summary');
 assert.deepEqual(state.sessionUpdates,before.sessionUpdates);assert.deepEqual(state.problemProgress,before.problemProgress);assert.deepEqual(state.dayOverrides,before.dayOverrides);assert.equal(state.learning,undefined);
 const localStorage=memoryStorage(),env={localStorage},adapter=storage.createStorage(env,{mode:'static'});
 const saved=await adapter.save(state,0),backup=await adapter.exportState();
 const other=storage.createStorage({localStorage:memoryStorage()},{mode:'static'});await other.importState(backup,0);
 assert.deepEqual(await other.exportState(),saved);assert.equal(engine.section(saved,first,'practice').draft,'E[T] = 1/2');assert.equal(engine.session(saved,first).currentSection,'summary');
});
test('old scaffold reading location maps without discarding legacy history or inferring mastery',()=>{
 const state=storage.defaultState();state.settings.scaffoldTracks={version:1,sessions:{[first.sessionId]:{lessonId:'variance',currentStage:'completion',events:[]}}};
 const old=clone(state);assert.equal(engine.session(state,first).currentSection,'guided');assert.deepEqual(state,old);
 engine.update(state,first,'guided',{draft:'new attempt'});assert.deepEqual(state.settings.scaffoldTracks,old.settings.scaffoldTracks);assert.deepEqual(state.sessionUpdates,{});assert.equal(state.learning,undefined);storage.validateState(state);
});
test('help exposure is monotonic and malformed changes fail atomically',()=>{
 const state=storage.defaultState();engine.update(state,first,'guided',{draft:'a',hints:2,solution:true});engine.update(state,first,'guided',{draft:'b',hints:0,solution:false});
 assert.deepEqual(engine.section(state,first,'guided'),{draft:'b',hints:2,solution:true});
 for(const patch of [{hints:-1},{hints:1.5},{solution:'yes'},{draft:'x'.repeat(12001)},{learned:true}]){const before=clone(state);assert.throws(()=>engine.update(state,first,'guided',patch));assert.deepEqual(state,before);}
 const before=clone(state);assert.throws(()=>engine.update(state,{...first,version:2},'guided',{draft:'replacement'}));assert.deepEqual(state,before);
});
test('invalid imports, stale tabs and full storage leave the saved lesson draft recoverable',async()=>{
 const env={localStorage:memoryStorage()},adapter=storage.createStorage(env,{mode:'static'}),state=storage.defaultState();engine.update(state,first,'meaning',{draft:'recover me'});const saved=await adapter.save(state,0);
 const broken=clone(saved);broken.settings.lessonWorkspace.sessions[first.sessionId].updatedAt='yesterday';await assert.rejects(async()=>adapter.importState(broken,1));
 await assert.rejects(adapter.save(state,0),e=>e.status===409);assert.deepEqual(await adapter.exportState(),saved);
 env.localStorage.setItem=()=>{throw new Error('quota');};engine.update(state,first,'meaning',{draft:'unsaved'});await assert.rejects(adapter.save(state,1),e=>e.status===507);assert.deepEqual(await adapter.exportState(),saved);
});
function harness(){
 const events={},windowEvents={},elements=new Map(),timers=new Map();let timerId=0,fail=false,gate=null;
 const el=selector=>{if(!elements.has(selector))elements.set(selector,{textContent:'',hidden:true,classList:{toggle(){}},open:true});return elements.get(selector);};
 const context={StudyLessonContent:{lessons},StudyLessonEngine:engine,state:storage.defaultState(),location:{hash:'#lesson/'+first.sessionId+'/meaning'},crypto:require('node:crypto').webcrypto,console,clone,
 setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},$:el,matchMedia:()=>({matches:false}),addEventListener(type,fn){windowEvents[type]=fn;},document:{querySelectorAll:()=>[],addEventListener(type,fn){events[type]=fn;}},esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),downloadFile(name,body){context.download=JSON.parse(body);},notify(){}};
 context.window=context;context.save=async fn=>{if(gate)await gate;if(fail)throw new Error('disk full');const next=clone(context.state);fn(next);context.state=storage.validateState(next);};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../docs/lesson-ui.js'),'utf8'),context);
 return {context,events,el,fail(value){fail=value;},hold(p){gate=p;},visit(section){context.location.hash='#lesson/'+first.sessionId+'/'+section;context.StudyLessons.afterRender();},type(section,value){events.input({target:{id:'lesson-draft',dataset:{session:first.sessionId,section},value}});},flush:()=>context.StudyLessons.flush()};
}
test('rapid typing and A → B → A navigation save the latest draft and return position',async()=>{
 const h=harness();h.visit('meaning');h.type('meaning','first');h.visit('variance');h.visit('meaning');h.type('meaning','last');await h.flush();
 assert.equal(engine.session(h.context.state,first).currentSection,'meaning');assert.equal(engine.section(h.context.state,first,'meaning').draft,'last');assert.equal(h.el('#lesson-save-recovery').hidden,true);
});
test('edits arriving during a write are saved in a subsequent write',async()=>{
 const h=harness();let release;h.hold(new Promise(resolve=>release=resolve));h.type('meaning','older');const write=h.flush();h.type('meaning','newer');release();await write;
 assert.equal(engine.section(h.context.state,first,'meaning').draft,'newer');
});
test('failed UI saves retain the draft for recovery export and successful retry',async()=>{
 const h=harness();h.fail(true);h.type('meaning','keep after failure');await assert.rejects(h.flush());assert.equal(h.context.state.settings.lessonWorkspace,undefined);assert.equal(h.el('#lesson-save-recovery').hidden,false);
 await h.events.click({target:{closest:()=>({dataset:{lessonAction:'export'},disabled:false})}});assert.equal(engine.section(h.context.download,first,'meaning').draft,'keep after failure');
 h.fail(false);await h.flush();assert.equal(engine.section(h.context.state,first,'meaning').draft,'keep after failure');assert.equal(h.el('#lesson-save-recovery').hidden,true);
});
test('opening help records actual exposure without completing the lesson',async()=>{
 const h=harness();h.visit('guided');h.events.toggle({target:{dataset:{lessonHelp:'hint'},open:true,isConnected:true}});await h.flush();assert.equal(engine.section(h.context.state,first,'guided').hints,1);
 h.events.toggle({target:{dataset:{lessonHelp:'hint',hintCount:'2'},open:true,isConnected:true}});h.events.toggle({target:{dataset:{lessonHelp:'solution'},open:true,isConnected:true}});await h.flush();assert.deepEqual(engine.section(h.context.state,first,'guided'),{draft:'',hints:2,solution:true});assert.deepEqual(h.context.state.sessionUpdates,{});assert.deepEqual(h.context.state.problemProgress,{});
});
test('every host loads the lesson engine before persistence and the lesson UI before app rendering',()=>{
 for(const name of ['index.html','preview-learning.html']){const html=fs.readFileSync(require.resolve('../docs/'+name),'utf8');for(const file of ['lesson-content','lesson-engine','lesson-ui'])assert.ok(html.includes(file+'.js'));assert.ok(html.indexOf('lesson-engine.js')<html.indexOf('storage.js'));assert.ok(html.indexOf('lesson-ui.js')<html.indexOf('app.js'));}
});
test('recovery export merges drafts with the latest saved state after a stale-tab conflict',async()=>{
 const h=harness();const newest=storage.defaultState();newest.sessionUpdates['another-session']={note:'other tab work'};
 h.context.StudyStorage={exportState:async()=>clone(newest)};h.fail(true);h.type('meaning','local draft');await assert.rejects(h.flush());
 await h.events.click({target:{closest:()=>({dataset:{lessonAction:'export'}})}});
 assert.equal(h.context.download.sessionUpdates['another-session'].note,'other tab work');assert.equal(engine.section(h.context.download,first,'meaning').draft,'local draft');
});
test('the optional AI request includes the current question and tables, without the private answer',()=>{
 const h=harness();h.context.StudyTeachingPolicy={notebookContext:()=>'',policy:()=>''};h.context.StudyTeaching={mode:()=>''};
 h.type('meaning','PRIVATE ANSWER DRAFT');const text=h.context.StudyLessons.prompt(first.sessionId,'meaning');
 assert.ok(text.includes(sectionText(first,'meaning')));assert.match(text,/0 \| 1\/2/);assert.doesNotMatch(text,/PRIVATE ANSWER DRAFT/);
 function sectionText(lesson,id){return lesson.sections.find(s=>s.id===id).question.text;}
});
test('all lesson sections render with sources and separate help, while draft HTML stays inert',()=>{
 const h=harness(),schedule=require('../docs/data/schedule.json'),curriculum=require('../docs/data/curriculum.json');
 h.context.sessionOf=id=>schedule.sessions.find(s=>s.id===id);h.context.timeLabel=n=>n+' דקות';h.context.sourceLink=(id)=>{assert.ok(curriculum.sources[id]);return '<a>source</a>';};h.context.problemOf=id=>curriculum.problems.find(p=>p.id===id);
 h.type('meaning','<img src=x onerror=alert(1)>');
 for(const lesson of lessons)for(const section of lesson.sections){h.context.location.hash='#lesson/'+lesson.sessionId+'/'+section.id;const html=h.context.StudyLessons.reader();assert.ok(html.includes('id="lesson-section-title"'));assert.ok(html.includes(section.title));if(section.question){assert.ok(html.includes('data-lesson-help="solution"'));assert.ok(html.includes('id="lesson-draft"'));}assert.doesNotMatch(html,/<img src=x/);}
 h.context.location.hash='#lesson/'+first.sessionId+'/meaning';assert.match(h.context.StudyLessons.reader(),/&lt;img/);
 h.context.location.hash='#lesson/'+lessons[3].sessionId+'/coupons';assert.match(h.context.StudyLessons.reader(),/<sup>−m\/n<\/sup>/);
});

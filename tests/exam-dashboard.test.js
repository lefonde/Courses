'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../docs/exam-dashboard-engine.js');
const storage = require('../docs/storage.js');
const planning = require('../docs/planning-engine.js');
const at = '2026-10-23T18:00:00.000Z';
const copy = value => JSON.parse(JSON.stringify(value));
const rows = [
  {id:'low',title:'שיטה נוספת',theme:'graphs',themeLabel:'גרפים',score:10,rank:5,ordinal:5,band:'extension',tasks:[],techniques:[],lessonUrl:null,contentStatus:'planned'},
  {id:'tied-b',title:'שונות של סכום',theme:'bounds',themeLabel:'חסמי זנב',score:40,rank:2,ordinal:3,band:'medium',tasks:[],techniques:[],lessonUrl:'./problem.html',contentStatus:'planned'},
  {id:'first',title:'קירוב SAT',theme:'derandomization',themeLabel:'דה־רנדומיזציה',score:80,rank:1,ordinal:1,band:'high',tasks:['מרחב מדגם קטן'],techniques:['אי־תלות'],lessonUrl:null,contentStatus:'planned'},
  {id:'tied-a',title:'נקודות שבת',theme:'bounds',themeLabel:'חסמי זנב',score:40,rank:2,ordinal:2,band:'medium',tasks:[],techniques:[],lessonUrl:'./fixed-points.html',contentStatus:'ready'},
  {id:'middle',title:'גרף מקרי',theme:'graphs',themeLabel:'גרפים',score:25,rank:4,ordinal:4,band:'supplementary',tasks:[],techniques:[],lessonUrl:null,contentStatus:'ready'}
];
function oldState() {
  const state = storage.defaultState();
  state.sessionUpdates = {old:{status:'completed',learned:true,note:'Synthetic earlier lesson'}};
  state.problemProgress = {old:{status:'independent',independentConfirmed:true,evidence:'Synthetic independent solution checked'}};
  state.journal = [{date:'2026-10-16',text:'Synthetic prior journal'}];
  state.settings = {theme:'light',themePalette:'clay',baselineAssessment:{note:'Synthetic historical assessment'}};
  return state;
}
function memoryAdapter() {
  const values = new Map();
  let fail = false;
  const localStorage = {getItem:key=>values.get(key)??null,setItem(key,value){if(fail)throw new Error('Synthetic quota failure');values.set(key,value);}};
  return {adapter:storage.createStorage({localStorage},{mode:'static'}),values,setFailure(value){fail=value;}};
}

test('learned reports are explicit, reversible and do not touch legacy progress', () => {
  const state = oldState(), before = copy(state);
  assert.equal(engine.getLearned(state,'first'),false);
  assert.equal(Object.hasOwn(state,'examPreparation'),false);
  engine.setLearned(state,'first',true,at);
  assert.equal(engine.getLearned(state,'first'),true);
  assert.deepEqual(state.examPreparation.learned.first,{learned:true,updatedAt:at,origin:'self-report'});
  const legacy = copy(state);delete legacy.examPreparation;
  assert.deepEqual(legacy,before);
  engine.setLearned(state,'first',false,'2026-10-23T18:01:00Z');
  assert.equal(engine.getLearned(state,'first'),false);
  assert.equal(state.examPreparation.learned.first.updatedAt,'2026-10-23T18:01:00Z');
  assert.deepEqual(storage.validateState(state),state);
});

test('old exports without the optional namespace remain valid and do not infer marks', () => {
  const state = storage.validateState(oldState());
  assert.equal(Object.hasOwn(state,'examPreparation'),false);
  assert.equal(engine.summary(rows,state).learned,0);
  assert.equal(engine.getLearned(state,'old'),false);
});

test('valid unknown family identifiers survive saves and are not counted as known families', async () => {
  const {adapter} = memoryAdapter(),state=oldState();
  engine.setLearned(state,'future-family-999',true,at);
  const saved=await adapter.save(state,0),exported=await adapter.exportState();
  assert.deepEqual(exported,saved);
  assert.equal(engine.getLearned(exported,'future-family-999'),true);
  assert.equal(engine.summary(rows,exported).learned,0);
  engine.setLearned(exported,'first',true,at);
  assert.equal(engine.getLearned(exported,'future-family-999'),true);
});

test('new reports round trip with export/import while legacy records stay intact', async () => {
  const a=memoryAdapter(),b=memoryAdapter(),state=oldState();
  engine.setLearned(state,'first',true,at);
  engine.setLearned(state,'middle',false,at);
  await a.adapter.save(state,0);
  const exported=await a.adapter.exportState(),restored=await b.adapter.importState(exported,0);
  assert.deepEqual(restored.examPreparation,exported.examPreparation);
  for(const key of ['sessionUpdates','problemProgress','journal','settings'])assert.deepEqual(restored[key],state[key]);
  const unrelated=copy(restored);unrelated.settings.theme='dark';
  await b.adapter.save(unrelated,restored.revision);
  assert.deepEqual((await b.adapter.exportState()).examPreparation,exported.examPreparation);
  restored.examPreparation.learned.first.learned=false;
  assert.equal(engine.getLearned(await b.adapter.exportState(),'first'),true,'exported objects are not storage references');
});

test('malformed new namespaces reject import without replacing the saved state', async () => {
  const {adapter}=memoryAdapter();
  const state=await adapter.save(oldState(),0);
  const good={schemaVersion:1,learned:{first:{learned:true,updatedAt:at,origin:'self-report'}}};
  const cases=[null,[],{}, {...good,schemaVersion:2},{...good,other:true}, {...good,learned:[]},
    {schemaVersion:1,learned:{first:{learned:'true',updatedAt:at,origin:'self-report'}}},
    {schemaVersion:1,learned:{first:{learned:true,updatedAt:'2026-02-30T12:00:00Z',origin:'self-report'}}},
    {schemaVersion:1,learned:{first:{learned:true,updatedAt:at,origin:'inferred'}}},
    {schemaVersion:1,learned:{first:{learned:true,updatedAt:at,origin:'self-report',extra:1}}},
    {schemaVersion:1,learned:{constructor:{learned:true,updatedAt:at,origin:'self-report'}}}];
  for(const invalid of cases){
    await assert.rejects(adapter.importState({...copy(state),examPreparation:invalid},state.revision));
    assert.deepEqual(await adapter.exportState(),state);
  }
});

test('invalid reporting inputs leave the draft unchanged', () => {
  for(const [id,learned,date] of [['__proto__',true,at],['first','true',at],['first',true,'not a date']]){
    const state=oldState(),before=copy(state);
    assert.throws(()=>engine.setLearned(state,id,learned,date));assert.deepEqual(state,before);
  }
});

test('stale tab save cannot overwrite a newer learned report', async () => {
  const {adapter}=memoryAdapter(),first=oldState(),stale=oldState();
  engine.setLearned(first,'first',true,at);
  await adapter.save(first,0);
  engine.setLearned(stale,'tied-a',true,at);
  await assert.rejects(adapter.save(stale,0),error=>error.status===409&&error.code==='revision_conflict');
  const saved=await adapter.exportState();
  assert.equal(engine.getLearned(saved,'first'),true);assert.equal(engine.getLearned(saved,'tied-a'),false);
});

test('failed write retains the saved state and permits an explicit retry', async () => {
  const env=memoryAdapter(),state=oldState();engine.setLearned(state,'first',true,at);
  const saved=await env.adapter.save(state,0),draft=copy(saved);
  engine.setLearned(draft,'tied-a',true,at);env.setFailure(true);
  await assert.rejects(env.adapter.save(draft,saved.revision),error=>error.code==='save_failed');
  assert.deepEqual(await env.adapter.exportState(),saved);
  assert.equal(engine.getLearned(draft,'tied-a'),true,'the caller keeps its unsaved draft');
  env.setFailure(false);await env.adapter.save(draft,saved.revision);
  assert.equal(engine.getLearned(await env.adapter.exportState(),'tied-a'),true);
});

test('starting the legacy November plan preserves the new map and a recovery snapshot', () => {
  const state=oldState();engine.setLearned(state,'first',true,at);
  const fresh=planning.activateFresh(state,'2026-10-23T18:02:00Z');
  assert.deepEqual(fresh.examPreparation,state.examPreparation);
  assert.deepEqual(fresh.settings.planHistory[0].snapshot.examPreparation,state.examPreparation);
  assert.deepEqual(fresh.settings.planHistory[0].snapshot.problemProgress,state.problemProgress);
  engine.setLearned(fresh,'first',false,at);
  assert.equal(engine.getLearned(fresh.settings.planHistory[0].snapshot,'first'),true,'archive is not a shared reference');
  storage.validateState(fresh);
});

test('dashboard totals count only explicit reports and separate priority coverage from page availability', () => {
  const state=oldState();engine.setLearned(state,'first',true,at);engine.setLearned(state,'low',true,at);
  const totals=engine.summary(rows,state);
  assert.deepEqual({total:totals.total,learned:totals.learned,remaining:totals.remaining,percent:totals.percent},{total:5,learned:2,remaining:3,percent:40});
  assert.equal(totals.priorityTotal,3);assert.equal(totals.priorityLearned,1);assert.equal(totals.priorityPercent,33);
  assert.equal(totals.totalScore,195);assert.equal(totals.learnedScore,90);assert.equal(totals.weightedPercent,46);
  assert.equal(totals.readyCount,1,'a planned link or ready flag without a URL is not an available page');
  assert.deepEqual(totals.byBand.high,{total:1,learned:1,percent:100});
  assert.equal(engine.summary([],state).weightedPercent,0);
});

test('pagination always orders by score and stable ordinal while retaining equal-score ranks', () => {
  const state=oldState(),page1=engine.query(rows,state,{pageSize:2}),page2=engine.query(rows,state,{page:2,pageSize:2}),page3=engine.query(rows,state,{page:999,pageSize:2});
  assert.deepEqual(page1.items.map(r=>r.id),['first','tied-a']);
  assert.deepEqual(page2.items.map(r=>r.id),['tied-b','middle']);
  assert.deepEqual(page3.items.map(r=>r.id),['low']);
  assert.equal(page1.items[1].rank,page2.items[0].rank);
  assert.equal(page3.page,3);assert.equal(page3.from,5);assert.equal(page3.to,5);assert.equal(page3.hasNext,false);
  assert.deepEqual(rows.map(r=>r.id),['low','tied-b','first','tied-a','middle'],'sorting leaves catalogue order unchanged');
});

test('filters combine across theme, band, report status and Hebrew or Latin search', () => {
  const state=oldState();engine.setLearned(state,'tied-a',true,at);
  assert.deepEqual(engine.query(rows,state,{theme:'bounds',band:'medium',status:'remaining'}).items.map(r=>r.id),['tied-b']);
  assert.deepEqual(engine.query(rows,state,{status:'learned',search:'נְקוּדוֹת שַׁבָּת'}).items.map(r=>r.id),['tied-a']);
  assert.deepEqual(engine.query(rows,state,{search:'sat מדגם'}).items.map(r=>r.id),['first']);
  const empty=engine.query(rows,state,{search:'missing topic',page:10});
  assert.equal(empty.filteredCount,0);assert.equal(empty.page,1);assert.equal(empty.pageCount,0);assert.equal(empty.from,0);assert.equal(empty.to,0);
  assert.equal(empty.hasPrevious,false);assert.equal(empty.hasNext,false);
});

test('real catalogue remains a descending 129-family list with only the first three pages available', () => {
  const catalogue=require('../docs/data/exam-dashboard.json');
  assert.equal(catalogue.families.length,129);
  const state=storage.defaultState(),totals=engine.summary(catalogue.families,state),page=engine.query(catalogue.families,state,{pageSize:100});
  assert.equal(totals.learned,0);assert.equal(totals.priorityTotal,32);assert.equal(totals.readyCount,3);
  assert.deepEqual(catalogue.families.filter(f=>f.contentStatus==='ready').map(f=>f.id),catalogue.families.slice(0,3).map(f=>f.id));
  assert.equal(page.items[0].rank,1);assert.equal(page.items[0].score,80);
  assert.ok(page.items.every((row,index)=>index===0||page.items[index-1].score>=row.score));
  assert.equal(new Set(catalogue.families.map(row=>row.id)).size,129);
});

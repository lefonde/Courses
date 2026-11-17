'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../docs/storage.js');
const exam = require('../docs/exam-dashboard-engine.js');
const LEGACY_KEY = 'matzpen:22902:2026-s3:progress:v1';
const advanced = {id:'advanced-algorithms', offeringId:'exam-prep', storageKey:'erdos:advanced-algorithms:exam-prep:progress:v1', data:{curriculum:'./courses/advanced-algorithms/curriculum.json'}};
function harness(values = new Map(), course = advanced) {
  const urls = [];
  let failSave = false;
  const environment = {
    localStorage:{getItem:key => values.has(key) ? values.get(key) : null, setItem(key,value) {if (failSave) throw new Error('quota'); values.set(key,value);}},
    fetch:async url => {urls.push(url); return {ok:true,status:200,json:async()=>({sources:{},topics:[],problems:[]})};}
  };
  const adapter = storage.createStorage(environment, course ? {mode:'static',course,plannerEnabled:false} : {mode:'static'});
  return {adapter,values,urls,failSave:()=>{failSave=true;}};
}
test('second-course saves and imports leave legacy state and recovery bytes untouched', async () => {
  const legacy = storage.defaultState(); legacy.revision=8; legacy.settings.activeDate='2026-10-24';
  const bytes = JSON.stringify({formatVersion:1,state:legacy,backups:[{...legacy,revision:7}]},null,2);
  const h=harness(new Map([[LEGACY_KEY,bytes]]));
  let state=await h.adapter.exportState();
  assert.equal(state.courseId,advanced.id); assert.equal(state.offeringId,advanced.offeringId);
  exam.setLearned(state,'same-id',true,'2027-03-01T12:00:00Z');
  state=await h.adapter.save(state,0);
  const exported=await h.adapter.exportState();
  assert.equal(exported.examPreparation.learned['same-id'].learned,true);
  await h.adapter.importState(exported,state.revision);
  assert.equal(h.values.get(LEGACY_KEY),bytes);
  assert.equal((await h.adapter.backups()).length,1);
  const other=harness(); await other.adapter.importState(exported,0);
  assert.deepEqual((await other.adapter.exportState()).examPreparation,exported.examPreparation);
});
test('legacy adapter retains its existing export and source URL contracts', async () => {
  const h=harness(new Map(),null), state=storage.defaultState();
  assert.deepEqual(await h.adapter.exportState(),state);
  const saved=await h.adapter.importState(state,0);
  assert.deepEqual(await h.adapter.exportState(),saved);
  assert.equal(saved.courseId,undefined); assert.equal(h.adapter.storageKey,LEGACY_KEY);
  assert.equal(h.adapter.sourceUrl('Course Guide.pdf',5),'./source.html?file=Course%20Guide.pdf#page=5');
});
test('planner-free records use valid dates outside the old preparation calendar', async () => {
  const {adapter}=harness(), state=await adapter.exportState();
  state.settings.activeDate='2027-06-17';
  state.journal=[{date:'2027-06-17',text:'Synthetic study note'}];
  state.problemProgress['same-id']={status:'guided',date:'2027-06-17'};
  exam.setLearned(state,'same-id',true,'2027-06-17T12:00:00Z');
  const saved=await adapter.save(state,0);
  assert.equal(saved.settings.activeDate,'2027-06-17');
  assert.throws(()=>storage.validateState({...storage.defaultState(),settings:{activeDate:'2027-06-17'}}));
  await assert.rejects(adapter.importState({...saved,sessionUpdates:{session:{date:'2027-06-17'}}},saved.revision));
});
test('wrong-course, unscoped, unsupported, and corrupt imports cannot replace either course', async () => {
  const h=harness(), base=await h.adapter.exportState(), saved=await h.adapter.save(base,0);
  const bytes=h.values.get(advanced.storageKey);
  const badInputs=[storage.defaultState(), {...saved,courseId:'random-algorithms'}, {...saved,offeringId:'other'}, {...saved,schemaVersion:99}, {...saved,examPreparation:{schemaVersion:1,learned:{bad:{learned:true}}}}, {...saved,settings:{activePlanId:'november-2026'}}, {...saved,unknownData:{preserveMe:true}}, {...saved,settings:{activeDate:'2027-02-30'}}];
  for (const bad of badInputs) {
    await assert.rejects(h.adapter.importState(bad,saved.revision));
    assert.equal(h.values.get(advanced.storageKey),bytes);
  }
  const random=harness(h.values,null);
  await assert.rejects(random.adapter.importState(saved,0),error=>error.code==='wrong_course');
  assert.equal(h.values.has(LEGACY_KEY),false);
  assert.equal(h.values.get(advanced.storageKey),bytes);
});
test('stale saves, storage failure and corrupt stored records retain recovery data', async () => {
  const h=harness(), state=await h.adapter.save(await h.adapter.exportState(),0);
  const bytes=h.values.get(advanced.storageKey);
  await assert.rejects(h.adapter.save(state,0),error=>error.code==='revision_conflict');
  h.failSave(); await assert.rejects(h.adapter.save(state,state.revision),error=>error.code==='save_failed');
  assert.equal(h.values.get(advanced.storageKey),bytes);
  const corrupt='{invalid'; h.values.set(advanced.storageKey,corrupt);
  await assert.rejects(h.adapter.exportState(),error=>error.code==='stored_state_unreadable');
  assert.equal(h.values.get(advanced.storageKey),corrupt);
});
test('bootstrap fetches only selected course data and source URLs include its identity', async () => {
  const h=harness(), boot=await h.adapter.bootstrap();
  assert.deepEqual(h.urls,[advanced.data.curriculum]);
  assert.deepEqual(boot.schedule,{sessions:[]}); assert.deepEqual(boot.flashcards,{cards:[]});
  assert.equal(h.adapter.sourceUrl('aa-source-123.pdf',4),'./source.html?course=advanced-algorithms&offering=exam-prep&file=aa-source-123.pdf#page=4');
  assert.throws(()=>h.adapter.sourceUrl('../private.pdf'));
  assert.throws(()=>storage.createStorage({}, {course:{id:'advanced-algorithms',offeringId:'exam-prep'},mode:'static',plannerEnabled:false}));
});
test('invalid course selection cannot read, write, fetch or link legacy course data', async () => {
  const touched=[];
  const adapter=storage.createStorage({localStorage:{getItem:()=>touched.push('read'),setItem:()=>touched.push('write')},fetch:()=>touched.push('fetch')},{mode:'static',invalidCourse:true,plannerEnabled:false});
  await assert.rejects(adapter.bootstrap(),error=>error.code==='invalid_course');
  await assert.rejects(adapter.exportState(),error=>error.code==='invalid_course');
  await assert.rejects(adapter.save(storage.defaultState(),0),error=>error.code==='invalid_course');
  assert.throws(()=>adapter.sourceUrl('Course Guide.pdf'),error=>error.code==='invalid_course');
  assert.deepEqual(touched,[]);
});
test('the exported legacy validator and local transport reject other-course contexts', async () => {
  const state=await harness().adapter.exportState();
  assert.throws(()=>storage.validateState(state),error=>error.code==='wrong_course');
  for (const unexpected of [{courseId:'random-algorithms',offeringId:'other'}, {courseId:'random-algorithms'}, {offeringId:'2026-s3'}]) {
    assert.throws(()=>storage.validateState({...storage.defaultState(),...unexpected}),error=>error.code==='wrong_course');
  }
  const calls=[], local=storage.createStorage({fetch:async(...args)=>calls.push(args)},{mode:'local'});
  await assert.rejects(local.importState(state,0),error=>error.code==='wrong_course');
  assert.deepEqual(calls,[]);
});
test('queued saves capture their input and stale competing adapters cannot overwrite it', async () => {
  let release;
  const waiting=new Promise(resolve=>{release=resolve;}), values=new Map();
  const environment={localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},navigator:{locks:{request:async(_key,_options,action)=>{await waiting;return action();}}}};
  const first=storage.createStorage(environment,{mode:'static',course:advanced,plannerEnabled:false});
  const second=storage.createStorage(environment,{mode:'static',course:advanced,plannerEnabled:false});
  const a=await first.exportState(),b=await second.exportState();
  exam.setLearned(a,'same-id',true,'2027-01-01T12:00:00Z');
  exam.setLearned(b,'other-id',true,'2027-01-01T12:00:00Z');
  const saveA=first.save(a,0),saveB=second.save(b,0);
  a.examPreparation.learned['same-id'].learned=false;
  release();
  const results=await Promise.allSettled([saveA,saveB]);
  assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');
  assert.equal(results[1].reason.code,'revision_conflict');
  const current=await first.exportState();
  assert.equal(current.examPreparation.learned['same-id'].learned,true);
  assert.equal(current.examPreparation.learned['other-id'],undefined);
});
test('a saved envelope with forged course identity fails closed without touching either course',async()=>{
  const randomBytes=JSON.stringify({formatVersion:1,state:{...storage.defaultState(),revision:2},backups:[]});
  const h=harness(new Map([[LEGACY_KEY,randomBytes]]));
  const forged={...await h.adapter.exportState(),courseId:'random-algorithms'};
  const badBytes=JSON.stringify({formatVersion:1,state:forged,backups:[]});
  h.values.set(advanced.storageKey,badBytes);
  await assert.rejects(h.adapter.bootstrap(),error=>error.code==='stored_state_unreadable');
  assert.equal(h.values.get(advanced.storageKey),badBytes);assert.equal(h.values.get(LEGACY_KEY),randomBytes);
});

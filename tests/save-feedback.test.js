'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  const status = {textContent:''}, events = [];
  const context = {
    saveQueue:Promise.resolve(), state:{revision:1, draft:'original'},
    clone:value=>JSON.parse(JSON.stringify(value)), $:()=>status,
    StudyStorage:{save:async value=>({...value,revision:2})},
    window:{StudyShell:{closeMenu:()=>events.push('close-menu')}},
    notify:message=>events.push(message), render:()=>events.push('render')
  };
  const app = fs.readFileSync(require.resolve('../docs/app.js'),'utf8');
  vm.runInNewContext(app.slice(app.indexOf('function save('),app.indexOf('function currentPage(')),context);
  return {context,status,events};
}

test('successful background saves retain drafts without a persistent storage banner',async()=>{
  const {context,status,events}=harness();
  await context.save(state=>{state.draft='answer';},null,{background:true});
  assert.equal(context.state.draft,'answer');
  assert.equal(status.textContent,'');
  assert.deepEqual(events,[]);
});

test('a failed save remains visible through a pending retry and clears only on success',async()=>{
  const {context,status,events}=harness();
  context.StudyStorage.save=async()=>{throw new Error('Storage unavailable');};
  await assert.rejects(context.save(state=>{state.draft='unsaved';}),/Storage unavailable/);
  assert.equal(context.state.draft,'original');
  assert.match(status.textContent,/לא נשמר/);
  assert.equal(events[0],'close-menu');
  let resolve;
  context.StudyStorage.save=value=>new Promise(done=>{resolve=()=>done({...value,revision:2});});
  const retry=context.save(state=>{state.draft='retried';});
  await new Promise(done=>setImmediate(done));
  assert.match(status.textContent,/לא נשמר/);
  resolve();await retry;
  assert.equal(context.state.draft,'retried');
  assert.equal(status.textContent,'');
});

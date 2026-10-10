'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../docs/catch-up-engine.js'),storage=require('../docs/storage.js'),calendar=require('../docs/plan-calendar.js');
const publicSchedule=require('../docs/data/schedule.json'),recommendations=require('../docs/recommendation-engine.js');
const clone=x=>JSON.parse(JSON.stringify(x)),at='2026-10-10T08:00:00Z',from='2026-10-10';
const task=(id,date,minutes=90,dependsOn=[])=>({id,title:id,date,minutes,dependsOn,kind:'study',breakMinutes:5,reserveMinutes:0});
const fixture=(sessions,capacities=[180,180,180,180,180,180])=>({exam:{date:'2026-10-16'},days:capacities.map((capacityMinutes,i)=>({date:'2026-10-'+(10+i),capacityMinutes})),sessions});
function invariant(schedule,state,start=from){
 const all=engine.effective(schedule,state),scheduled=all.filter(s=>!s.disabled&&!s.unscheduled);
 for(const d of schedule.days.filter(d=>d.date>=start&&d.date<schedule.exam.date))assert.ok(scheduled.filter(s=>s.date===d.date).reduce((n,s)=>n+s.minutes,0)<=engine.capacity(schedule,state,d.date),`overloaded ${d.date}`);
 for(const s of scheduled.filter(s=>s.status!=='completed')){assert.ok(s.date>=start&&s.date<schedule.exam.date);for(const id of s.dependsOn||[]){const dep=all.find(x=>x.id===id);assert.ok(dep&&!dep.disabled);assert.ok(dep.status==='completed'||!dep.unscheduled&&dep.date<s.date,`prerequisite ${id} for ${s.id}`);}}
 storage.validateState(state);
}
test('October 10 regression produces an honest, valid partial calendar and retains every obligation',()=>{
 const state=storage.defaultState(),before=clone(state),p=engine.propose(publicSchedule,state,{from});
 assert.equal(p.summary.gapMinutes,360);assert.equal(p.summary.reserveAvailable,360);assert.deepEqual(p.errors,[]);assert.equal(p.placements.length,28);
 assert.throws(()=>engine.apply(publicSchedule,state,p,at),/לאשר במפורש/);
 const next=engine.apply(publicSchedule,state,p,at,true);invariant(publicSchedule,next);assert.deepEqual(state,before);
 assert.equal(engine.effective(publicSchedule,next).filter(s=>s.unscheduled).length,p.unplaced.length);
});
test('reserve is not extra capacity and cannot solve a shortage of long blocks',()=>{
 const s=storage.defaultState(),p=engine.propose(publicSchedule,s,{from,useReserve:true});
 assert.equal(p.summary.availableMinutes,3420);assert.equal(p.summary.gapMinutes,0);assert.equal(p.searchStatus,'block-length');assert.ok(p.unplaced.length);assert.deepEqual(p.errors,[]);
 const n=engine.apply(publicSchedule,s,p,at,true);invariant(publicSchedule,n);
 for(const x of engine.effective(publicSchedule,n).filter(x=>x.kind==='mock'))assert.equal(x.minutes,180);
 const again=engine.propose(publicSchedule,n,{from,useReserve:true});
 for(const c of again.placements)assert.ok(c.after.reserveUsedMinutes<=publicSchedule.sessions.find(s=>s.id===c.id).reserveMinutes);
});
test('suggested additional availability produces a complete independently valid public plan',()=>{
 const s=storage.defaultState(),suggestion=engine.suggestAvailability(publicSchedule,s,{from});
 assert.equal(suggestion.proposal.searchStatus,'complete');assert.deepEqual(suggestion.proposal.errors,[]);assert.ok(suggestion.addedDates.length);
 const next=engine.apply(publicSchedule,s,suggestion.proposal,at);invariant(publicSchedule,next);assert.equal(engine.effective(publicSchedule,next).filter(s=>s.unscheduled).length,0);
});
test('an already fitting plan is stable; no changes are applied',()=>{
 const s=storage.defaultState(),p=engine.propose(publicSchedule,s,{from:'2026-10-04'});
 assert.equal(p.searchStatus,'complete');assert.deepEqual(engine.changed(p),[]);assert.throws(()=>engine.apply(publicSchedule,s,p,'2026-10-04T06:00:00Z'),/אין שינוי/);
});
test('search can recover a feasible arrangement that earliest-first misses',()=>{
 const schedule=fixture([task('a',from),task('b','2026-10-11',90,['a']),task('c','2026-10-12',180)],[180,90,90]),s=storage.defaultState();
 const p=engine.propose(schedule,s,{from});assert.equal(p.searchStatus,'complete');assert.deepEqual(p.errors,[]);invariant(schedule,engine.apply(schedule,s,p,at));
 const bounded=engine.propose(schedule,s,{from},{nodes:1});assert.equal(bounded.searchStatus,'search-limit');assert.ok(bounded.unplaced.length);assert.deepEqual(bounded.errors,[]);
});
test('partial progress is explicit and does not infer mastery or erase notes and attempts',()=>{
 const schedule=fixture([task('a','2026-10-09',180)]),s=storage.defaultState();s.sessionUpdates.a={note:'resume proof',learned:false,actualMinutes:45};s.problemProgress.q={status:'guided'};s.journal=[{text:'keep me'}];
 const p=engine.propose(schedule,s,{from,progress:{a:{status:'in-progress',remainingMinutes:75}},useReserve:true});
 const n=engine.apply(schedule,s,p,at);assert.equal(n.sessionUpdates.a.minutes,75);assert.equal(n.sessionUpdates.a.learned,false);assert.equal(n.sessionUpdates.a.note,'resume proof');assert.equal(n.sessionUpdates.a.actualMinutes,45);assert.deepEqual(n.problemProgress,s.problemProgress);assert.deepEqual(n.journal,s.journal);invariant(schedule,n);
});
test('explicit completion satisfies dependencies, does not unlock mastery, and can be the only change',()=>{
 const schedule=fixture([task('a','2026-10-09'),task('b','2026-10-11',90,['a'])]),s=storage.defaultState();
 const p=engine.propose(schedule,s,{from,progress:{a:{status:'completed',remainingMinutes:null}}});assert.equal(p.searchStatus,'complete');
 const n=engine.apply(schedule,s,p,at);assert.equal(n.sessionUpdates.a.status,'completed');assert.equal(n.sessionUpdates.a.learned,undefined);invariant(schedule,n);
});
test('simulation minimum and allocated practice time cannot be shortened',()=>{
 const s=storage.defaultState(),mock=publicSchedule.sessions.find(s=>s.kind==='mock');
 assert.throws(()=>engine.propose(publicSchedule,s,{from,progress:{[mock.id]:{status:'in-progress',remainingMinutes:90}}}),/לפחות 180/);
 const schedule=fixture([{...task('a',from),budget:{retrieval:15}}]);s.settings.mixedPractice={rounds:[{budgetSessionId:'a'}]};
 assert.throws(()=>engine.propose(schedule,s,{from,progress:{a:{status:'in-progress',remainingMinutes:20}}}),/לפחות 30/);
});
test('locked simulations are respected and impossible locks require an explicit decision',()=>{
 const schedule=fixture([task('a',from),{...task('mock','2026-10-11',180,['a']),kind:'mock',breakMinutes:10,budget:{exam:150,initial_review:20}}]),s=storage.defaultState();
 const p=engine.propose(schedule,s,{from,lockedIds:['mock']});assert.equal(p.placements.find(p=>p.id==='mock').after.date,'2026-10-11');
 const blocked=engine.propose(schedule,s,{from,lockedIds:['mock'],capacities:{'2026-10-10':0}});assert.ok(blocked.errors.some(x=>x.includes('נעולה')));assert.throws(()=>engine.apply(schedule,s,blocked,at,true));
 const movable=engine.propose(schedule,s,{from,capacities:{'2026-10-10':0}});assert.equal(movable.searchStatus,'complete');assert.equal(movable.placements.find(p=>p.id==='mock').after.date,'2026-10-12');
});
test('deferral is dependency-closed and can be reversed by the next plan',()=>{
 const schedule=fixture([task('a',from),task('b','2026-10-11',90,['a']),task('c','2026-10-12')]),s=storage.defaultState();
 const p=engine.propose(schedule,s,{from,deferredIds:['a']});assert.deepEqual(p.unplaced.map(x=>x.id),['a','b']);
 const n=engine.apply(schedule,s,p,at,true);invariant(schedule,n);const again=engine.propose(schedule,n,{from});assert.equal(again.searchStatus,'complete');invariant(schedule,engine.apply(schedule,n,again,at));
});
test('cycles, missing prerequisites, duplicate IDs and invalid estimates never reach saving',()=>{
 const s=storage.defaultState();for(const schedule of [fixture([task('a',from,90,['b']),task('b','2026-10-11',90,['a'])]),fixture([task('a',from,90,['missing'])])]){const p=engine.propose(schedule,s,{from});assert.ok(p.errors.length);assert.throws(()=>engine.apply(schedule,s,p,at,true));}
 assert.throws(()=>engine.propose(fixture([task('a',from),task('a',from)]),s,{from}),/כפולים/);
 assert.throws(()=>engine.propose(fixture([task('a',from)]),s,{from,progress:{a:{status:'in-progress',remainingMinutes:0}}}));
});
test('independent validation rejects overloaded, incomplete, malformed, or reordered proposals',()=>{
 const schedule=fixture([task('a',from),task('b','2026-10-11',90,['a'])],[90,90,90]),s=storage.defaultState(),p=engine.propose(schedule,s,{from});
 for(const mutate of [p=>p.placements.pop(),p=>p.placements[1].after.date=from,p=>p.placements[0].after.minutes=1,p=>p.placements[0].after.start='24:99']){const bad=clone(p);mutate(bad);assert.ok(engine.validate(schedule,s,bad).length);assert.throws(()=>engine.apply(schedule,s,bad,at));}
});
test('stale progress, changed public data, and advancing past the start date block atomic application',()=>{
 const schedule=fixture([task('a','2026-10-09')]),s=storage.defaultState(),p=engine.propose(schedule,s,{from}),newer=clone(s);newer.revision++;assert.throws(()=>engine.apply(schedule,newer,p,at),/השתנו/);
 const changed=clone(s);changed.sessionUpdates.a={note:'new note'};assert.throws(()=>engine.apply(schedule,changed,p,at),/השתנו/);
 const changedPlan=clone(schedule);changedPlan.days[0].capacityMinutes=0;assert.throws(()=>engine.apply(changedPlan,s,p,at),/השתנו/);
 assert.throws(()=>engine.apply(schedule,s,p,'2026-10-11T08:00:00Z'),/חלף/);assert.deepEqual(s,storage.defaultState());
});
test('known time windows and fixed appointments are validated without overlapping',()=>{
 const schedule=fixture([{...task('a',from,60),start:'10:00'},task('b',from,60)]);schedule.days[0].windows=[{start:'10:00',end:'12:00'}];
 const s=storage.defaultState(),p=engine.propose(schedule,s,{from,lockedIds:['a']});assert.equal(p.placements[0].after.start,'10:00');assert.equal(p.placements[1].after.start,'11:00');assert.deepEqual(p.errors,[]);
 const bad=clone(p);bad.placements[1].after.start='10:30';assert.ok(engine.validate(schedule,s,bad).some(x=>x.includes('חופפת')));
});
test('undo restores future planning and availability while keeping subsequent learning notes',()=>{
 const schedule=fixture([task('a','2026-10-12')]),s=storage.defaultState(),p=engine.propose(schedule,s,{from,capacities:{'2026-10-12':0}}),n=engine.apply(schedule,s,p,at);
 n.sessionUpdates.a.note='learned later';n.sessionUpdates.a.learned=true;
 const reverted=engine.undo(schedule,n,n.settings.catchUpChanges[0].id,'2026-10-10T08:05:00Z');assert.equal(reverted.sessionUpdates.a.date,'2026-10-12');assert.equal(reverted.sessionUpdates.a.note,'learned later');assert.equal(reverted.sessionUpdates.a.learned,true);assert.equal(reverted.dayOverrides['2026-10-12'],undefined);invariant(schedule,reverted);
});
test('unsafe undo preserves the current state and explains how to recover',()=>{
 const schedule=fixture([task('a','2026-10-09')]),s=storage.defaultState(),n=engine.apply(schedule,s,engine.propose(schedule,s,{from}),at),before=clone(n);
 assert.throws(()=>engine.undo(schedule,n,n.settings.catchUpChanges[0].id,at),/כבר חלף/);assert.deepEqual(n,before);
 n.sessionUpdates.a.minutes=100;assert.throws(()=>engine.undo(schedule,n,n.settings.catchUpChanges[0].id,at),/נערכו/);
});
test('linked reviews move atomically and block unplaced hosts',()=>{
 const schedule=fixture([{...task('a','2026-10-09',90),kind:'practice',budget:{retrieval:10}}]),s=storage.defaultState();
 s.settings.questionReviews={version:1,entries:[{id:'r1',problemId:'m12-q2',target:'לשחזר את דרך הפתרון',createdAt:'2026-10-08T08:00:00Z',updatedAt:'2026-10-08T08:00:00Z',dueAt:'2026-10-09T08:00:00Z',sessionId:'a',status:'planned',outcome:null,help:null,note:'',history:[]}]};
 storage.validateState(s);const p=engine.propose(schedule,s,{from}),n=engine.apply(schedule,s,p,at);assert.equal(calendar.dayKey(n.settings.questionReviews.entries[0].dueAt),from);assert.equal(n.settings.questionReviews.entries[0].history.length,1);invariant(schedule,n);
 const bad=engine.propose(schedule,s,{from,deferredIds:['a']});assert.ok(bad.errors.some(x=>x.includes('חזרה מתוכננת')));assert.throws(()=>engine.apply(schedule,s,bad,at,true));
});
test('old backups remain valid; malformed new planning fields and logs are rejected',()=>{
 storage.validateState(storage.defaultState());const bad=storage.defaultState();bad.sessionUpdates.a={unscheduled:'yes'};assert.throws(()=>storage.validateState(bad));
 const schedule=fixture([task('a','2026-10-09')]),s=storage.defaultState(),n=engine.apply(schedule,s,engine.propose(schedule,s,{from}),at);
 storage.validateState(JSON.parse(JSON.stringify(n)));n.settings.catchUpChanges[0].changes[0].after.reserveUsedMinutes=-1;assert.throws(()=>storage.validateState(n));
});
test('recommendations never call an unscheduled backlog completed',()=>{
 const schedule=fixture([task('a',from)]),s=storage.defaultState();s.sessionUpdates.a={unscheduled:true};
 const result=recommendations.propose({curriculum:{problems:[]},schedule,state:s,now:at,availableMinutes:90});assert.equal(result.kind,'no-fit');assert.match(result.title,/ללא שיבוץ/);
});
test('Israel DST day keys are respected when moving date-only reviews',()=>{
 assert.equal(calendar.dayKey(calendar.localStamp('2026-10-25','00:00')),'2026-10-25');
 const schedule=fixture([task('a','2026-10-09')]),s=storage.defaultState(),p=engine.propose(schedule,s,{from});assert.throws(()=>engine.apply(schedule,s,p,'2026-10-10T22:30:00Z'),/חלף/);
});
test('preserve valid preferred start times and reject already elapsed appointments at save',()=>{
 const schedule=fixture([{...task('a',from,60),start:'08:00'}]),s=storage.defaultState(),p=engine.propose(schedule,s,{from,lockedIds:['a']});
 assert.equal(p.placements[0].after.start,'08:00');assert.throws(()=>engine.apply(schedule,s,p,at),/שעת התחלה/);
 const preferred=engine.propose(schedule,s,{from});assert.equal(preferred.placements[0].after.start,'08:00');
});
test('total availability edits do not double-count optional time or drop confirmed conditional work',()=>{
 const schedule=fixture([{...task('a',from),conditional:true}]);schedule.days[0].optionalMinutes=60;schedule.days[0].confirmedOptional=true;
 const s=storage.defaultState(),p=engine.propose(schedule,s,{from,capacities:{[from]:120}});
 assert.equal(p.placements.length,1);assert.equal(p.searchStatus,'complete');const n=engine.apply(schedule,s,p,at);assert.equal(engine.capacity(schedule,n,from),120);invariant(schedule,n);
});
test('bounded solver agrees with exhaustive feasibility on small independent fixtures',()=>{
 let seed=7;const random=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
 for(let run=0;run<100;run++){
  const caps=Array.from({length:4},()=>random(4)*30),tasks=Array.from({length:4},(_,i)=>task('t'+i,'2026-10-'+(10+random(4)),30*(1+random(3)),i&&random(2)?['t'+random(i)]:[]));
  const schedule=fixture(tasks,caps),s=storage.defaultState(),placed={},used=[0,0,0,0];
  function brute(i){if(i===tasks.length)return true;const task=tasks[i];for(let d=0;d<4;d++)if(used[d]+task.minutes<=caps[d]&&task.dependsOn.every(id=>placed[id]<d)){placed[task.id]=d;used[d]+=task.minutes;if(brute(i+1))return true;used[d]-=task.minutes;delete placed[task.id];}return false;}
  assert.equal(engine.propose(schedule,s,{from}).searchStatus==='complete',brute(0),'fixture '+run);
 }
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=require('../docs/lesson-engine.js'),storage=require('../docs/storage.js'),{lessons}=require('../docs/lesson-content.js');
const schedule=require('../docs/data/schedule.json'),curriculum=require('../docs/data/curriculum.json');
const clone=value=>JSON.parse(JSON.stringify(value));

// Public identity snapshot from f8afda91c446ee985e2ab2a1a2ce8abeb6e224bd.
// This deliberately does not derive old-state identifiers from the revised lessons.
// Mathematical equivalence and the archived old prompts receive a separate editorial audit.
const originalLessons=[
  {sessionId:'nov26-2026-10-05',version:1,ids:['meaning','variance','sums','guided','practice','summary'],minutes:[15,15,15,15,15,5],official:{},bookmark:'guided'},
  {sessionId:'nov26-2026-10-07',version:1,ids:['tools','one-bin','all-bins','assignment','summary'],minutes:[15,10,5,40,10],official:{assignment:['m12-q2']},bookmark:'assignment'},
  {sessionId:'nov26-2026-10-09',version:1,ids:['recall','joint','bounds','assignment','summary'],minutes:[15,15,10,80,15],official:{assignment:['m12-q1']},bookmark:'bounds'},
  {sessionId:'nov26-2026-10-10',version:1,ids:['events','coupons','runs','assignment-coupons','assignment-runs','summary'],minutes:[15,15,10,40,40,15],official:{'assignment-coupons':['m11-q1'],'assignment-runs':['m11-q2']},bookmark:'coupons'}
].map(lesson=>({...lesson,sections:lesson.ids.map(id=>({id}))}));

function syntheticOldState(){
  const state=storage.defaultState(),at='2026-10-16T12:00:00.000Z';
  state.sessionUpdates={
    'nov26-2026-10-05':{status:'completed',learned:true,learnedAt:at,note:'Synthetic completed-session note',actualMinutes:82},
    'nov26-2026-10-07':{status:'in-progress',learned:false,note:'Synthetic partial-session note',remainingMinutes:35,date:'2026-10-21',start:'18:00',planningLocked:true},
    'unrelated-session':{status:'completed',learned:true,note:'Synthetic unrelated history'}
  };
  state.problemProgress={
    'm12-q1':{status:'guided',evidence:'Synthetic assisted proof attempt',independentConfirmed:false,obstacle:'model'},
    'm12-q2':{status:'independent',evidence:'Synthetic checked without help',independentConfirmed:true,minutes:30}
  };
  state.dayOverrides={'2026-10-21':{capacityMinutes:150,notes:'Synthetic availability',confirmedOptional:true}};
  state.journal=[{date:'2026-10-16',title:'Synthetic journal',text:'Preserve this text verbatim.'}];
  state.settings={activePlanId:'november-2026',activeDate:'2026-10-16',theme:'dark',themePalette:'clay',
    scaffoldTracks:{version:1,sessions:{'nov26-2026-10-05':{lessonId:'variance',currentStage:'completion',events:[{id:'synthetic-scaffold',stageId:'completion',at,action:'hint',nextStageId:'completion',help:'hint',result:'not-checked',note:'Synthetic earlier help'}]}}},
    flashcards:{dailyLimit:4,progress:{'synthetic-card':{stage:1,streak:1,lapses:0,reviews:1,firstReviewedAt:at,lastReviewedAt:at,dueAt:'2026-10-20T12:00:00.000Z',lastRating:'good',history:[{at,rating:'good'}]}}},
    customSessions:[{id:'synthetic-extra',title:'Synthetic extra practice',date:'2026-10-22',minutes:30,kind:'practice'}],
    questionReviews:{version:1,entries:[{id:'synthetic-review',problemId:'m12-q1',target:'Synthetic proof checkpoint',createdAt:at,dueAt:'2026-10-21T16:00:00.000Z',sessionId:'nov26-2026-10-21',status:'planned',outcome:null,help:null,note:'',updatedAt:at,history:[]}]},
    planChanges:[{id:'synthetic-plan-change',at,status:'applied',changes:[{id:'nov26-2026-10-07',before:{date:'2026-10-07',start:null,minutes:90},after:{date:'2026-10-21',start:'18:00',minutes:90},reason:'Synthetic existing reschedule'}],reviewChanges:[]}]
  };
  const event={id:'synthetic-attempt',sessionId:'nov26-2026-10-09',problemId:'m12-q1',at,disposition:'continue',outcome:'partial',help:'unknown',obstacle:'method',continuation:'Synthetic unresolved step',note:'Prior exposure is unknown, not none.',evidence:'Synthetic prior attempt',minutes:25,independentConfirmed:false};
  state.learning={version:1,attempts:[event],checkpoints:{[event.sessionId]:{attemptId:event.id,at,continuation:event.continuation,disposition:event.disposition}}};
  for(const [index,old] of originalLessons.entries()){
    for(const [sectionIndex,id] of old.ids.entries())engine.update(state,old,id,{draft:`Synthetic old draft ${old.sessionId}/${id}: <keep exact>`,hints:sectionIndex%2,solution:sectionIndex===2});
    engine.update(state,old,old.bookmark);
    state.settings.lessonWorkspace.sessions[old.sessionId].updatedAt=at;
  }
  return storage.validateState(state);
}
function memoryStorage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem(key,value){values.set(key,value);}};}
function protectedRecords(state){const copy=clone(state);delete copy.revision;delete copy.settings.lessonWorkspace;return copy;}
function withoutRevision(state){const copy=clone(state);delete copy.revision;return copy;}

async function harness(){
  const localStorage=memoryStorage(),adapter=storage.createStorage({localStorage},{mode:'static'}),events={},elements=new Map();
  const el=selector=>{if(!elements.has(selector))elements.set(selector,{textContent:'',hidden:true,classList:{toggle(){}},open:true});return elements.get(selector);};
  const context={StudyLessonContent:{lessons},StudyLessonEngine:engine,state:await adapter.save(syntheticOldState(),0),location:{hash:''},crypto:require('node:crypto').webcrypto,console,clone,
    setTimeout:()=>1,clearTimeout(){},$:el,matchMedia:()=>({matches:false}),addEventListener(){},
    document:{querySelectorAll:()=>[],addEventListener(type,fn){events[type]=fn;}},
    esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    sessionOf:id=>schedule.sessions.find(s=>s.id===id),problemOf:id=>curriculum.problems.find(p=>p.id===id),timeLabel:value=>value+' minutes',sourceLink:()=>'<a>source</a>',
    notify(){},downloadFile(name,body){context.download=JSON.parse(body);}
  };
  context.window=context;context.StudyStorage=adapter;
  context.save=async mutate=>{const next=clone(context.state);mutate(next);context.state=await adapter.save(next,context.state.revision);};
  vm.createContext(context);
  const priorFile=require('node:path').join(__dirname,'../docs/lesson-previous-content.js');
  if(fs.existsSync(priorFile))vm.runInContext(fs.readFileSync(priorFile,'utf8'),context);
  vm.runInContext(fs.readFileSync(require.resolve('../docs/lesson-ui.js'),'utf8'),context);
  return {context,adapter,localStorage,events,
    show(lesson,section){context.location.hash='#lesson/'+lesson.sessionId+(section?'/'+section:'');return context.StudyLessons.reader();},
    visit(lesson,section){this.show(lesson,section);context.StudyLessons.afterRender();},
    type(lesson,section,value){events.input({target:{id:'lesson-draft',dataset:{session:lesson.sessionId,section},value}});},
    reveal(type,hintCount){events.toggle({target:{dataset:{lessonHelp:type,...(hintCount?{hintCount:String(hintCount)}:{})},open:true,isConnected:true}});},
    flush:()=>context.StudyLessons.flush()
  };
}

test('week-one revision preserves the original routes, content version, official problems and section time allocations',()=>{
  assert.deepEqual(lessons.map(l=>l.sessionId),originalLessons.map(l=>l.sessionId));
  for(const [index,old] of originalLessons.entries()){
    const lesson=lessons[index];
    assert.equal(lesson.version,old.version,old.sessionId);
    assert.deepEqual(lesson.sections.map(s=>s.id),old.ids,old.sessionId);
    assert.deepEqual(lesson.sections.map(s=>s.minutes),old.minutes,old.sessionId);
    assert.deepEqual(Object.fromEntries(lesson.sections.filter(s=>s.official?.length).map(s=>[s.id,s.official])),old.official,old.sessionId);
  }
  assert.deepEqual(lessons[0].legacyStages,{background:'meaning',example:'sums',completion:'guided',independent:'practice',wrapup:'summary'});
});

test('all baseline bookmarks and nonempty drafts read and render unchanged under revised content',async()=>{
  const h=await harness(),before=clone(h.context.state);
  for(const [index,lesson] of lessons.entries()){
    assert.deepEqual(engine.session(h.context.state,lesson),engine.session(before,originalLessons[index]));
    for(const section of lesson.sections){
      const html=h.show(lesson,section.id);
      assert.ok(html.includes(section.title),lesson.sessionId+'/'+section.id);
      assert.deepEqual(engine.section(h.context.state,lesson,section.id),engine.section(before,originalLessons[index],section.id));
      if(section.question)assert.ok(html.includes(`Synthetic old draft ${lesson.sessionId}/${section.id}: &lt;keep exact>`));
    }
    // The bare lesson address resumes the old bookmark; rerendering it queues no write.
    const html=h.show(lesson);
    assert.ok(html.includes(lesson.sections.find(s=>s.id===originalLessons[index].bookmark).title));
    h.context.StudyLessons.afterRender();await h.flush();
  }
  assert.deepEqual(h.context.state,before);
  assert.deepEqual(await h.adapter.exportState(),before);
});

test('editing and navigating revised lessons preserves other drafts, past help, learning and calendar records through reload and import',async()=>{
  const h=await harness(),before=clone(h.context.state);
  for(const [index,lesson] of lessons.entries()){
    const id=originalLessons[index].bookmark;
    h.visit(lesson,id);h.type(lesson,id,'Synthetic continued draft '+index);await h.flush();
    h.visit(lesson,'summary');await h.flush();
  }
  const updated=h.context.state;
  assert.deepEqual(protectedRecords(updated),protectedRecords(before));
  for(const [index,lesson] of lessons.entries()){
    const old=originalLessons[index],saved=engine.session(updated,lesson);
    assert.equal(saved.currentSection,'summary');
    for(const id of old.ids){
      const expected=engine.section(before,old,id);
      if(id===old.bookmark)expected.draft='Synthetic continued draft '+index;
      assert.deepEqual(saved.sections[id],expected,lesson.sessionId+'/'+id);
    }
  }
  const reloaded=storage.createStorage({localStorage:h.localStorage},{mode:'static'});
  const exported=await reloaded.exportState();assert.deepEqual(exported,updated);
  const importedAdapter=storage.createStorage({localStorage:memoryStorage()},{mode:'static'});
  const imported=await importedAdapter.importState(exported,0);
  assert.deepEqual(withoutRevision(imported),withoutRevision(updated));
  assert.deepEqual(await importedAdapter.exportState(),imported);
});

test('newly revealed help is monotonic and cannot turn unknown prior exposure into independent credit',async()=>{
  const h=await harness(),before=clone(h.context.state),lesson=lessons[0];
  h.visit(lesson,'guided');h.reveal('hint',2);h.reveal('solution');await h.flush();
  h.type(lesson,'guided','Synthetic later correction');h.reveal('hint',1);await h.flush();
  assert.deepEqual(engine.section(h.context.state,lesson,'guided'),{draft:'Synthetic later correction',hints:2,solution:true});
  assert.deepEqual(protectedRecords(h.context.state),protectedRecords(before));
  assert.equal(h.context.state.learning.attempts[0].help,'unknown');
  assert.equal(h.context.state.learning.attempts[0].independentConfirmed,false);
  // Closing or rendering a disclosure never erases recorded help.
  h.events.toggle({target:{dataset:{lessonHelp:'solution'},open:false,isConnected:true}});
  h.show(lesson,'guided');await h.flush();
  assert.equal(engine.section(h.context.state,lesson,'guided').solution,true);
});

test('original question context remains available with existing drafts and is a deliberate tracked disclosure',async()=>{
  const h=await harness(),before=clone(h.context.state),archive=h.context.StudyPreviousLessonContent;
  // Canonical public body+question snapshot, independently extracted with git show
  // from f8afda91c446ee985e2ab2a1a2ce8abeb6e224bd before the revisions.
  assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(archive)).digest('hex'),'a7c99a2480cc2606a3a3c00e79e06014933c8c95c84193ecfc76bfa59da66fe3');
  let retained=0;
  for(const lesson of lessons)for(const section of lesson.sections){
    const old=archive[lesson.sessionId]?.[section.id];if(!old)continue;
    retained++;
    const html=h.show(lesson,section.id);
    assert.match(html,/<details class="lesson-details lesson-previous" data-lesson-help="solution">/);
    assert.ok(html.includes(h.context.esc(old.question)),lesson.sessionId+'/'+section.id);
  }
  assert.equal(retained,17);
  assert.deepEqual(h.context.state,before);
  const lesson=lessons[0];h.visit(lesson,'guided');h.reveal('solution');await h.flush();
  assert.equal(engine.section(h.context.state,lesson,'guided').solution,true);
  assert.deepEqual(protectedRecords(h.context.state),protectedRecords(before));
  for(const name of ['index.html','preview-learning.html']){
    const html=fs.readFileSync(require.resolve('../docs/'+name),'utf8');
    assert.ok(html.indexOf('lesson-previous-content.js')>=0);
    assert.ok(html.indexOf('lesson-previous-content.js')<html.indexOf('lesson-ui.js'));
  }
});

test('the optional general worked example records assistance without erasing the pre-update draft or awarding credit',async()=>{
  const h=await harness(),before=clone(h.context.state),lesson=lessons[2];
  const html=h.show(lesson,'joint');
  assert.match(html,/<details class="lesson-details lesson-worked-example" data-lesson-help="solution">/);
  assert.deepEqual(h.context.state,before);
  h.reveal('solution');await h.flush();
  const original=engine.section(before,originalLessons[2],'joint');
  assert.deepEqual(engine.section(h.context.state,lesson,'joint'),{...original,solution:true});
  assert.deepEqual(protectedRecords(h.context.state),protectedRecords(before));
});

test('invalid imports, stale writes and full storage cannot replace the complete pre-update progress',async()=>{
  const localStorage=memoryStorage(),adapter=storage.createStorage({localStorage},{mode:'static'});
  const saved=await adapter.save(syntheticOldState(),0),next=clone(saved);
  engine.update(next,lessons[0],'guided',{draft:'Synthetic unsaved replacement'});
  await assert.rejects(adapter.save(next,0),error=>error.status===409);
  const corrupt=clone(saved);corrupt.settings.lessonWorkspace.sessions[lessons[0].sessionId].sections.guided.draft=null;
  await assert.rejects(adapter.importState(corrupt,saved.revision));
  assert.deepEqual(await adapter.exportState(),saved);
  localStorage.setItem=()=>{throw new Error('synthetic quota failure');};
  await assert.rejects(adapter.save(next,saved.revision),error=>error.status===507);
  assert.deepEqual(await adapter.exportState(),saved);
});

test('legacy scaffold reading positions remain readable and are never reclassified as learning',()=>{
  for(const [stage,id] of Object.entries(lessons[0].legacyStages)){
    const state=syntheticOldState();delete state.settings.lessonWorkspace;
    state.settings.scaffoldTracks.sessions[lessons[0].sessionId]={lessonId:'variance',currentStage:stage,events:[]};
    const before=clone(state);
    assert.equal(engine.session(state,lessons[0]).currentSection,id);assert.deepEqual(state,before);
    engine.update(state,lessons[0],id,{draft:'Synthetic resumed legacy draft'});
    assert.deepEqual(protectedRecords(state),protectedRecords(before));
  }
});

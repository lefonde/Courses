/* Reading and drafts only. Never awards completion, learned flags or exam credit. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.StudyLessonEngine=api;
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const fail=()=>{throw new Error('נתוני השיעור אינם תקינים. ההתקדמות הקודמת לא השתנתה.');};
  const object=x=>x&&Object.prototype.toString.call(x)==='[object Object]';
  const id=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
  const keys=(x,allowed)=>object(x)&&Object.keys(x).every(k=>allowed.includes(k));
  const instant=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
  function validate(value){
    if(!keys(value,['version','sessions'])||value.version!==1||!object(value.sessions)||Object.keys(value.sessions).length>100)fail();
    for(const [sid,s] of Object.entries(value.sessions)){
      if(!id(sid)||!keys(s,['contentVersion','currentSection','sections','updatedAt'])||!Number.isInteger(s.contentVersion)||s.contentVersion<1||!id(s.currentSection)||!object(s.sections)||Object.keys(s.sections).length>40||!instant(s.updatedAt))fail();
      for(const [bid,b] of Object.entries(s.sections)){
        if(!id(bid)||!keys(b,['draft','hints','solution'])||typeof b.draft!=='string'||b.draft.length>12000||!Number.isInteger(b.hints)||b.hints<0||b.hints>20||typeof b.solution!=='boolean')fail();
      }
    }
    return value;
  }
  function session(state,lesson){
    const all=state.settings?.lessonWorkspace;
    if(all)validate(all);
    const stored=all?.sessions[lesson.sessionId];
    if(stored&&stored.contentVersion!==lesson.version)throw new Error('נשמרה טיוטה מגרסה אחרת של השיעור. יש לייצא גיבוי לפני מעבר לגרסה החדשה.');
    if(stored){
      const ids=new Set(lesson.sections.map(s=>s.id));
      if(!ids.has(stored.currentSection)||Object.keys(stored.sections).some(s=>!ids.has(s)))fail();
      return copy(stored);
    }
    const legacy=state.settings?.scaffoldTracks?.sessions?.[lesson.sessionId];
    const mapped=lesson.legacyStages?.[legacy?.currentStage];
    return {contentVersion:lesson.version,currentSection:mapped||lesson.sections[0].id,sections:{},updatedAt:new Date().toISOString()};
  }
  function section(state,lesson,sectionId){
    return session(state,lesson).sections[sectionId]||{draft:'',hints:0,solution:false};
  }
  function update(state,lesson,sectionId,patch={}){
    if(!lesson.sections.some(s=>s.id===sectionId)||!keys(patch,['draft','hints','solution']))fail();
    if('draft'in patch&&(typeof patch.draft!=='string'||patch.draft.length>12000)||'hints'in patch&&(!Number.isInteger(patch.hints)||patch.hints<0||patch.hints>20)||'solution'in patch&&typeof patch.solution!=='boolean')fail();
    const s=session(state,lesson),prior=s.sections[sectionId]||{draft:'',hints:0,solution:false};
    s.currentSection=sectionId;s.updatedAt=new Date().toISOString();
    // Help exposure is monotonic. Editing an answer cannot erase previously opened help.
    s.sections[sectionId]={...prior,...patch,hints:Math.max(prior.hints,patch.hints||0),solution:prior.solution||!!patch.solution};
    const next=copy(state.settings?.lessonWorkspace||{version:1,sessions:{}});
    next.sessions[lesson.sessionId]=s;validate(next);
    state.settings||={};state.settings.lessonWorkspace=next;
    return copy(s);
  }
  return {validate,session,section,update};
});

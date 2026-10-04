/* Pure, reviewable plan changes. Learning records are never inferred or reverted. */
(function(root,factory){
 const calendar=typeof module==='object'&&module.exports?require('./plan-calendar.js'):root.StudyPlanCalendar;
 const reviews=typeof module==='object'&&module.exports?require('./review-engine.js'):root.StudyReviewEngine;
 const api=factory(calendar,reviews);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.StudyPlanningEngine=api;
})(typeof window==='undefined'?globalThis:window,function(calendar,reviews){
 'use strict';
 const PLAN='november-2026',copy=x=>JSON.parse(JSON.stringify(x));
 const fail=message=>{throw new Error(message);};
 const effective=(schedule,state)=>[...schedule.sessions,...(state.settings.customSessions||[])].map(s=>({...s,...state.sessionUpdates[s.id]}));
 const work=s=>s.status==='completed'?0:Number.isInteger(s.remainingMinutes)&&s.remainingMinutes>=0?s.remainingMinutes:s.minutes;
 const capacity=(schedule,state,date)=>Number(state.dayOverrides[date]?.capacityMinutes??schedule.days.find(d=>d.date===date)?.capacityMinutes??0);
 const fields=s=>({date:s.date,start:s.start||null,minutes:s.minutes});
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function activateFresh(state,at){
  if(state.settings.activePlanId===PLAN)fail('תוכנית נובמבר כבר פעילה. אין צורך להתחיל שוב.');
  const history=copy(state.settings.planHistory||[]);if(history.length>=5)fail('נשמרו כבר חמישה מחזורי לימוד. יצא גיבוי לפני הוספת מחזור נוסף.');
  const snapshot=copy(state);delete snapshot.settings.planHistory;
  history.push({id:'cycle-'+Date.parse(at),label:'התיעוד לפני ההתחלה מחדש',archivedAt:at,planId:state.settings.activePlanId||'september-2026',snapshot});
  return {schemaVersion:1,revision:state.revision,sessionUpdates:{},problemProgress:{},dayOverrides:{},journal:[],
   settings:{theme:state.settings.theme||'dark',activePlanId:PLAN,activeDate:calendar.START,planHistory:history,planChanges:[],customSessions:[]}};
 }
 function propose(schedule,state,from){
  if(!calendar.dateValid(from)||from<calendar.START||from>=calendar.EXAM)fail('בחר תאריך בתקופת ההכנה ולפני הבחינה.');
  const all=effective(schedule,state).filter(s=>!s.disabled),days=schedule.days.filter(d=>d.date>=from&&d.date<schedule.exam.date).map(d=>d.date);
  const planned=new Map(),used=new Map(days.map(d=>[d,0])),unplaced=[],changes=[];
  for(const s of all.filter(s=>s.status==='completed')){planned.set(s.id,s.date);if(used.has(s.date))used.set(s.date,used.get(s.date)+s.minutes);}
  // Protect mock appointments; their prerequisite failures are reported below, never hidden.
  for(const s of all.filter(s=>s.status!=='completed'&&s.kind==='mock'&&s.date>=from)){
   planned.set(s.id,s.date);if(used.has(s.date))used.set(s.date,used.get(s.date)+s.minutes);
  }
  const pending=all.filter(s=>s.status!=='completed'&&!(s.kind==='mock'&&s.date>=from));
  const waiting=pending.slice();let iterations=0;
  while(waiting.length&&iterations++<=all.length){
   const index=waiting.findIndex(s=>(s.dependsOn||[]).every(id=>!waiting.some(x=>x.id===id)));
   if(index<0){waiting.forEach(s=>unplaced.push({id:s.id,reason:'תלות מעגלית בין משימות; נדרשת עריכה.'}));break;}
   const s=waiting.splice(index,1)[0],deps=(s.dependsOn||[]).map(id=>all.find(x=>x.id===id));
   if(deps.some(d=>!d)){unplaced.push({id:s.id,reason:'משימת קדם חסרה בתוכנית; צריך לתקן את הקישור לפני השיבוץ.'});continue;}
   if(work(s)===0){unplaced.push({id:s.id,reason:'נרשמו אפס דקות להמשך אך המשימה עדיין פתוחה. יש לסיים את התיעוד או לעדכן את הזמן שנותר.'});continue;}
   if(deps.some(d=>d.status!=='completed'&&!planned.has(d.id))){unplaced.push({id:s.id,reason:'לא נמצא מקום למשימת קדם.'});continue;}
   const earliest=deps.filter(d=>d.status!=='completed').map(d=>planned.get(d.id)).sort().at(-1);
   const minutes=work(s),day=days.find(d=>(!earliest||d>earliest)&&capacity(schedule,state,d)-used.get(d)>=minutes);
   if(!day){unplaced.push({id:s.id,reason:`אין חלון פנוי של ${minutes} דקות אחרי תנאי הקדם ולפני הבחינה.`});continue;}
   planned.set(s.id,day);used.set(day,used.get(day)+minutes);
   const before=fields(s),after={date:day,start:day===s.date?s.start||null:null,minutes};
   if(!equal(before,after))changes.push({id:s.id,before,after,reason:[s.date<from?'המפגש הקודם לא הושלם':'שמירת סדר הלימוד והזמן הפנוי',minutes!==s.minutes?`תקציב ההמשך עודכן ל־${minutes} דקות לפי האומדן שלך`:null].filter(Boolean).join('; ')});
  }
  return {baseRevision:state.revision,from,changes,unplaced};
 }
 function validateProposal(schedule,state,proposal,options={}){
  const all=effective(schedule,state),byId=new Map(all.map(s=>[s.id,{...s}])),ids=new Set(),errors=[];
  for(const c of proposal.changes){
   if(ids.has(c.id))errors.push('אותה משימה מופיעה פעמיים בהצעה.');ids.add(c.id);
   const s=byId.get(c.id);if(!s||(!options.undo&&s.status==='completed')||!equal(fields(s),c.before)){errors.push('המשימה השתנתה מאז הכנת ההצעה.');continue;}
   if(!calendar.dateValid(c.after.date)||c.after.date<proposal.from||c.after.date>=schedule.exam.date||!schedule.days.some(d=>d.date===c.after.date))errors.push('התאריך המוצע אינו חלון לימוד בתוכנית.');
   if(!Number.isInteger(c.after.minutes)||c.after.minutes<1||c.after.minutes>600)errors.push('תקציב הזמן אינו תקין.');
   if(c.after.start!==null&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.after.start))errors.push('שעת ההתחלה אינה תקינה.');
   const reserved=reviews.allocatedMinutes(state.settings.questionReviews,c.id)+(state.settings.mixedPractice?.rounds||[]).filter(r=>r.budgetSessionId===c.id).length*10;
   const needed=reserved+(reserved?Number(s.budget?.retrieval||0):0);
   if(c.after.minutes<needed)errors.push(`״${s.title}״ כוללת כבר ${needed} דקות של חזרות ותרגול. אי אפשר לקצר אותה מתחת לזמן הזה.`);
   Object.assign(s,c.after);
  }
  const affected=new Set(proposal.changes.flatMap(c=>[c.before.date,c.after.date]));
  for(const d of affected){const load=[...byId.values()].filter(s=>s.date===d&&!s.disabled).reduce((n,s)=>n+s.minutes,0);if(load>capacity(schedule,state,d))errors.push(`${d}: משובצות ${load} דקות מתוך ${capacity(schedule,state,d)}.`);}
  for(const s of byId.values())if(!s.disabled&&s.status!=='completed'&&(ids.has(s.id)||(s.dependsOn||[]).some(id=>ids.has(id)))){
   for(const id of s.dependsOn||[]){const dep=byId.get(id);if(!dep||dep.disabled)errors.push(`למשימה ״${s.title}״ חסרה משימת קדם פעילה.`);else if(dep.status!=='completed'&&dep.date>=s.date)errors.push(`״${s.title}״ צריכה להיות אחרי ״${dep.title}״.`);}
  }
  return [...new Set(errors)];
 }
 function apply(schedule,state,proposal,at){
  if(proposal.baseRevision!==state.revision)fail('נשמר שינוי מאז הכנת ההצעה. הכן הצעה מעודכנת לפני החלה.');
  if(proposal.changes.some(c=>c.after.date<calendar.dayKey(at)))fail('אי אפשר להעביר משימה ליום שכבר חלף. הכן הצעה מהיום והלאה.');
  const errors=validateProposal(schedule,state,proposal);if(errors.length)fail(errors.join(' '));
  if(!proposal.changes.length)fail('אין שינוי להחלה.');
  const next=copy(state),reviewChanges=[];
  if((next.settings.planChanges||[]).length>=50)fail('יומן השינויים מלא. יצא גיבוי לפני המשך שינויים.');
  for(const c of proposal.changes){
   next.sessionUpdates[c.id]={...next.sessionUpdates[c.id],...c.after};
   for(const entry of (next.settings.questionReviews?.entries||[]).filter(r=>r.sessionId===c.id&&r.status==='planned')){
    const before=copy(entry),anchor=calendar.localStamp(c.after.date,c.after.start||'00:00');
    const due=c.after.start?anchor:new Date(Math.max(Date.parse(anchor),Date.parse(at))).toISOString();
    if(Date.parse(due)<Date.parse(at))fail('ההעברה תיצור חזרה שכבר חלפה. בחר מועד עתידי.');
    next.settings.questionReviews=reviews.moveReview(next.settings.questionReviews,entry.id,{dueAt:due,sessionId:c.id,at});
    reviewChanges.push({id:entry.id,before,after:copy(next.settings.questionReviews.entries.find(r=>r.id===entry.id))});
   }
  }
  const change={id:'plan-'+Date.parse(at),at,status:'applied',changes:copy(proposal.changes),reviewChanges};
  next.settings.planChanges=[...(next.settings.planChanges||[]),change];
  return next;
 }
 function undo(schedule,state,id,at){
  const log=(state.settings.planChanges||[]).find(x=>x.id===id);if(!log||log.status!=='applied')fail('השינוי אינו זמין לביטול.');
  const current=new Map(effective(schedule,state).map(s=>[s.id,s]));
  for(const c of log.changes){if(!current.has(c.id)||!equal(fields(current.get(c.id)),c.after))fail('פרטי התכנון נערכו מאז. לא נדרוס אותם; אפשר להכין הצעה חדשה.');if(c.before.date<calendar.dayKey(at))fail('המועד המקורי כבר חלף. יש להכין הצעת המשך במקום להחזיר משימה לעבר.');}
  for(const r of log.reviewChanges||[]){const entry=state.settings.questionReviews?.entries.find(x=>x.id===r.id);if(!equal(entry,r.after))fail('חזרה הקשורה למשימה עודכנה מאז. נדרשת התאמה במקום ביטול אוטומטי.');}
  const reverse={from:calendar.dayKey(at),changes:log.changes.map(c=>({id:c.id,before:c.after,after:c.before}))};
  const errors=validateProposal(schedule,state,reverse,{undo:true});if(errors.length)fail(errors.join(' '));
  const next=copy(state);
  for(const c of log.changes)next.sessionUpdates[c.id]={...next.sessionUpdates[c.id],...c.before};
  for(const r of log.reviewChanges||[])next.settings.questionReviews=reviews.moveReview(next.settings.questionReviews,r.id,{dueAt:r.before.dueAt,sessionId:r.before.sessionId,at});
  const entry=next.settings.planChanges.find(x=>x.id===id);entry.status='undone';entry.undoneAt=at;
  return next;
 }
 return {PLAN,effective,work,capacity,activateFresh,propose,validateProposal,apply,undo};
});

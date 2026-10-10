/* Remaining learning obligations and calendar placements are separate. No inferred mastery. */
(function(root,factory){
  const common=typeof module==='object'&&module.exports;
  const api=factory(common?require('./plan-calendar.js'):root.StudyPlanCalendar,common?require('./review-engine.js'):root.StudyReviewEngine);
  if(common)module.exports=api;if(root)root.StudyCatchUpEngine=api;
})(typeof window==='undefined'?globalThis:window,function(calendar,reviews){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const fail=message=>{throw new Error(message);};
  const integer=n=>Number.isInteger(n)&&n>=0&&n<=600;
  const effective=(schedule,state)=>[...schedule.sessions,...(state.settings.customSessions||[])].map(s=>({...s,...state.sessionUpdates[s.id]}));
  const day=(schedule,state,date)=>({...schedule.days.find(d=>d.date===date),...state.dayOverrides[date]});
  const capacity=(schedule,state,date)=>{const d=day(schedule,state,date);return Number(d.capacityMinutes||0)+(d.confirmedOptional?Number(d.optionalMinutes||0)+Number(d.conditionalMinutes||0):0);};
  const committed=(schedule,state,s)=>!s.conditional||day(schedule,state,s.date).confirmedOptional;
  const placement=s=>({date:s.date,start:s.start||null,minutes:s.minutes,unscheduled:!!s.unscheduled,reserveUsedMinutes:s.reserveUsedMinutes||0,planningLocked:!!s.planningLocked});
  const fingerprint=(schedule,state)=>JSON.stringify([schedule.sessions,schedule.days,schedule.exam,state]);
  const minutes=s=>s.status==='completed'?0:s.remainingMinutes==null?s.minutes:s.remainingMinutes;
  const reserve=s=>s.remainingMinutes!=null||s.kind==='mock'?0:Math.max(0,Math.min(Number(s.reserveMinutes||0)-(s.reserveUsedMinutes||0),s.minutes-1));
  const title=(all,id)=>all.find(s=>s.id===id)?.title||id;
  function minimum(s,state){
    const allocated=reviews.allocatedMinutes(state.settings.questionReviews,s.id)+(state.settings.mixedPractice?.rounds||[]).filter(r=>r.budgetSessionId===s.id).length*10;
    return Math.max(1,Number(s.breakMinutes||0)+allocated+(allocated?Number(s.budget?.retrieval||0):0),s.kind==='mock'?Number(s.budget?.exam||150)+Number(s.breakMinutes||0)+Number(s.budget?.initial_review||0):0);
  }
  function prepare(schedule,state,input){
    const options={from:input.from,progress:copy(input.progress||{}),capacities:copy(input.capacities||{}),lockedIds:[...(input.lockedIds||[])],deferredIds:[...(input.deferredIds||[])],useReserve:input.useReserve===true};
    if(!calendar.dateValid(options.from)||options.from<calendar.START||options.from>=schedule.exam.date)fail('יש לבחור יום חזרה בתקופת ההכנה ולפני הבחינה.');
    const next=copy(state),all=effective(schedule,state),byId=new Map(all.map(s=>[s.id,s]));
    if(byId.size!==all.length)fail('יש מזהי משימות כפולים בתוכנית. נדרש תיקון של נתוני התוכנית.');
    for(const [id,p]of Object.entries(options.progress)){
      const s=byId.get(id);if(!s||s.disabled||s.status==='completed')fail('אפשר לעדכן כאן רק משימה פעילה שטרם הושלמה.');
      if(!p||!['planned','in-progress','completed'].includes(p.status)||p.remainingMinutes!==null&&(!integer(p.remainingMinutes)||p.remainingMinutes<1))fail('יש לבחור מצב משימה ואומדן המשך חיובי, או להשאיר את האומדן ריק.');
      next.sessionUpdates[id]={...next.sessionUpdates[id],status:p.status,remainingMinutes:p.remainingMinutes};
    }
    for(const [date,n]of Object.entries(options.capacities)){
      if(!schedule.days.some(d=>d.date===date)||date<options.from||date>=schedule.exam.date||!integer(n))fail('הזמינות חייבת להיות בין 0 ל־600 דקות ביום בתקופת ההכנה.');
      // These inputs describe total confirmed capacity, not an addition to optional time.
      next.dayOverrides[date]={...next.dayOverrides[date],capacityMinutes:n,optionalMinutes:0,conditionalMinutes:0};
    }
    for(const ids of [options.lockedIds,options.deferredIds]){
      if(new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id)||byId.get(id).disabled))fail('בחירת המשימות אינה תקינה.');
    }
    if(options.deferredIds.some(id=>options.lockedIds.includes(id)))fail('אי אפשר גם לנעול מועד וגם להשאיר את אותה משימה ללא שיבוץ.');
    const sessions=effective(schedule,next),pending=sessions.filter(s=>!s.disabled&&s.status!=='completed'&&committed(schedule,next,s));
    if(pending.length>100)fail('התוכנית כוללת יותר ממאה משימות פתוחות. יש לצמצם את יחידות התכנון לפני התאמה.');
    for(const s of pending)if(!integer(minutes(s))||minutes(s)<minimum(s,next))fail(`למשימה ״${s.title}״ נדרשות לפחות ${minimum(s,next)} דקות, כולל הפסקות ותרגול שכבר הוקצה. עדכן את אומדן ההמשך או את מצב המשימה.`);
    return {options,state:next,all:sessions,pending};
  }
  const clock=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  function windows(schedule,state,date){
    return (day(schedule,state,date).windows||[]).filter(w=>!w.conditional||day(schedule,state,date).confirmedOptional).map(w=>[clock(w.start),clock(w.end)]).sort((a,b)=>a[0]-b[0]);
  }
  function slot(schedule,state,date,duration,fixed,occupied){
    const ranges=windows(schedule,state,date),busy=occupied.filter(p=>p.date===date&&p.start).map(p=>[clock(p.start),clock(p.start)+p.minutes]);
    if(fixed){const a=clock(fixed),b=a+duration;return b<=1440&&(!ranges.length||ranges.some(([x,y])=>a>=x&&b<=y))&&!busy.some(([x,y])=>a<y&&b>x)?fixed:undefined;}
    if(!ranges.length)return null;
    for(const [a,b]of ranges){for(const start of [a,...busy.map(x=>x[1]).filter(x=>x>=a&&x<b)].sort((x,y)=>x-y))if(start+duration<=b&&!busy.some(([x,y])=>start<y&&start+duration>x))return time(start);}
    return undefined;
  }
  function graph(all,pending){
    const active=new Map(all.filter(s=>!s.disabled).map(s=>[s.id,s])),todo=new Map(pending.map(s=>[s.id,s])),order=[],issues=[];
    for(const s of pending)for(const id of s.dependsOn||[])if(!active.has(id))issues.push(`למשימה ״${s.title}״ חסרה משימת קדם פעילה: ${title(all,id)}.`);
    while(todo.size){const ready=[...todo.values()].filter(s=>(s.dependsOn||[]).every(id=>!todo.has(id))).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));if(!ready.length){issues.push('יש תלות מעגלית בין משימות. נדרש תיקון של סדר הלימוד לפני תכנון מחדש.');break;}for(const s of ready){order.push(s);todo.delete(s.id);}}
    return {order,issues};
  }
  function solve(schedule,prepared,nodeLimit){
    const {state,options,all,pending}=prepared,days=schedule.days.filter(d=>d.date>=options.from&&d.date<schedule.exam.date).map(d=>d.date),g=graph(all,pending);
    const work=new Map(pending.map(s=>[s.id,minutes(s)-(options.useReserve?Math.min(reserve(s),Math.max(0,minutes(s)-minimum(s,state))):0)]));
    const completed=all.filter(s=>s.status==='completed'&&!s.disabled&&committed(schedule,state,s)),locked=new Set(options.lockedIds),deferred=new Set(options.deferredIds),byId=new Map(all.map(s=>[s.id,s]));
    const baseLoads=new Map(days.map(d=>[d,completed.filter(s=>!s.unscheduled&&s.date===d).reduce((n,s)=>n+s.minutes,0)]));
    const domains=new Map(pending.map(s=>[s.id,days.filter(d=>!deferred.has(s.id)&&(!locked.has(s.id)||d===s.date)&&capacity(schedule,state,d)-baseLoads.get(d)>=work.get(s.id)&&slot(schedule,state,d,work.get(s.id),locked.has(s.id)?s.start:null,completed)!==undefined)]));
    const partialDomains=new Map([...domains].map(([id,dates])=>[id,dates.slice()]));
    // Arc bounds preserve the existing rule: unfinished prerequisites finish on an earlier day.
    for(let i=0;i<pending.length;i++)for(const s of g.order){let domain=domains.get(s.id);for(const id of s.dependsOn||[]){if(byId.get(id)?.status==='completed')continue;const before=domains.get(id)||[];domain=domain.filter(d=>before.some(x=>x<d));if(domains.has(id))domains.set(id,before.filter(d=>domain.some(x=>x>d)));}domains.set(s.id,domain);}
    const available=days.reduce((n,d)=>n+Math.max(0,capacity(schedule,state,d)-baseLoads.get(d)),0),required=pending.filter(s=>!deferred.has(s.id)).reduce((n,s)=>n+work.get(s.id),0);
    let reason=required>available?'capacity':'constraints',nodes=0,limited=false,answer=null;
    if(required<=available&&[...new Set(work.values())].some(size=>pending.filter(s=>!deferred.has(s.id)&&work.get(s.id)>=size).length>days.reduce((n,d)=>n+Math.floor(Math.max(0,capacity(schedule,state,d)-baseLoads.get(d))/size),0)))reason='block-length';
    function candidates(s,assigned,loads,preferOriginal){
      return ((preferOriginal?domains:partialDomains).get(s.id)||[]).filter(d=>(s.dependsOn||[]).every(id=>byId.get(id)?.status==='completed'||assigned.get(id)?.date<d)&&loads.get(d)+work.get(s.id)<=capacity(schedule,state,d)).sort((a,b)=>preferOriginal?(Number(b===s.date)-Number(a===s.date)||a.localeCompare(b)):a.localeCompare(b));
    }
    function put(s,date,assigned){
      const preferred=locked.has(s.id)||date===s.date?s.start:null,occupied=[...completed,...assigned.values()];
      let start=slot(schedule,state,date,work.get(s.id),preferred,occupied);
      if(start===undefined&&!locked.has(s.id))start=slot(schedule,state,date,work.get(s.id),null,occupied);
      return start===undefined?null:{date,start,minutes:work.get(s.id),unscheduled:false,reserveUsedMinutes:(s.reserveUsedMinutes||0)+(minutes(s)-work.get(s.id)),planningLocked:locked.has(s.id)};
    }
    const order=g.order.filter(s=>!deferred.has(s.id));
    function visit(index,assigned,loads){
      if(++nodes>nodeLimit){limited=true;return false;}
      if(index===order.length){answer=new Map(assigned);return true;}
      const s=order[index];
      for(const d of candidates(s,assigned,loads,true)){const p=put(s,d,assigned);if(!p)continue;assigned.set(s.id,p);loads.set(d,loads.get(d)+p.minutes);if(visit(index+1,assigned,loads))return true;assigned.delete(s.id);loads.set(d,loads.get(d)-p.minutes);if(limited)return false;}
      return false;
    }
    if(!g.issues.length&&reason==='constraints')visit(0,new Map(),new Map(baseLoads));
    // A partial result is dependency-closed. Unplaced obligations have no active calendar occupancy.
    if(!answer){answer=new Map();const loads=new Map(baseLoads);for(const s of order){for(const d of candidates(s,answer,loads,false)){const p=put(s,d,answer);if(p){answer.set(s.id,p);loads.set(d,loads.get(d)+p.minutes);break;}}}}
    const placements=pending.map(s=>({id:s.id,before:placement(s),after:answer.get(s.id)||{...placement(s),start:null,unscheduled:true,planningLocked:locked.has(s.id)},reason:answer.has(s.id)?s.date<options.from?'השלמת מפגש שהוחמץ':'התאמת הזמן וסדר הלימוד':deferred.has(s.id)?'נשאר ללא שיבוץ לפי בחירתך':'לא נמצא שיבוץ בהצעה הזאת'}));
    const unplaced=placements.filter(p=>p.after.unscheduled).map(p=>{const s=byId.get(p.id),deps=(s.dependsOn||[]).filter(id=>byId.get(id)?.status!=='completed'&&!answer.has(id));return {id:p.id,minutes:work.get(p.id),reason:deferred.has(p.id)?'בחרת להשאיר את המשימה ללא שיבוץ.':deps.length?`קודם צריך לשבץ: ${deps.map(id=>title(all,id)).join('، ')}.`:locked.has(p.id)?'המועד הנעול אינו מאפשר שיבוץ תקין. אפשר לשחרר את הנעילה או לעדכן זמינות.':`נדרש מפגש של ${work.get(p.id)} דקות אחרי משימות הקדם ולפני הבחינה.`,dependencies:deps};});
    return {placements,unplaced,issues:g.issues,searchStatus:g.issues.length?'invalid':unplaced.length?(limited?'search-limit':reason):'complete',nodes,summary:{requiredMinutes:required,availableMinutes:available,gapMinutes:Math.max(0,required-available),reserveAvailable:pending.reduce((n,s)=>n+reserve(s),0),reserveUsed:placements.filter(p=>!p.after.unscheduled).reduce((n,p)=>n+p.after.reserveUsedMinutes-p.before.reserveUsedMinutes,0),reserveRemaining:placements.filter(p=>!p.after.unscheduled).reduce((n,p)=>n+reserve(byId.get(p.id))-(p.after.reserveUsedMinutes-p.before.reserveUsedMinutes),0)}};
  }
  function propose(schedule,state,input,limits={}){
    const prepared=prepare(schedule,state,input),result=solve(schedule,prepared,limits.nodes||18000);
    const proposal={version:2,baseRevision:state.revision,baseFingerprint:fingerprint(schedule,state),options:prepared.options,...result};
    proposal.errors=validate(schedule,state,proposal);
    return proposal;
  }
  function validate(schedule,state,proposal){
    const errors=[];
    if(proposal.version!==2||proposal.baseRevision!==state.revision||proposal.baseFingerprint!==fingerprint(schedule,state))return ['הנתונים השתנו מאז הכנת ההצעה. יש להכין הצעה מעודכנת.'];
    let prepared;try{prepared=prepare(schedule,state,proposal.options);}catch(e){return [e.message];}
    const {all,pending,options}=prepared,snapshot=prepared.state,byId=new Map(all.map(s=>[s.id,s])),seen=new Set(),placements=new Map();
    errors.push(...graph(all,pending).issues);
    for(const change of proposal.placements||[]){
      const s=byId.get(change.id),p=change.after;
      if(!s||seen.has(change.id)||!pending.some(x=>x.id===change.id)||!same(change.before,placement(s))){errors.push('רשימת השיבוצים אינה תואמת למשימות שנותרו.');continue;}seen.add(change.id);
      if(!p||typeof p.unscheduled!=='boolean'||!integer(p.minutes)||p.minutes<1||typeof p.planningLocked!=='boolean'||!integer(p.reserveUsedMinutes)){errors.push('פרטי שיבוץ אינם תקינים.');continue;}
      if(p.unscheduled){if(options.lockedIds.includes(s.id))errors.push(`״${s.title}״ נעולה אך לא שובצה. יש לשחרר את הנעילה או לפנות זמן.`);if((snapshot.settings.questionReviews?.entries||[]).some(r=>r.sessionId===s.id&&r.status==='planned'))errors.push(`למשימה ״${s.title}״ יש חזרה מתוכננת. צריך למצוא לה מועד לפני שמירת תוכנית חלקית.`);if(!same(p,{...placement(s),start:null,unscheduled:true,planningLocked:options.lockedIds.includes(s.id)}))errors.push('משימה ללא שיבוץ אינה יכולה לשנות את תקציב הלימוד.');continue;}
      const use=options.useReserve?Math.min(reserve(s),Math.max(0,minutes(s)-minimum(s,snapshot))):0;
      if(options.deferredIds.includes(s.id)||p.minutes!==minutes(s)-use||p.reserveUsedMinutes!==(s.reserveUsedMinutes||0)+use||p.planningLocked!==options.lockedIds.includes(s.id))errors.push('השיבוץ משנה זמן או בחירה שלא אושרו.');
      if(!calendar.dateValid(p.date)||p.date<options.from||p.date>=schedule.exam.date||!schedule.days.some(d=>d.date===p.date))errors.push('מועד השיבוץ חייב להיות מיום החזרה ועד לפני הבחינה.');
      if(p.start!==null&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(p.start))errors.push('שעת השיבוץ אינה תקינה.');
      if(options.lockedIds.includes(s.id)&&(p.date!==s.date||s.start&&p.start!==s.start))errors.push(`המועד של ״${s.title}״ נעול.`);
      placements.set(s.id,{...s,...p});
    }
    if(pending.some(s=>!seen.has(s.id)))errors.push('יש עבודה שנותרה ללא תוצאה מפורשת בהצעה.');
    const scheduled=[...all.filter(s=>s.status==='completed'&&!s.disabled&&!s.unscheduled&&committed(schedule,snapshot,s)),...placements.values()];
    for(const date of new Set(scheduled.filter(s=>s.date>=options.from).map(s=>s.date))){
      const list=scheduled.filter(s=>s.date===date),load=list.reduce((n,s)=>n+s.minutes,0);
      if(load>capacity(schedule,snapshot,date))errors.push(`${date}: נדרשות ${load} דקות ויש ${capacity(schedule,snapshot,date)} דקות זמינות.`);
      for(const s of list)if(s.status!=='completed'&&(!s.start&&windows(schedule,snapshot,date).length||s.start&&slot(schedule,snapshot,date,s.minutes,s.start,list.filter(x=>x.id!==s.id))===undefined))errors.push(`״${s.title}״ אינה נכנסת בחלון הזמן או חופפת למפגש אחר.`);
    }
    for(const s of placements.values())for(const id of s.dependsOn||[])if(byId.get(id)?.status!=='completed'&&(!placements.has(id)||placements.get(id).date>=s.date))errors.push(`״${s.title}״ חייבת להיות אחרי ״${title(all,id)}״.`);
    return [...new Set(errors)];
  }
  function changed(proposal){return proposal.placements.filter(p=>!same(p.before,p.after));}
  function apply(schedule,state,proposal,at,acknowledgePartial=false){
    const errors=validate(schedule,state,proposal);if(errors.length)fail(errors.join(' '));
    if(proposal.options.from<calendar.dayKey(at))fail('יום החזרה כבר חלף. יש להכין הצעה מהיום והלאה.');
    if(proposal.placements.some(p=>!p.after.unscheduled&&p.after.start&&Date.parse(calendar.localStamp(p.after.date,p.after.start))<Date.parse(at)))fail('שעת התחלה בהצעה כבר חלפה. יש לשחרר את המועד או לבחור יום חזרה אחר.');
    const partial=proposal.placements.some(p=>p.after.unscheduled);if(partial&&!acknowledgePartial)fail('לפני שמירה יש לאשר במפורש את רשימת העבודה שלא שובצה.');
    const prepared=prepare(schedule,state,proposal.options),next=prepared.state,changes=changed(proposal),availabilityChanges=[],reviewChanges=[];
    for(const date of Object.keys(proposal.options.capacities))if(!same(state.dayOverrides[date]||null,next.dayOverrides[date]))availabilityChanges.push({date,before:copy(state.dayOverrides[date]||null),after:copy(next.dayOverrides[date])});
    const progressChanged=!same(next.sessionUpdates,state.sessionUpdates);
    if(!changes.length&&!availabilityChanges.length&&!progressChanged)fail('התוכנית כבר מתאימה. אין שינוי לשמירה.');
    if((next.settings.catchUpChanges||[]).length>=50)fail('יומן שינויי התוכנית מלא. יצא גיבוי לפני שינוי נוסף.');
    for(const change of changes){
      next.sessionUpdates[change.id]={...next.sessionUpdates[change.id],...change.after};
      for(const entry of (next.settings.questionReviews?.entries||[]).filter(r=>r.sessionId===change.id&&r.status==='planned')){
        const before=copy(entry),anchor=calendar.localStamp(change.after.date,change.after.start||'00:00');
        const due=change.after.start?anchor:new Date(Math.max(Date.parse(anchor),Date.parse(at))).toISOString();
        if(Date.parse(due)<Date.parse(at))fail('מועד חזרה קשורה כבר חלף. יש לבחור מועד עתידי.');
        next.settings.questionReviews=reviews.moveReview(next.settings.questionReviews,entry.id,{dueAt:due,sessionId:change.id,at});
        reviewChanges.push({id:entry.id,before,after:copy(next.settings.questionReviews.entries.find(r=>r.id===entry.id))});
      }
    }
    next.settings.catchUpChanges=[...(next.settings.catchUpChanges||[]),{version:2,id:'catchup-'+Date.parse(at)+'-'+state.revision+'-'+(next.settings.catchUpChanges||[]).length,at,status:'applied',changes:copy(changes),availabilityChanges,reviewChanges,partial,unplacedIds:proposal.placements.filter(p=>p.after.unscheduled).map(p=>p.id)}];
    return next;
  }
  function undo(schedule,state,id,at){
    const log=(state.settings.catchUpChanges||[]).find(x=>x.id===id);if(!log||log.status!=='applied')fail('השינוי אינו זמין לביטול.');
    const all=effective(schedule,state),byId=new Map(all.map(s=>[s.id,s])),next=copy(state);
    for(const c of log.changes){const s=byId.get(c.id);if(!s||!same(placement(s),c.after))fail('פרטי התכנון נערכו מאז. אפשר להכין הצעה חדשה בלי לדרוס אותם.');if(s.status==='completed')continue;if(!c.before.unscheduled&&c.before.date<calendar.dayKey(at))fail('המועד הקודם כבר חלף. השתמש בחוזרים למסלול כדי לבנות המשך מהיום, בלי למחוק התקדמות.');next.sessionUpdates[c.id]={...next.sessionUpdates[c.id],...c.before};}
    for(const c of log.availabilityChanges){if(!same(state.dayOverrides[c.date]||null,c.after))fail('הזמינות נערכה מאז. יש להכין הצעה חדשה.');if(c.before===null)delete next.dayOverrides[c.date];else next.dayOverrides[c.date]=copy(c.before);}
    for(const r of log.reviewChanges){const current=state.settings.questionReviews?.entries.find(x=>x.id===r.id);if(!same(current,r.after)||byId.get(r.after.sessionId)?.status==='completed')fail('חזרה או מפגש הקשורים לשינוי התקדמו מאז. יש להכין הצעה חדשה.');next.settings.questionReviews=reviews.moveReview(next.settings.questionReviews,r.id,{dueAt:r.before.dueAt,sessionId:r.before.sessionId,at});}
    // Revalidate the restored calendar without rescheduling it or undoing any progress.
    const options={from:calendar.dayKey(at),lockedIds:effective(schedule,next).filter(s=>s.planningLocked).map(s=>s.id)},prepared=prepare(schedule,next,options);
    const proposal={version:2,baseRevision:next.revision,baseFingerprint:fingerprint(schedule,next),options:prepared.options,placements:prepared.pending.map(s=>({id:s.id,before:placement(s),after:placement(s)}))};
    const errors=validate(schedule,next,proposal);if(errors.length)fail('אי אפשר להחזיר את התוכנית הישנה במצב הנוכחי: '+errors.join(' '));
    const entry=next.settings.catchUpChanges.find(x=>x.id===id);entry.status='undone';entry.undoneAt=at;
    return next;
  }
  function suggestAvailability(schedule,state,input){
    const options=copy(input);options.capacities={...options.capacities};let proposal=propose(schedule,state,options,{nodes:3000});
    const dates=schedule.days.filter(d=>d.date>=options.from&&d.date<schedule.exam.date&&capacity(schedule,prepare(schedule,state,options).state,d.date)===0).map(d=>d.date),added=[];
    for(const date of dates){if(proposal.searchStatus==='complete'||added.length>=10)break;options.capacities[date]=Math.min(600,Math.max(90,...proposal.unplaced.map(x=>x.minutes)));added.push(date);proposal=propose(schedule,state,options,{nodes:3000});}
    if(proposal.searchStatus==='complete')for(const date of added.slice().reverse()){
      const previous=options.capacities[date];delete options.capacities[date];const attempt=propose(schedule,state,options,{nodes:3000});
      if(attempt.searchStatus==='complete')proposal=attempt;
      else {options.capacities[date]=previous;for(let n=90;n<previous;n+=30){options.capacities[date]=n;const smaller=propose(schedule,state,options,{nodes:3000});if(smaller.searchStatus==='complete'){proposal=smaller;break;}options.capacities[date]=previous;}}
    }
    return {options,proposal:propose(schedule,state,options),addedDates:added.filter(date=>Object.prototype.hasOwnProperty.call(options.capacities,date))};
  }
  return {effective,capacity,placement,minutes,reserve,minimum,prepare,propose,validate,apply,undo,changed,suggestAvailability};
});

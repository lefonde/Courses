'use strict';
window.StudyPlanner=(()=>{
 let draft=null,options=null;
 const lastDay=()=>StudyPlanCalendar.dayKey(Date.parse(StudyPlanCalendar.localStamp(StudyPlanCalendar.EXAM))-86400000);
 const today=()=>safeDate(dateNow());
 const relevant=()=>schedule?.planId===StudyPlanningEngine.PLAN;
 const active=()=>!relevant()||state.settings.activePlanId===StudyPlanningEngine.PLAN;
 function entry(){return relevant()?`<button class="button small" data-plan-action="repair">חוזרים למסלול</button><button class="text-link" data-plan-action="history">מה השתנה בתוכנית?</button>`:'';}
 function startPage(){return heading('מתחילים מחדש לקראת 23 בנובמבר','תוכנית חדשה לפי הזמינות שלך, עם התיעוד הקודם שמור בנפרד.')+`<section class="panel plan-intro"><span class="eyebrow">לפני פתיחת מחזור הלימוד החדש</span><h2>מה יקרה כשתתחיל?</h2><ul class="step-list"><li>28 מפגשים: שני ורביעי — 90 דקות; שישי ושבת — 180 דקות.</li><li>63 שעות בסך הכול, כולל חזרות, הפסקות ושש שעות עתודה.</li><li>משימות, שאלות וכרטיסיות יתחילו ללא סימוני לימוד או פתרון.</li><li>ההתקדמות הקודמת תישמר כאן כהיסטוריה שניתן לקרוא ולייצא.</li></ul><p>הבחינה ב־23.11, נמשכת 150 דקות ובהיקף שסיכמנו. זמן נוסף של חצי שעה עד שעה אינו נדרש לכיסוי הליבה. שעות ההתחלה גמישות עד שתבחר אותן.</p><div class="notice neutral">הבחירה מתחילה מחזור חדש בדפדפן הזה בלבד. היא אינה מוחקת את ההיסטוריה ואינה משנה עותק במכשיר אחר.</div><div class="dialog-actions"><button class="button primary" data-plan-action="activate">להתחיל את תוכנית נובמבר</button><button class="button" data-action="export">הורדת גיבוי לפני ההתחלה</button><button class="text-link" data-plan-action="prior">צפייה בתיעוד הקודם</button></div></section>`;}
 function archiveView(snapshot,label){
  const attempts=snapshot.learning?.attempts||[],updates=Object.entries(snapshot.sessionUpdates||{}),problems=Object.entries(snapshot.problemProgress||{});
  return `<h3>${esc(label)}</h3><p>${updates.length} משימות עודכנו · ${problems.length} שאלות תועדו · ${attempts.length} ניסיונות נשמרו.</p><div class="history-list">${updates.map(([id,s])=>`<article class="attempt-card"><strong>${esc(s.title||previousSchedule.sessions.find(x=>x.id===id)?.title||id)}</strong><p>${esc(s.date||'')} · ${esc(s.status==='completed'?'הושלמה':s.status==='in-progress'?'התחילה':'מתוכננת')}</p><p>${esc(s.note||'')}</p></article>`).join('')}${attempts.map(a=>`<article class="attempt-card"><strong>${esc(problemOf(a.problemId)?.title||previousSchedule.sessions.find(x=>x.id===a.sessionId)?.title||a.problemId||a.sessionId)}</strong><p>${esc(a.note||'')}</p><p>${esc(a.continuation||'')}</p></article>`).join('')}</div><p class="hint">הקובץ ליצוא כולל גם כרטיסיות, חזרות, שאלות והגדרות שהיו שמורות במחזור הזה. תצוגה זו אינה מחזירה אותם למעקב הפעיל.</p>`;
 }
 function legacyHistory(){
  const archives=state.settings.planHistory||[],changes=state.settings.planChanges||[];
  openDialog('plan-history','history','היסטוריה ושינויים בתוכנית',`<h3>מחזורי לימוד קודמים</h3>${archives.length?archives.map(a=>`<details class="task-details"><summary>${esc(a.label)} · ${esc(fmtDate(a.archivedAt.slice(0,10)))}</summary>${archiveView(a.snapshot,a.label)}<button class="button" data-plan-action="export-history" data-id="${esc(a.id)}">הורדת התיעוד הקודם</button></details>`).join(''):'<p>עדיין לא נשמר מחזור קודם.</p>'}<h3>שינויי תכנון שאישרת במחזור הנוכחי</h3>${changes.length?changes.slice().reverse().map(c=>`<article class="attempt-card"><strong>${c.status==='undone'?'השינוי בוטל':'הצעת תכנון שהוחלה'}</strong><p>${esc(fmtDate(c.at.slice(0,10)))} · ${c.changes.length} משימות</p><ul>${c.changes.map(x=>`<li>${esc(sessionOf(x.id)?.title||x.id)}: מ־${fmtDate(x.before.date)} (${x.before.minutes} דקות) ל־${fmtDate(x.after.date)} (${x.after.minutes} דקות)</li>`).join('')}</ul>${c.status==='applied'?`<button class="button small" data-plan-action="undo" data-id="${esc(c.id)}">בדיקה וביטול השינוי הזה</button>`:''}</article>`).join(''):'<p>עדיין לא הוחלה הצעת תכנון.</p>'}`,'תיעוד שנשאר בשליטתך');
 }

 const engine=()=>StudyCatchUpEngine;
 const duration=n=>timeLabel(n);
 const button=(action,label,extra='')=>`<button type="button" class="button" data-plan-action="${action}" ${extra}>${label}</button>`;
 function frame(step,title,body,actions){
  openDialog('catch-up','step-'+step,title,`<ol class="plan-steps" aria-label="שלבי ההתאמה">${['איפה ממשיכים?','התאמת הזמן','עיון ושמירה'].map((label,i)=>`<li ${step===i+1?'aria-current="step"':''}>${i+1}. ${label}</li>`).join('')}</ol><div id="plan-error" class="error" role="alert"></div>${body}`,'חוזרים למסלול · צעד '+step+' מתוך 3');
  $('#dialog-content').insertAdjacentHTML('beforeend',`<div class="task-fixed-actions plan-fixed-actions">${actions}</div>`);
 }
 function showError(error){const target=$('#plan-error');if(target){target.textContent=error.message||error;target.scrollIntoView({block:'nearest'});}else notify(error.message||error);}
 function inputFor(s){return options.progress[s.id]||{status:s.status||'planned',remainingMinutes:s.remainingMinutes??null};}
 function progressRow(s){
  const p=inputFor(s);
  return `<div class="plan-progress-row"><div><strong>${esc(s.title)}</strong><small>${s.unscheduled?'ללא מועד':fmtDate(s.date)} · תקציב נוכחי: ${duration(s.minutes)}</small></div><label>מצב הלימוד<select class="field-input" name="status-${s.id}">${[['planned','לא התחלתי'],['in-progress','התחלתי'],['completed','סיימתי']].map(([v,l])=>`<option value="${v}" ${v===p.status?'selected':''}>${l}</option>`).join('')}</select></label><label>דקות להמשך (אם ידוע)<input class="field-input" type="number" min="1" max="600" name="remaining-${s.id}" value="${p.remainingMinutes??''}" placeholder="לפי התקציב הקיים"></label></div>`;
 }
 function repair(reset=true){
  if(today()>=schedule.exam.date){openDialog('plan-ended','ended','תקופת ההכנה הסתיימה','<p>אין חלונות לימוד לפני הבחינה. ההתקדמות וההיסטוריה נשמרו.</p>'+button('history','צפייה בשינויים'));return;}
  if(reset||!options)options={from:[today(),activeDate<schedule.exam.date?activeDate:today()].sort().at(-1),progress:{},capacities:{},lockedIds:engine().effective(schedule,state).filter(s=>s.planningLocked&&!s.disabled&&s.status!=='completed').map(s=>s.id),deferredIds:[],useReserve:false};
  const pending=engine().effective(schedule,state).filter(s=>!s.disabled&&s.status!=='completed'),needs=pending.filter(s=>s.date<options.from||s.unscheduled||s.status==='in-progress'),later=pending.filter(s=>!needs.includes(s));
  frame(1,'איפה ממשיכים מכאן?',`<p>נעדכן את העבודה שנותרה ואת הזמן שבאמת פנוי לך. כל השינויים כאן הם טיוטה עד לשמירה בסוף.</p><form id="catch-up-progress"><label class="form-field" for="catch-up-from">מאיזה יום חוזרים ללמוד?<input class="field-input" type="date" id="catch-up-from" name="from" min="${today()}" max="${lastDay()}" value="${options.from}" required></label><h3>מפגשים שכדאי לבדוק</h3><p class="hint">אפשר להשאיר את המצב כפי שהוא. זמן שעבדת אינו מופחת אוטומטית, וסיום מפגש אינו מסמן שליטה בשאלות.</p>${needs.map(progressRow).join('')||'<p>אין מפגשים קודמים פתוחים.</p>'}<details class="task-details"><summary>עדכון מפגשים נוספים (${later.length})</summary>${later.map(progressRow).join('')}</details></form>`,`<button class="button primary" type="submit" form="catch-up-progress">בדיקת הזמן שנותר</button>${button('cancel','יציאה ללא שינוי')}`);
 }
 function readProgress(form){
  const f=new FormData(form),from=f.get('from');options.from=from;options.progress={};
  for(const s of engine().effective(schedule,state).filter(s=>!s.disabled&&s.status!=='completed')){
   const status=f.get('status-'+s.id),raw=f.get('remaining-'+s.id),remainingMinutes=status==='completed'||raw===''?null:Number(raw);
   if(status!==(s.status||'planned')||remainingMinutes!==(s.remainingMinutes??null))options.progress[s.id]={status,remainingMinutes};
  }
  options.capacities=Object.fromEntries(Object.entries(options.capacities).filter(([date])=>date>=from));
  options.lockedIds=options.lockedIds.filter(id=>options.progress[id]?.status!=='completed');
  options.deferredIds=options.deferredIds.filter(id=>options.progress[id]?.status!=='completed');
 }
 function calculate(){draft=engine().propose(schedule,state,options);return draft;}
 function metrics(p){return `<div class="plan-metrics"><div><span>עבודה שנותרה בהיקף שנבחר</span><strong>${duration(p.summary.requiredMinutes)}</strong></div><div><span>זמן פנוי עד הבחינה</span><strong>${duration(p.summary.availableMinutes)}</strong></div><div><span>${p.summary.gapMinutes?'פער בתקציב הזמן':'משימות ללא שיבוץ'}</span><strong>${p.summary.gapMinutes?duration(p.summary.gapMinutes):p.unplaced.length}</strong></div></div>`;}
 function explanation(p){
  if(p.errors.length)return `<div class="notice danger"><strong>צריך לתקן לפני שמירה</strong><ul>${p.errors.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
  if(!p.unplaced.length)return '<div class="notice neutral">נמצאה תוכנית מלאה שמתאימה לזמן ולסדר הלימוד.</div>';
  const message=p.searchStatus==='capacity'?`להיקף שנבחר חסרות לפחות ${duration(p.summary.gapMinutes)}. גם מיקום הזמן ומשך המפגשים צריכים להתאים.`:p.searchStatus==='block-length'?'סך הדקות עשוי להספיק, אבל אין מספיק חלונות ארוכים למפגשים שנותרו. הוספת זמן בחלון קצר לא בהכרח תפתור את הפער.':p.searchStatus==='search-limit'?'עדיין לא נמצאה תוכנית מלאה במסגרת הבדיקה. זו אינה הוכחה שאין סידור אפשרי. אפשר לשנות זמינות או לשחרר מועדים נעולים.':'לא נמצא סידור מלא עם המועדים, משכי המפגשים וסדר הלימוד הנוכחיים.';
  return `<div class="notice"><strong>${p.unplaced.length} משימות עדיין צריכות מקום</strong><p>${message}</p></div>`;
 }
 function capacityRows(){
  return schedule.days.filter(d=>d.date>=options.from&&d.date<schedule.exam.date).map(d=>`<label class="plan-capacity-row"><span>${fmtDay(d.date)} · ${fmtDate(d.date)}</span><span><input class="field-input" name="capacity-${d.date}" aria-label="דקות זמינות ב־${fmtDate(d.date)}" type="number" min="0" max="600" step="5" value="${options.capacities[d.date]??engine().capacity(schedule,state,d.date)}" required> דקות</span></label>`).join('');
 }
 function adjustments(message=''){
  const p=draft||calculate(),prepared=engine().prepare(schedule,state,options),pending=prepared.pending;
  frame(2,'נתאים את התוכנית לזמן שלך',`${metrics(p)}${explanation(p)}${message?`<div class="notice neutral" role="status">${esc(message)}</div>`:''}<form id="catch-up-adjust"><fieldset class="plan-option"><legend>שימוש בעתודה שכבר בתוכנית</legend><label class="check-line"><input type="checkbox" name="reserve" ${options.useReserve?'checked':''}><span>אפשר להשתמש בזמן העתודה להשלמות — עד ${duration(p.summary.reserveAvailable)}<small>העתודה כלולה בתקציב המפגשים. ההפסקות והסימולציות נשמרות; אומדן המשך אישי אינו מתקצר שוב.</small></span></label></fieldset><fieldset class="plan-option"><legend>הזמן שבאמת פנוי לי</legend><p>הזמינות היא מלוא הזמן למפגש, כולל הפסקות. ביום החזרה כלול גם מפגשים שכבר סיימת באותו יום; הזמן שלהם יופחת מהתקציב הפנוי.</p>${button('suggest-time','הצעת חלונות נוספים לבדיקה')}<p class="hint">החלונות המוצעים אינם ידיעה על היומן שלך. אפשר לערוך או להסיר אותם כאן, לפני שמירה.</p><details class="task-details" ${Object.keys(options.capacities).length?'open':''}><summary>עריכת הזמינות עד הבחינה</summary><div class="plan-capacities">${capacityRows()}</div></details></fieldset><details class="task-details"><summary>מועדים שחשוב לי לשמור</summary><p>רק מועדים שתסמן כאן יישארו קבועים. סימולציות אחרות יכולות לזוז אחרי משימות הקדם שלהן.</p>${pending.map(s=>`<label class="check-line"><input type="checkbox" name="lock" value="${s.id}" ${options.lockedIds.includes(s.id)?'checked':''}><span>${esc(s.title)} · ${fmtDate(s.date)}${s.start?' · '+esc(s.start):''}</span></label>`).join('')}</details><details class="task-details"><summary>בחירת עבודה שתישאר ללא שיבוץ</summary><p class="notice">הסימון אינו מוחק חומר ואינו מסמן אותו כנלמד. גם משימות שתלויות בחומר שלא שובץ יישארו ללא מועד. לפני שמירת תוכנית חלקית תופיע רשימת החומר שלא נכנס.</p><p>אין כאן קיצור אוטומטי של שאלות חובה או הוכחות. אפשר להחזיר כל משימה לתכנון בהתאמה הבאה.</p>${pending.map(s=>`<label class="check-line"><input type="checkbox" name="defer" value="${s.id}" ${options.deferredIds.includes(s.id)?'checked':''}><span>${esc(s.title)} · ${duration(engine().minutes(s))} · ${s.optional?'תרגול נוסף':'חלק מתוכנית הליבה'}</span></label>`).join('')}</details></form>`,`<button class="button primary" type="submit" form="catch-up-adjust">בדיקת התוכנית</button>${button('back-progress','חזרה למצב הלימוד')}${button('cancel','יציאה ללא שינוי')}`);
 }
 function readAdjustments(){
  const form=$('#catch-up-adjust');if(!form)return;
  if(!form.reportValidity())throw new Error('יש לתקן את שדות הזמינות המסומנים.');
  const f=new FormData(form);options.useReserve=f.has('reserve');options.lockedIds=f.getAll('lock');options.deferredIds=f.getAll('defer');options.capacities={};
  for(const d of schedule.days.filter(d=>d.date>=options.from&&d.date<schedule.exam.date)){const n=Number(f.get('capacity-'+d.date));if(n!==engine().capacity(schedule,state,d.date))options.capacities[d.date]=n;}
 }
 function resultSessions(){
  const prepared=engine().prepare(schedule,state,options);
  return prepared.all.map(s=>({...s,...draft.placements.find(p=>p.id===s.id)?.after})).filter(s=>draft.placements.some(p=>p.id===s.id)&&!s.disabled&&!s.unscheduled&&s.status!=='completed').sort((a,b)=>a.date.localeCompare(b.date)||(a.start||'').localeCompare(b.start||''));
 }
 function review(){
  const p=draft,changes=engine().changed(p),next=resultSessions()[0],partial=p.unplaced.length>0;
  const noChanges=!changes.length&&!Object.keys(options.progress).length&&!Object.keys(options.capacities).length;
  const proposed=engine().prepare(schedule,state,options).state,upcoming=schedule.days.filter(d=>d.date>=options.from&&d.date<schedule.exam.date).slice(0,7),list=resultSessions();
  const progress=Object.entries(options.progress).map(([id,value])=>`<li>${esc(sessionOf(id)?.title||id)}: ${value.status==='completed'?'סומן כסיום מפגש':value.status==='in-progress'?'התחלת ללמוד':'טרם התחלת'}${value.remainingMinutes!==null?' · אומדן המשך '+duration(value.remainingMinutes):''}</li>`).join('');
  frame(3,'התוכנית המעודכנת — לפני שמירה',`${explanation(p)}${next?`<section class="plan-next"><span class="eyebrow">המפגש הבא</span><h3>${esc(next.title)}</h3><p>${fmtDate(next.date)} · ${duration(next.minutes)}</p></section>`:'<p>אין מפגש משובץ בהצעה הזאת.</p>'}<p>${changes.length} שינויים בתכנון · ${Object.keys(options.capacities).length} ימי זמינות עודכנו · ${duration(p.summary.reserveUsed)} עתודה ינוצלו. במפגשים המשובצים תישאר עתודה של ${duration(p.summary.reserveRemaining)}.</p>${partial?`<section class="plan-unplaced"><h3>חומר שלא נכנס לתוכנית (${p.unplaced.length})</h3><p>תוכנית חלקית אינה מכסה את כל ההכנה לבחינה. העבודה הזאת תישאר ברשימה נפרדת ולא תתפוס מקום ביומן.</p><ul>${p.unplaced.map(x=>`<li><strong>${esc(sessionOf(x.id)?.title||x.id)}</strong> · ${duration(x.minutes)}<p>${esc(x.reason)}</p></li>`).join('')}</ul><label class="check-line"><input id="plan-partial-ack" type="checkbox"><span>עברתי על הרשימה ואני מאשר לשמור תוכנית חלקית עם החומר הזה ללא שיבוץ.</span></label></section>`:''}<h3>השבוע הקרוב</h3><div class="plan-week">${upcoming.map(d=>{const items=list.filter(s=>s.date===d.date),done=engine().effective(schedule,proposed).filter(s=>s.status==='completed'&&!s.disabled&&!s.unscheduled&&s.date===d.date).reduce((n,s)=>n+s.minutes,0),load=items.reduce((n,s)=>n+s.minutes,done);return `<div><strong>${fmtDay(d.date)} · ${fmtDate(d.date)}</strong><span>${duration(load)} מתוך ${duration(engine().capacity(schedule,proposed,d.date))}</span><p>${items.map(s=>esc(s.title)).join(' · ')||'אין מפגש פתוח משובץ'}</p></div>`;}).join('')}</div><details class="task-details"><summary>פירוט כל השינויים</summary>${changes.map(c=>`<div class="plan-diff"><strong>${esc(sessionOf(c.id)?.title||c.id)}</strong><p>לפני: ${c.before.unscheduled?'ללא שיבוץ':fmtDate(c.before.date)} · ${duration(c.before.minutes)}${c.before.start?' · '+esc(c.before.start):''}</p><p>אחרי: ${c.after.unscheduled?'ללא שיבוץ':fmtDate(c.after.date)} · ${duration(c.after.minutes)}${' · '+esc(c.after.start||'ללא שעה קבועה')}${c.after.planningLocked?' · מועד נעול':''}</p>${c.after.reserveUsedMinutes>c.before.reserveUsedMinutes?`<p>שימוש ב־${duration(c.after.reserveUsedMinutes-c.before.reserveUsedMinutes)} מתוך העתודה.</p>`:''}</div>`).join('')||'<p>אין שינוי בשיבוץ המשימות.</p>'}${Object.keys(options.capacities).length?`<h3>שינויי זמינות</h3><ul>${Object.entries(options.capacities).map(([date,n])=>`<li>${fmtDate(date)}: ${duration(engine().capacity(schedule,state,date))} ← ${duration(n)}</li>`).join('')}</ul>`:''}${progress?`<h3>עדכוני מצב שבחרת</h3><ul>${progress}</ul>`:''}</details><p class="hint">ניסיונות, הערות וסימוני שליטה נשמרים. חזרות קשורות עוברות עם המפגש. ${partial?'אפשר לתכנן מחדש את החומר שלא נכנס בכל עת.':''}</p><form id="catch-up-save"></form>`,`${noChanges?button('cancel','התוכנית מתאימה — חזרה ללימוד'):`<button class="button primary" type="submit" form="catch-up-save" ${p.errors.length||partial?'disabled':''}>${partial?'שמירת תוכנית חלקית':'שמירת התוכנית המעודכנת'}</button>`}${button('back-adjust','שינוי הזמן או הבחירות')}${button('cancel','יציאה ללא שינוי')}`);
 }
 function history(){
  const logs=state.settings.catchUpChanges||[];
  openDialog('catch-up-history','history','מה השתנה בתוכנית?',`<div id="plan-error" class="error" role="alert"></div>${logs.length?logs.slice().reverse().map(c=>`<article class="plan-change"><h3>${c.status==='undone'?'התאמה שבוטלה':c.partial?'נשמרה תוכנית חלקית':'נשמרה תוכנית מעודכנת'}</h3><p>${fmtDate(c.at.slice(0,10))} · ${c.changes.length} שינויים · ${c.unplacedIds.length} משימות ללא שיבוץ בזמן השמירה</p><details><summary>פירוט</summary><ul>${c.changes.map(x=>`<li>${esc(sessionOf(x.id)?.title||x.id)}: ${x.before.unscheduled?'ללא שיבוץ':fmtDate(x.before.date)} ← ${x.after.unscheduled?'ללא שיבוץ':fmtDate(x.after.date)}</li>`).join('')}</ul></details>${c.status==='applied'?button('undo-new','בדיקת אפשרות לביטול',`data-id="${c.id}"`):''}</article>`).join(''):'<p>עדיין לא נשמרה התאמה בתהליך החדש.</p>'}<p class="hint">ביטול אינו מוחק התקדמות. כשמועדים קודמים חלפו או פרטים נערכו מאז, מכינים המשך מהיום.</p><div class="dialog-actions">${button('repair','חוזרים למסלול')}${button('legacy-history','מחזורי לימוד ושינויים קודמים')}</div>`);
 }
 function backlog(){
  const pending=engine().effective(schedule,state).filter(s=>!s.disabled&&s.status!=='completed'&&s.unscheduled);
  return pending.length?`<section class="notice plan-backlog"><h3>${pending.length} משימות ללא שיבוץ</h3><p>הן עדיין חלק מההכנה ולא תופסות מקום ביומן.</p><details><summary>הצגת החומר שלא שובץ</summary><ul>${pending.map(s=>`<li><button class="text-link" data-action="session" data-id="${s.id}">${esc(s.title)}</button> · ${duration(engine().minutes(s))}</li>`).join('')}</ul></details>${button('repair','מציאת מקום לעבודה שנותרה')}</section>`:'';
 }
 function download(value,name){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 document.addEventListener('submit',async e=>{
  const f=e.target;if(!['catch-up-progress','catch-up-adjust','catch-up-save'].includes(f.id))return;e.preventDefault();
  const b=document.querySelector(`[form="${f.id}"][type="submit"]`);if(b)b.disabled=true;
  try{
   if(f.id==='catch-up-progress'){readProgress(f);calculate();if(draft.searchStatus==='complete'&&!draft.errors.length)review();else adjustments();}
   if(f.id==='catch-up-adjust'){readAdjustments();calculate();if(draft.errors.length)adjustments();else review();}
   if(f.id==='catch-up-save'){
    const proposal=draft,ack=$('#plan-partial-ack')?.checked||false,next=resultSessions()[0];
    await save(d=>Object.assign(d,engine().apply(schedule,d,proposal,new Date().toISOString(),ack)),'התוכנית נשמרה. תיעוד הלימוד נשמר.');
    activeDate=proposal.options.from;selectedDate=next?.date||activeDate;render();
    openDialog('catch-up-saved','saved','התוכנית נשמרה',`<p>${proposal.unplaced.length?`נשמרה תוכנית חלקית. ${proposal.unplaced.length} משימות נשארו ללא שיבוץ ומופיעות במבט על ובלוח הזמנים.`:'העבודה שנותרה שובצה לפי הזמן והבחירות שאישרת.'}</p>${next?`<section class="plan-next"><h3>המפגש הבא: ${esc(next.title)}</h3><p>${fmtDate(next.date)} · ${duration(next.minutes)}</p><button class="button primary" data-action="session" data-id="${next.id}">פתיחת המפגש הבא</button></section>`:''}<div class="dialog-actions">${button('calendar','צפייה בתוכנית')}${button('history','מה השתנה ואפשרויות ביטול')}</div>`);
   }
  }catch(error){showError(error);if(f.id==='catch-up-save')$('#plan-error')?.insertAdjacentHTML('beforeend',`<div>${button('refresh','טעינת הנתונים העדכניים והתחלה מחדש')}</div>`);}
  finally{if(b&&b.isConnected)b.disabled=f.id==='catch-up-save'&&(draft?.errors.length>0||draft?.unplaced.length>0&&!$('#plan-partial-ack')?.checked);}
 });
 document.addEventListener('change',e=>{if(e.target.id==='plan-partial-ack'){const b=document.querySelector('[form="catch-up-save"]');if(b)b.disabled=!!draft.errors.length||!e.target.checked;}});
 document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-plan-action]');if(!b)return;const {planAction:a,id}=b.dataset;b.disabled=true;
  try{
   if(a==='repair')repair();
   if(a==='back-progress'){readAdjustments();repair(false);}
   if(a==='back-adjust')adjustments();
   if(a==='cancel'){options=null;draft=null;closeDialog();}
   if(a==='calendar'){closeDialog();location.hash='schedule';}
   if(a==='history')history();if(a==='legacy-history')legacyHistory();
   if(a==='refresh'){state=await StudyStorage.exportState();render();repair();}
   if(a==='suggest-time'){
    readAdjustments();b.textContent='בודק חלונות נוספים…';await new Promise(resolve=>setTimeout(resolve,0));
    const suggestion=engine().suggestAvailability(schedule,state,options);options=suggestion.options;draft=suggestion.proposal;
    adjustments(suggestion.addedDates.length?`נוספו לטיוטה ${suggestion.addedDates.length} חלונות מוצעים. בדוק שהם באמת פנויים לך וערוך את הזמינות לפני השמירה.`:'לא נמצא חלון נוסף מתאים. אפשר לערוך את משך הימים הקיימים או את המועדים הנעולים.');
   }
   if(a==='activate'){await save(d=>{const fresh=StudyPlanningEngine.activateFresh(d,new Date().toISOString());Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,fresh);},'תוכנית נובמבר התחילה. התיעוד הקודם נשמר.');StudyCards.reset();activeDate=safeDate(dateNow());selectedDate=activeDate;closeDialog();render();}
   if(a==='prior')openDialog('prior','prior','התיעוד לפני ההתחלה מחדש',archiveView(state,'המצב הנוכחי'),'לקריאה בלבד');
   if(a==='export-history'){const item=state.settings.planHistory.find(x=>x.id===id);if(item)download(item.snapshot,'study-history-'+item.planId+'.json');}
   if(a==='undo-new'||a==='undo'){
    if(a==='undo'&&(state.settings.catchUpChanges||[]).some(c=>c.status==='applied'))throw new Error('נשמרה התאמה חדשה מאז. כדי לשנות את התכנון הישן, השתמש בחוזרים למסלול.');
    const planner=a==='undo-new'?engine():StudyPlanningEngine;planner.undo(schedule,state,id,new Date().toISOString());
    openDialog('plan-undo',id,'ביטול שינוי התכנון',`<p>המועדים והזמינות הקודמים יוחזרו רק אם הם עדיין תקינים. תיעוד הלימוד שנוסף מאז נשמר.</p><div id="plan-error" class="error" role="alert"></div><div class="dialog-actions">${button(a==='undo-new'?'confirm-undo-new':'confirm-undo','ביטול שינוי התכנון',`data-id="${id}"`)}${button('history','להשאיר כפי שעכשיו')}</div>`);
   }
   if(a==='confirm-undo-new'||a==='confirm-undo'){await save(d=>Object.assign(d,(a==='confirm-undo-new'?engine():StudyPlanningEngine).undo(schedule,d,id,new Date().toISOString())),'שינוי התכנון בוטל. תיעוד הלימוד נשמר.');history();}
  }catch(error){showError(error);}finally{if(b.isConnected)b.disabled=false;}
 });
 return {active,relevant,startPage,entry,history,repair,backlog};
})();

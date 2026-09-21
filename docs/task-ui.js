'use strict';
window.StudyTasks = (() => {
  const relatedCards = id => (flashcards?.cards||[]).filter(c=>c.unlockAfter.includes(id));
  function recallBudget(s){
    if(s.kind==='setup'||s.kind==='mock'||s.date==='2026-10-08')return 0;
    const candidates=sessionsOn(s.date).filter(x=>isCommitted(x)&&!['setup','mock'].includes(x.kind));
    return candidates.at(-1)?.id===s.id?Math.min(s.minutes,dayOf(s.date).kind==='deep'?10:5):0;
  }
  function open(id){
    const s=sessionOf(id);if(!s)return;
    const setup=s.kind==='setup',cards=relatedCards(id),budget=recallBudget(s),deps=dependencyIssues(s),pilot=StudyMeetings.enabled()&&!setup&&s.kind!=='mock';
    const primary=setup?'<button class="button primary" data-task-action="calendar">פתיחת לוח הזמנים</button>':`<button class="button primary" data-task-action="copy" data-id="${id}">העתקת בקשה ל־AI</button><button class="text-link" data-action="brief" data-id="${id}">הצגת הבקשה</button>`;
    const sources=setup?'':sessionSources(s);
    openDialog('session',id,s.title,`
      <div class="status-line">${tag(fmtDate(s.date))}${tag(timeLabel(s.minutes))}${isDone(s)?tag('המשימה הושלמה','green'):''}${s.learned?tag('החומר סומן כנלמד','green'):''}</div>
      <p class="task-goal">${esc(s.objective)}</p>
      ${!setup&&s.kind!=='mock'?StudyMeetings.taskSummary(id):''}
      <div class="task-main-actions">${primary}</div>
      ${!setup?'<p class="hint">מדביקים את הבקשה בשיחה עם AI שיש לו גישה לקובצי הקורס. היא כוללת את הנושא, המקורות והוראות הלימוד.</p>':''}
      ${deps.length?`<details class="task-details"><summary>לפני המשימה: ${deps.length} משימות קודמות עדיין פתוחות</summary><div class="source-links">${deps.map(x=>`<button class="source-link" data-action="session" data-id="${x.id}">${esc(x.title)}<span>פתיחה ←</span></button>`).join('')}</div></details>`:''}
      <h3>מה לעשות</h3><ol class="task-steps">${arr(s.steps).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
      <div class="finish-target"><strong>בסיום:</strong> ${arr(s.doneWhen).map(esc).join(' ')}</div>
      ${budget?`<div class="recall-budget"><span aria-hidden="true">▧</span><p>השאר את ${budget} הדקות האחרונות לכרטיסיות מחומר שכבר למדת. הן כלולות ב־${s.minutes} דקות המשימה, ולא מתווספות אליהן.</p><button class="text-link" data-task-action="cards">לכרטיסיות ←</button></div>`:''}
      ${sources?`<h3>הקבצים שצריך למשימה</h3><div class="source-links">${sources}</div>`:''}
      ${cards.length&&!setup?`<div class="notice neutral">בסיום אפשר לסמן שלמדת את החומר כדי לפתוח את הכרטיסיות המתאימות. כרטיסיות שדורשות נושאים נוספים ייפתחו אחרי שגם אותם תלמד.</div>`:''}
      ${arr(s.problemIds).length?`<details class="task-details"><summary>עדכון מצב הפתרון בשאלות של המשימה</summary><p class="hint">כאן אפשר לרשום אם פתרת בעזרה או לבד. אין צורך למלא זאת כדי לסמן שהמשימה הסתיימה.</p><div class="source-links">${s.problemIds.map(problemOf).filter(Boolean).map(p=>`<button class="source-link" data-action="problem" data-id="${p.id}">${esc(p.title)}<span>${esc(StudyMeetings.problemLabel(p.id,STATUS[problemStatus(p.id)]))} ←</span></button>`).join('')}</div></details>`:''}
    `,setup?'בדיקת התוכנית':'משימת לימוד');
    const footer=document.createElement('div');footer.className='task-fixed-actions';
    footer.innerHTML=`${!setup?`<button class="button primary task-copy-button" data-task-action="copy" data-id="${id}">העתקת בקשה ל־AI</button>`:''}<button class="button ${setup?'primary':''}" data-task-action="${pilot?'finish':isDone(s)?'reopen':'finish'}" data-id="${id}">${pilot?'עדכון מהמפגש':isDone(s)?'סמן כלא הושלם':'סיימתי את המשימה'}</button><button class="button" data-task-action="edit" data-id="${id}">${s.kind==='mock'?'שעה ותוצאות הסימולציה':'שינוי שעה או הוספת הערה'}</button>${isDone(s)&&cards.length?`<button class="text-link" data-task-action="learned" data-id="${id}">עדכון החומר שלמדתי</button>`:''}`;
    $('#dialog-content').append(footer);
  }
  function edit(id){
    const s=sessionOf(id);if(!s)return;
    openDialog('task-edit',id,'שינוי פרטי המשימה',`<p class="small-text muted">${esc(s.title)}</p><form id="session-form" data-id="${id}">${s.kind==='mock'?mockFields(s):''}<div class="form-grid" style="margin-top:18px"><div class="form-field"><label for="session-date">תאריך מתוכנן</label><input class="field-input" type="date" id="session-date" name="date" min="2026-09-21" max="2026-10-08" value="${s.date}" required></div><div class="form-field"><label for="session-time">שעת התחלה</label><input class="field-input" type="time" id="session-time" name="start" value="${esc(s.start||'')}"></div><div class="form-field"><label for="session-status">מצב המשימה</label><select class="field-input" id="session-status" name="status">${[['planned','מתוכננת'],['in-progress','התחלתי'],['completed','סיימתי']].map(([v,l])=>`<option value="${v}" ${(s.status||'planned')===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="form-field"><label for="actual-minutes">כמה דקות עבדת בפועל? (לא חובה)</label><input class="field-input" type="number" id="actual-minutes" name="actualMinutes" min="0" max="600" value="${s.actualMinutes??''}"></div><div class="form-field full"><label for="session-note">הערה לעצמך (לא חובה)</label><textarea class="field-input" id="session-note" name="note" placeholder="למשל: להמשיך מסעיף ב׳, או לחזור להסבר על אי־תלות.">${esc(s.note||'')}</textarea></div></div><div class="hint" id="move-impact">משך המשימה נשאר ${s.minutes} דקות. אפשר לבדוק כיצד השינוי משפיע על היום שבחרת.</div><div class="dialog-actions"><button class="button primary" type="submit">שמירת השינויים</button><button class="button" type="button" data-action="session" data-id="${id}">חזרה למשימה</button></div></form>`,'פרטים נוספים');
  }
  async function finish(id){
    const s=sessionOf(id);if(!s)return;
    if(s.kind==='setup'){
      await save(d=>{d.sessionUpdates[id]={...(d.sessionUpdates[id]||{}),status:'completed',updatedAt:new Date().toISOString()};},'בדיקת לוח הזמנים סומנה כהושלמה');closeDialog();return;
    }
    if(StudyMeetings.enabled()&&s.kind!=='mock'){StudyMeetings.open(id);return;}
    completionForm(s,false);
  }
  function completionForm(s,learningOnly){
    const cards=relatedCards(s.id);
    openDialog('task-complete',s.id,learningOnly?'עדכון החומר שלמדתי':'סיום המשימה',`<p>${esc(s.title)}</p><form id="task-complete-form" data-id="${s.id}" data-learning-only="${learningOnly}">${cards.length?`<label class="learned-choice"><input type="checkbox" name="learned" ${s.learned?'checked':''}><span><strong>למדתי את החומר — אפשר לפתוח כרטיסיות חזרה</strong><small>גם אם עדיין דרושה לך עזרה בפתרון. כרטיסיות שתלויות בנושאים נוספים ייפתחו לאחר שגם הם יסומנו כנלמדו.</small></span></label>`:'<p class="hint">הסימון מתעד את סיום המשימה. הוא אינו משנה את מצב הפתרון בשאלות.</p>'}${s.kind==='mock'?mockFields(s):''}${!learningOnly?`<details class="task-details" ${s.kind==='mock'?'open':''}><summary>רישום זמן והערה (לא חובה)</summary><div class="form-grid"><div class="form-field"><label for="finish-minutes">דקות בפועל</label><input class="field-input" id="finish-minutes" name="actualMinutes" type="number" min="0" max="600" value="${s.actualMinutes??''}"></div><div class="form-field full"><label for="finish-note">הערה לעצמך</label><textarea class="field-input" id="finish-note" name="note">${esc(s.note||'')}</textarea></div></div></details>`:''}<div class="dialog-actions"><button class="button primary" type="submit">${learningOnly?'שמירת הסימון':'שמירה וסיום'}</button><button class="button" type="button" data-action="session" data-id="${s.id}">חזרה למשימה</button></div></form>`,'עדכון קצר');
  }
  async function copy(id,button){
    const s=sessionOf(id);if(!s)return;
    try{await navigator.clipboard.writeText(promptForSession(s));markPromptCopied(button);notify('הבקשה הועתקה. עכשיו אפשר להדביק אותה בשיחה עם המורה.');}
    catch{showBrief(id);notify('ההעתקה לא הותרה בדפדפן. אפשר לסמן את הבקשה ולהעתיק ידנית.');}
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-task-action]');if(!b)return;
    const {taskAction:action,id}=b.dataset;b.disabled=true;
    try{
      if(action==='copy')await copy(id,b);
      if(action==='finish')await finish(id);
      if(action==='edit')edit(id);
      if(action==='learned')completionForm(sessionOf(id),true);
      if(action==='calendar'){closeDialog();location.hash='schedule';}
      if(action==='cards'){closeDialog();location.hash='flashcards';}
      if(action==='reopen'){await save(d=>{d.sessionUpdates[id]={...(d.sessionUpdates[id]||{}),status:'planned'};},'המשימה חזרה לרשימת המשימות הפתוחות');open(id);}
    }catch(e){notify(e.message);}finally{b.disabled=false;}
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;if(form.id!=='task-complete-form')return;event.preventDefault();
    const id=form.dataset.id,s=sessionOf(id),fields=Object.fromEntries(new FormData(form)),button=$('button[type=submit]',form),only=form.dataset.learningOnly==='true';button.disabled=true;
    try{
      await save(d=>{
        const update={...(d.sessionUpdates[id]||{}),updatedAt:new Date().toISOString()};
        if(!only){update.status='completed';update.actualMinutes=fields.actualMinutes===''?null:Number(fields.actualMinutes);update.note=fields.note||'';}
        if(relatedCards(id).length){update.learned=!!fields.learned;if(fields.learned)update.learnedAt=new Date().toISOString();}
        if(s.kind==='mock'&&!only)update.mock={uninterrupted:!!fields.mockUninterrupted,noHelp:!!fields.mockNoHelp,newQuestions:!!fields.mockNewQuestions,scores:[1,2,3].map(n=>fields['score'+n]===''?null:Number(fields['score'+n]))};
        d.sessionUpdates[id]=update;
      },fields.learned?'החומר סומן כנלמד. כרטיסיות נפתחות כשכל הנושאים הדרושים להן נלמדו.':only?'הסימון נשמר':'המשימה סומנה כהושלמה');
      closeDialog();
    }catch(e){notify(e.message);}finally{button.disabled=false;}
  });
  return {open,edit,recallBudget,relatedCards};
})();

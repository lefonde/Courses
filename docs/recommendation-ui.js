'use strict';
window.StudyRecommendations = (() => {
  const enabled = () => window.STUDY_CONFIG?.recommendationPilot === true;
  let preferences = {context:'planned', availableMinutes:60, focus:'focused'};
  let displayed = null;
  const button = (action,label,primary=false) => `<button class="button ${primary?'primary':''}" data-recommend-action="${action}">${label}</button>`;
  const session = (id,snapshot=state) => [...schedule.sessions,...(snapshot.settings.customSessions||[])].map(s=>({...s,...(snapshot.sessionUpdates[s.id]||{})})).find(s=>s.id===id);
  const propose = () => StudyRecommendationEngine.propose({curriculum,schedule,state,now:new Date().toISOString(),...preferences,availableMinutes:preferences.context==='planned'?300:preferences.availableMinutes});
  const identity = r => JSON.stringify([r.kind,r.sessionId,r.problemId,r.reviewId,r.budgetSessionId,r.minutes,r.reason,r.evidence]);
  const when = at => at ? new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at)) : '';
  const hasTarget = r => !!(r.sessionId||r.reviewId||r.problemId);

  function destination(r){
    if(r.reviewId)return r.kind==='review'
      ? {label:'פתח את החזרה · 10 דקות',description:'ייפתחו החלק שבחרת לתרגל, השאלה המקורית וההנחיות לחזרה.'}
      : {label:'פתח את פרטי החזרה',description:'ייפתחו פרטי החזרה והסיבה שבגללה אינה מוכנה לתרגול.'};
    if(r.sessionId)return {
      label:r.kind==='no-fit'?'פתח את פרטי המשימה':'פתח את המשימה',
      description:r.kind==='no-fit'?'ייפתחו פרטי המשימה. תוכל לראות כמה זמן היא דורשת ולשנות את המועד שלה.':'ייפתחו ההנחיות, המקורות והבקשה שאפשר להעתיק למורה AI.'
    };
    if(r.problemId)return {label:'פתח את שאלת התרגול',description:'ייפתחו המקור של השאלה והניסיונות שתיעדת בה.'};
    return {label:'פתח את לוח הזמנים',description:'בלוח הזמנים אפשר לראות את המשימות ולבחור מועד ללימוד.'};
  }
  function primary(r){return hasTarget(r)?button('open',destination(r).label,true):'<a href="#schedule" class="button primary">פתח את לוח הזמנים</a>';}
  function footer(markup){const node=document.createElement('div');node.className='task-fixed-actions recommendation-actions';node.innerHTML=markup;$('#dialog-content').append(node);}

  function card(){
    if(!enabled())return '';
    const r=propose(),d=destination(r);displayed=identity(r);
    return `<section class="panel hero recommendation-card" aria-label="הצעד הבא"><div><div class="status-line"><span class="eyebrow">${preferences.context==='now'?'מה אפשר לעשות בזמן שפינית?':'במה כדאי להתמקד במפגש הבא?'}</span>${r.minutes?tag(timeLabel(r.minutes)):''}</div><h2>${esc(r.title)}</h2><p>${esc(r.reason)}</p>${r.plannedAt?`<p class="recommend-date">${esc(when(r.plannedAt))}</p>`:''}${preferences.context==='now'?`<p class="hint">${preferences.availableMinutes} דקות · ${preferences.focus==='light'?'חזרה קלה':'למידה ופתרון בריכוז'}</p>`:''}</div><div class="recommend-next-action">${primary(r)}<p class="hint">${esc(d.description)}</p></div><div class="hero-bottom recommend-secondary"><button class="text-link" data-recommend-action="details">למה זו ההמלצה?</button><button class="text-link" data-recommend-action="context">${preferences.context==='now'?'שינוי הזמן הפנוי':'יש לי זמן פנוי עכשיו'}</button>${preferences.context==='now'?'<button class="text-link" data-recommend-action="reset-context">חזרה להמלצה לפי היומן</button>':''}</div></section>`;
  }
  function details(){
    if(!enabled())return;
    const r=propose(),target=session(r.sessionId),budget=session(r.budgetSessionId);displayed=identity(r);
    openDialog('recommendation','next','למה זו ההמלצה?',`<h3>${esc(r.title)}</h3><p class="recommend-reason">${esc(r.reason)}</p><dl class="recommend-facts">${r.plannedAt?`<div><dt>מתי יש לכך זמן בתוכנית?</dt><dd>${esc(when(r.plannedAt))}</dd></div>`:preferences.context==='now'?`<div><dt>הזמן שפינית</dt><dd>${preferences.availableMinutes} דקות</dd></div>`:''}${r.minutes?`<div><dt>משך הפעולה</dt><dd>${timeLabel(r.minutes)}</dd></div>`:''}${budget&&budget.id!==target?.id?`<div><dt>מה יקרה למשימה שכבר קבועה בשעה הזאת?</dt><dd>ביומן עדיין מופיעה ״${esc(budget.title)}״. ההמלצה היא ללמוד קודם את ״${esc(target?.title||r.title)}״. אם תבחר בכך, יהיה צורך לעדכן את היומן בנפרד.</dd></div>`:''}</dl><details class="recommend-records"><summary>על מה האתר הסתמך?</summary><ul class="recommend-evidence">${arr(r.evidence).map(line=>`<li>${esc(line)}</li>`).join('')}</ul></details>${arr(r.notices).length?`<p class="notice neutral">${arr(r.notices).map(esc).join('<br>')}</p>`:''}<p class="recommend-destination">${esc(destination(r).description)}</p>`,'הסבר לבחירת המשימה');
    footer(primary(r)+button('close','סגירת ההסבר'));
  }
  function context(){
    if(!enabled())return;
    openDialog('recommendation-context','context','כמה זמן פנוי יש לך עכשיו?',`<p>האתר יחפש משימה שמתאימה לזמן ולריכוז שלך.</p><form id="recommend-context-form"><div class="form-field"><label for="recommend-minutes">זמן פנוי</label><select class="field-input" id="recommend-minutes" name="availableMinutes">${[10,20,30,45,60,90,120,150,180].map(n=>`<option value="${n}" ${preferences.availableMinutes===n?'selected':''}>${n} דקות</option>`).join('')}</select></div><div class="form-field"><label for="recommend-focus">מה מתאים לך כרגע?</label><select class="field-input" id="recommend-focus" name="focus"><option value="focused" ${preferences.focus==='focused'?'selected':''}>למידה ופתרון בריכוז</option><option value="light" ${preferences.focus==='light'?'selected':''}>חזרה קלה בלבד</option></select></div><p class="hint">לאחר הלחיצה תופיע ההמלצה בעמוד הבית. שעות הלימוד ביומן יישארו כפי שקבעת.</p><p id="recommend-error" role="alert"></p></form>`,'בחירת משימה לזמן שהתפנה');
    footer('<button class="button primary" type="submit" form="recommend-context-form">הצג משימה שמתאימה לזמן הזה</button>'+button('close','ביטול'));
  }
  function openTarget(){
    const r=propose();
    if(displayed!==identity(r)){details();notify('ההמלצה השתנתה בעקבות הזמן או התיעוד החדש. ההסבר המעודכן מוצג לפני פתיחת המשימה.');return;}
    if(r.reviewId){StudyReviews.open(r.reviewId);return;}
    if(r.sessionId){StudyTasks.open(r.sessionId);return;}
    if(r.problemId){showProblem(r.problemId);return;}
    closeDialog();location.hash='schedule';render();
  }

  // The illustration stays in its own dialog. It never replaces the real dashboard.
  function exampleData(){
    const sample=StudyRecommendationDemos.create('review',schedule,curriculum);
    const r=StudyRecommendationEngine.propose({curriculum,schedule,state:sample.state,now:sample.now,context:'planned',availableMinutes:300,focus:'focused'});
    const review=sample.state.settings.questionReviews.entries.find(e=>e.id===r.reviewId);
    return {r,review,host:session(review.sessionId,sample.state),problem:problemOf(review.problemId)};
  }
  function example(){
    if(!enabled()||!window.STUDY_CONFIG.preview)return;
    const {review,host}=exampleData();
    openDialog('recommendation-example','example','איך האתר יעזור לי לבחור מה ללמוד?',`<p class="example-intro">זו דוגמה להמלצה שתופיע בעמוד הבית. אין צורך לפתור עכשיו שום שאלה.</p><section class="example-situation"><h3>נניח שזה המצב</h3><p>כבר למדת את החומר וניסית את שאלה 2 בממ״ן 12. קבעת לעצמך לחזור על חלק ממנה ב־4 באוקטובר: עשר דקות מתוך מפגש החזרה שלך, שנמשך ${host.minutes} דקות.</p></section><section class="example-recommendation"><span class="eyebrow">זו ההמלצה שתקבל</span><h3>להתחיל בחזרה שקבעת · 10 דקות</h3><p>${esc(review.target)}</p><p class="hint">אחרי עשר הדקות ממשיכים בשאר משימת החזרה. הזמן כבר כלול במפגש שקבעת.</p></section><p class="example-click-explanation">הכפתור למטה יציג דוגמה למסך שמסביר מה עושים בחזרה הזאת.</p>`,'דוגמה להסבר בלבד');
    footer(button('example-task','הצג דוגמה למסך החזרה',true)+button('close','סגירת הדוגמה'));
  }
  function exampleTask(){
    if(!enabled()||!window.STUDY_CONFIG.preview)return;
    const {review,problem}=exampleData();
    openDialog('recommendation-example-task','example-task','דוגמה למסך חזרה של 10 דקות',`<p class="example-intro">זו תצוגה לדוגמה בלבד. ההתקדמות שלך אינה משתנה.</p><section class="example-situation"><span class="eyebrow">על מה חוזרים?</span><h3>${esc(problem.title)}</h3><p>${esc(review.target)}</p></section><h3>מה עושים בעשר הדקות?</h3><ol class="example-steps"><li>פותחים את השאלה המקורית ומשאירים את הפתרון סגור.</li><li>מנסים לכתוב מהזיכרון את הדרך לחישוב שבחרת לחזור עליו.</li><li>משאירים כשתי דקות לבדיקה מול הפתרון או עם המורה, ורושמים מה עדיין צריך לתרגל.</li></ol><p class="hint">במסך החזרה הרגיל יהיו גם קישור לשאלה, בקשה להעתקה למורה וכפתור לתיעוד החזרה.</p>`,'דוגמה להסבר בלבד');
    footer(button('example-back','חזרה להסבר',true)+button('close','סגירת הדוגמה'));
  }

  document.addEventListener('submit',event=>{
    if(!enabled()||event.target.id!=='recommend-context-form')return;
    event.preventDefault();
    try{
      const values=Object.fromEntries(new FormData(event.target));
      const next={context:'now',availableMinutes:Number(values.availableMinutes),focus:values.focus};
      StudyRecommendationEngine.propose({curriculum,schedule,state,now:new Date().toISOString(),...next});
      preferences=next;displayed=null;closeDialog();render();
    }catch(error){$('#recommend-error').textContent=error.message;}
  });
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-recommend-action]');if(!b||!enabled())return;
    b.disabled=true;
    try{
      const a=b.dataset.recommendAction;
      if(a==='open')openTarget();
      if(a==='details')details();
      if(a==='context')context();
      if(a==='close')closeDialog();
      if(a==='example'||a==='demos'||a==='example-back')example();
      if(a==='example-task')exampleTask();
      if(a==='reset-context'){preferences={context:'planned',availableMinutes:60,focus:'focused'};displayed=null;closeDialog();render();}
    }catch(error){notify(error.message);}finally{b.disabled=false;}
  });
  return {enabled,card};
})();

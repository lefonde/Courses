'use strict';
window.StudyRecommendations = (() => {
  const enabled = () => window.STUDY_CONFIG?.recommendationPilot === true;
  let preferences = {context:'planned', availableMinutes:60, focus:'focused'}, demo = null, displayed = null;
  const button = (action,label,primary=false,extra='') => `<button class="button ${primary?'primary':''}" data-recommend-action="${action}" ${extra}>${label}</button>`;
  const session = (id, snapshot=demo?.state||state) => [...schedule.sessions,...(snapshot.settings.customSessions||[])].map(s=>({...s,...(snapshot.sessionUpdates[s.id]||{})})).find(s=>s.id===id);
  const propose = () => StudyRecommendationEngine.propose({curriculum,schedule,state:demo?.state||state,now:demo?.now||new Date().toISOString(),...preferences,availableMinutes:preferences.context==='planned'?300:preferences.availableMinutes});
  const identity = r => JSON.stringify([r.kind,r.sessionId,r.problemId,r.reviewId,r.budgetSessionId,r.minutes,r.reason,r.evidence]);
  function stillDisplayed(r){if(displayed===identity(r))return true;details();notify('הזמן או התיעוד השתנו, ולכן ההצעה עודכנה. בדוק אותה לפני פתיחת הפרטים.');return false;}
  const when = at => at ? new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at)) : '';
  const demoNote = () => demo ? `<p class="recommend-demo-note" role="status">הדגמה בלבד · ${esc(demo.label)}. ההמלצה משתמשת בנתונים זמניים, בלי לשנות את ההתקדמות שלך.</p>` : '';
  function footer(markup){const node=document.createElement('div');node.className='task-fixed-actions recommendation-actions';node.innerHTML=markup;$('#dialog-content').append(node);}
  function card(){
    if(!enabled())return '';
    const r=propose();
    return `<section class="panel hero recommendation-card" aria-label="הצעד הבא"><div>${demoNote()}<div class="status-line"><span class="eyebrow">${preferences.context==='now'?'הצעה לזמן שפינית עכשיו':'הצעה למפגש הבא'}</span>${r.minutes?tag(timeLabel(r.minutes)):''}</div><h2>${esc(r.title)}</h2><p>${esc(r.reason)}</p>${r.plannedAt?`<p class="recommend-date">${esc(when(r.plannedAt))} · לפי היומן השמור</p>`:''}${preferences.context==='now'?`<p class="hint">לפי בחירתך: ${preferences.availableMinutes} דקות · ${preferences.focus==='light'?'ריכוז לחזרה קלה':'ריכוז ללמידה ופתרון'}. הזמינות ביומן לא השתנתה.</p>`:''}<p class="hint">זו הצעה לבחירה, על סמך מה שתיעדת. פתיחתה אינה מתחילה תרגול ואינה משנה את התוכנית.</p></div><div class="hero-bottom">${button('details','לבדיקת ההצעה',true)}${button('context',preferences.context==='now'?'שינוי הזמן והריכוז':'יש לי זמן עכשיו')}<a href="#schedule" class="text-link">למפת הדרך</a>${demo?button('end-demo','יציאה מההדגמה'):''}</div></section>`;
  }
  function details(){
    if(!enabled())return;
    const r=propose(), target=session(r.sessionId), budget=session(r.budgetSessionId), p=problemOf(r.problemId);displayed=identity(r);
    openDialog('recommendation','next',r.title,`${demoNote()}<p class="recommend-reason">${esc(r.reason)}</p><dl class="recommend-facts"><div><dt>הזמן שעליו מתבססת ההצעה</dt><dd>${r.plannedAt?esc(when(r.plannedAt)):preferences.context==='now'?`${preferences.availableMinutes} דקות שפינית עכשיו`:'לא נמצא חלון מתאים ביומן'}</dd></div>${r.minutes?`<div><dt>הזמן הדרוש לפעולה</dt><dd>${timeLabel(r.minutes)}</dd></div>`:''}${target?`<div><dt>המשימה שאליה ההצעה מפנה</dt><dd>${esc(target.title)}</dd></div>`:''}${budget&&budget.id!==target?.id?`<div><dt>החלון שנבדק ביומן</dt><dd>${esc(budget.title)}. זו הצעה לשקול את סדר העבודה; המשימות עדיין במקומן המקורי.</dd></div>`:''}</dl><h3>למה ההצעה הזאת?</h3><ul class="recommend-evidence">${arr(r.evidence).map(line=>`<li>${esc(line)}</li>`).join('')}</ul>${arr(r.notices).length?`<div class="notice neutral">${arr(r.notices).map(esc).join('<br>')}</div>`:''}${p?`<div class="source-links">${sourceLink(p.sourceId,p.pages)}</div>`:''}<p class="hint">לא נשמר כאן שינוי בלמידה או ביומן. אפשר לפתוח את הפרטים, לבחור אחרת, או לחזור לתוכנית המקורית.</p><p id="recommend-error" role="alert"></p>`,'המלצה עם נימוק');
    footer(`${r.sessionId||r.reviewId||r.problemId?button('open',r.actionLabel||'פתיחת הפרטים',true):'<a href="#schedule" class="button primary">בדיקת לוח הזמנים</a>'}${r.sessionId||r.reviewId||r.problemId?button('copy','העתקת ההמלצה למורה'):''}${button('context','שינוי הזמן והריכוז')}${button('close','חזרה בלי לשנות')}`);
  }
  function context(){
    if(!enabled())return;
    openDialog('recommendation-context','context','לאיזה זמן להתאים את ההצעה?',`${demoNote()}<form id="recommend-context-form"><fieldset class="recommend-context-choice"><legend>מתי תרצה ללמוד?</legend><label><input type="radio" name="context" value="planned" ${preferences.context==='planned'?'checked':''}> בחלון הלימוד הבא שכבר קבוע ביומן</label><label><input type="radio" name="context" value="now" ${preferences.context==='now'?'checked':''}> התפנה לי זמן עכשיו</label></fieldset><div class="form-field"><label for="recommend-minutes">כמה דקות פנויות לך עכשיו?</label><select class="field-input" id="recommend-minutes" name="availableMinutes" ${preferences.context==='planned'?'disabled':''}>${[10,20,30,45,60,90,120,150,180].map(n=>`<option value="${n}" ${preferences.availableMinutes===n?'selected':''}>${n} דקות</option>`).join('')}</select></div><div class="form-field"><label for="recommend-focus">מה רמת הריכוז המתאימה כרגע?</label><select class="field-input" id="recommend-focus" name="focus"><option value="focused" ${preferences.focus==='focused'?'selected':''}>יכול ללמוד ולפתור בריכוז</option><option value="light" ${preferences.focus==='light'?'selected':''}>מתאים לי רק תרגול קל או חזרה</option></select></div><p class="hint">הבחירה משנה רק את ההמלצה המוצגת. היא אינה מאשרת חלון עבודה מותנה, מזיזה משימה או מוסיפה זמן ליומן. רענון מחזיר את ברירת המחדל.</p><p id="recommend-error" role="alert"></p></form>`,'העדפה למפגש הזה');
    footer('<button class="button primary" type="submit" form="recommend-context-form">הצגת המלצה מתאימה</button>'+button('close','ביטול'));
  }
  function openTarget(){
    const r=propose();
    if(!stillDisplayed(r))return;
    if(demo){
      const s=session(r.sessionId||r.budgetSessionId), p=problemOf(r.problemId), review=demo.state.settings.questionReviews?.entries.find(e=>e.id===r.reviewId);
      openDialog('recommendation-demo-target','target','כאן נפתחים פרטי הפעולה',`${demoNote()}<h3>${esc(s?.title||p?.title||r.title)}</h3><p>${esc(review?.target||s?.objective||r.reason)}</p>${p?sourceLink(p.sourceId,p.pages):''}<p>בנתונים הרגילים הכפתור פותח את ${r.reviewId?'החזרה שכבר שובצה':'פרטי המשימה'}, עם המקורות והפעולות הקיימות. בהדגמה מוצגים הפרטים לקריאה בלבד.</p>`,'פתיחת פרטים — הדגמה');
      footer(button('details','חזרה להצעה',true)+button('demos','בדיקת מצב אחר')+button('end-demo','יציאה מההדגמה'));return;
    }
    if(r.reviewId){StudyReviews.open(r.reviewId);return;}
    if(r.sessionId){StudyTasks.open(r.sessionId);return;}
    if(r.problemId){showProblem(r.problemId);return;}
    closeDialog();location.hash='schedule';render();
  }
  async function copy(b){
    const r=propose(),s=session(r.sessionId),p=problemOf(r.problemId);
    if(!stillDisplayed(r))return;
    const text=`${demo?'זוהי הדגמת ממשק בנתונים מדומים, לא תיאור של מצבי האישי.\n':''}אני מתכונן לבחינה באלגוריתמים אקראיים. האתר הציע לי את הפעולה הבאה:\n${r.title}\n${r.reason}\n${r.minutes?`זמן הפעולה לפי התוכנית: ${r.minutes} דקות.\n`:''}${preferences.context==='now'?`דיווחתי שיש לי ${preferences.availableMinutes} דקות עכשיו.\n`:r.plannedAt?`החלון שנבחן: ${when(r.plannedAt)}.\n`:''}הבסיס להצעה:\n${arr(r.evidence).join('\n')}\n${arr(r.notices).join('\n')}\n${s?`משימה: ${s.title}.\n`:''}${p?`שאלה: ${p.title}. מקור: ${sourceOf(p.sourceId)?.path}, עמודי PDF ${arr(p.pages).join(', ')}.\n`:''}זו המלצה בלבד; לא שיניתי את היומן ולא אישרתי שליטה בחומר. לפני תחילת הוראה, עזור לי לוודא שהפעולה מתאימה לפער ולזמן. השתמש במקורות הקורס; אם אינם זמינים אל תמציא את נוסחם. דבר בעברית ברורה, הסבר סימון, ובדוק אם חסר לי ידע או זיכרון. אל תציג פתרון לפני ניסיון ואל תמשיך מעבר לחלק שבחרתי.`;
    try{await navigator.clipboard.writeText(text);markPromptCopied(b);notify('ההמלצה והנימוק הועתקו.');}catch{openDialog('recommendation-prompt','copy','ההמלצה להעתקה',`<textarea class="prompt-preview prompt-textarea" id="prompt-text" readonly rows="12">${esc(text)}</textarea>`);footer('<button class="button primary" data-action="copy-prompt">העתקת הבקשה</button><button class="text-link" data-action="select-prompt">בחירת כל הטקסט</button>'+button('details','חזרה להצעה'));}
  }
  function demos(){
    if(!enabled()||!window.STUDY_CONFIG.preview)return;
    openDialog('recommendation-demos','demos','בדיקת ההמלצות בלי לשנות התקדמות','<p>בכל מצב מוצגים נתוני דמה והמלצה אחת שנובעת מהם. אפשר לשנות את הזמן והריכוז ולבדוק כיצד ההמלצה משתנה.</p><div class="recommend-demo-list">'+[['prerequisite','חסר בסיס לפני המשימה הבאה','המשימה סומנה כהושלמה, אבל החומר עוד לא סומן כנלמד.'],['review','הגיעה חזרה שכבר שובצה','עשר דקות שמורות בתוך משימת תרגול קיימת.'],['difficulty','אותו קושי הופיע בשני ניסיונות','שני ניסיונות מתועדים בשאלה שכבר נלמדה.'],['moved','משימת החזרה הוזזה','המועד המקורי כבר אינו תואם את היומן.']].map(([id,title,description])=>`<button class="source-link" data-recommend-action="demo-case" data-id="${id}"><span><strong>${title}</strong><small>${description}</small></span><span>←</span></button>`).join('')+'</div>','תרחישי בדיקה');
    footer(button('close','חזרה בלי לשנות'));
  }
  function startDemo(id){
    if(!window.STUDY_CONFIG.preview)return;
    demo=StudyRecommendationDemos.create(id,schedule,curriculum);
    preferences={context:'planned',availableMinutes:60,focus:'focused'};
    closeDialog();location.hash='overview';render();
  }
  document.addEventListener('submit',event=>{if(!enabled()||event.target.id!=='recommend-context-form')return;event.preventDefault();try{const values=Object.fromEntries(new FormData(event.target));const next={context:values.context,availableMinutes:values.context==='now'?Number(values.availableMinutes):preferences.availableMinutes,focus:values.focus};StudyRecommendationEngine.propose({curriculum,schedule,state:demo?.state||state,now:demo?.now||new Date().toISOString(),...next,availableMinutes:next.context==='planned'?300:next.availableMinutes});preferences=next;displayed=null;closeDialog();render();}catch(error){$('#recommend-error').textContent=error.message;}});
  document.addEventListener('change',event=>{if(!enabled()||event.target.form?.id!=='recommend-context-form'||event.target.name!=='context')return;$('#recommend-minutes').disabled=event.target.value==='planned';});
  document.addEventListener('click',async event=>{const b=event.target.closest('[data-recommend-action]');if(!b||!enabled())return;b.disabled=true;try{const a=b.dataset.recommendAction;if(a==='details')details();if(a==='context')context();if(a==='open')openTarget();if(a==='copy')await copy(b);if(a==='close')closeDialog();if(a==='demos')demos();if(a==='demo-case')startDemo(b.dataset.id);if(a==='end-demo'){demo=null;preferences={context:'planned',availableMinutes:60,focus:'focused'};closeDialog();render();notify('ההדגמה הסתיימה. ההתקדמות השמורה לא השתנתה.');}}catch(error){notify(error.message);}finally{b.disabled=false;}});
  return {enabled,card};
})();

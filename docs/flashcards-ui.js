'use strict';
window.StudyCards = (() => {
  let training=null, busy=false, topicFilter='all';
  const cards=()=>flashcards?.cards||[];
  const progress=()=>state.settings.flashcards?.progress||{};
  const now=()=>new Date().toISOString();
  const engine=()=>window.FlashcardsEngine;
  function options(){
    const base=engine().summary(cards(),progress(),state.sessionUpdates,now());
    return {dailyLimit:state.settings.flashcards?.dailyLimit||base.suggestedDailyNew,examDateISO:'2026-10-08'};
  }
  const summary=()=>engine().summary(cards(),progress(),state.sessionUpdates,now(),options());
  const unlocked=c=>engine().unlocked(c,state.sessionUpdates);
  function dueLabel(value){
    if(!value)return 'אין חזרה מתוזמנת נוספת לפני הבחינה';
    const date=new Date(value),remaining=date-Date.now();
    if(remaining<=0)return 'מועד החזרה הגיע';
    const mins=Math.max(1,Math.ceil(remaining/60000));
    if(mins<60)return `בעוד ${mins} דקות`;
    const localDay=engine().dayKey(value),today=engine().dayKey(now());
    if(localDay===today)return `היום ב־${date.toLocaleTimeString('he-IL',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit'})}`;
    return date.toLocaleString('he-IL',{timeZone:'Asia/Jerusalem',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  function plannedReview(previous,rating,at,extra){
    const next=engine().scheduleReview(previous,rating,at);
    // Preview and save use the same early-review rule.
    if(extra&&previous?.dueAt&&Date.parse(previous.dueAt)>Date.parse(at)){
      if(rating==='good'){
        next.dueAt=previous.dueAt;next.stage=previous.stage||0;next.streak=previous.streak||0;
        next.finalReview=!!previous.finalReview;next.reason=previous.reason||'scheduled';
      }else if(next.dueAt&&Date.parse(previous.dueAt)<Date.parse(next.dueAt)){
        next.dueAt=previous.dueAt;next.finalReview=!!previous.finalReview;next.reason=previous.reason||'scheduled';
      }
    }
    return next;
  }
  function homeCard(){
    const s=summary();return `<section class="panel home-recall"><div><span class="eyebrow">חזרה קצרה</span><h3>${s.unlocked?`${s.queueSize} כרטיסיות זמינות לחזרה`:'כרטיסיות מחומר שכבר למדת'}</h3><p>${s.unlocked?'אפשר להתחיל בסבב של חמש כרטיסיות. התשובות מוסתרות עד שתנסה להיזכר.':'בסיום משימת לימוד סמן ״למדתי את החומר״. הכרטיסיות המתאימות יתווספו לכאן.'}</p></div><a class="button" href="#flashcards">לכרטיסיות החזרה ←</a></section>`;
  }
  function render(){
    if(training)return renderTraining();
    const s=summary(),limit=options().dailyLimit,visibleTopics=curriculum.topics.filter(t=>topicFilter==='all'||t.id===topicFilter);
    return heading('כרטיסיות חזרה','נסה לענות מהזיכרון, חשוף את התשובה והשווה. אחר כך סמן כמה הצלחת לזכור — ולפי זה תיקבע החזרה הבאה.',`<button class="button small" data-cards-action="learned">סימון חומר שכבר למדתי</button>`)+
      `<div class="recall-summary"><div><strong>${s.unlocked}<small> / ${s.total}</small></strong><span>כרטיסיות שנפתחו</span></div><div><strong>${s.dueReviews}</strong><span>הגיע הזמן לחזור עליהן</span></div><div><strong>${Math.min(s.newAvailable,s.newRemainingToday)}</strong><span>חדשות לסבב של היום</span></div><div><strong>${s.reviewedToday}</strong><span>כרטיסיות שתרגלת היום</span></div></div>`+
      `<section class="panel recall-start"><div><span class="eyebrow">${s.unlocked?'כמה דקות פנויות?':'פותחים כרטיסיות אחרי הלימוד'}</span><h2>${s.horizonEnded?(s.queueSize?'נותרו חזרות אחרונות זמינות':'לא נקבעות חזרות חדשות'):s.queueSize?'נתחיל בחמש כרטיסיות':!s.unlocked?'עדיין לא סימנת חומר כנלמד':'אין כרגע חזרות שהגיע מועדן'}</h2><p>${s.horizonEnded?'התזמון לקראת הבחינה הסתיים: לא נקבעות חזרות נוספות. כרטיסיות שכבר הגיע מועדן נשארות בתור עד שתתרגל אותן. אפשר גם לבחור תרגול נוסף מהחומר שנלמד.':s.queueSize?`${s.dueReviews} לחזרה ו־${Math.min(s.newAvailable,s.newRemainingToday)} חדשות זמינות היום. אפשר לעצור בסוף כל כרטיסייה; כל תשובה נשמרת מיד.`:!s.unlocked?'הכרטיסיות נשארות סגורות כדי שלא תישאל על חומר שעוד לא למדת. בסיום משימה תוכל לפתוח אותן. אם כבר למדת נושא בעבר, אפשר לסמן זאת כאן.':s.newAvailable?'הגעת למכסת הכרטיסיות החדשות של היום. אפשר להוסיף עוד בסבב יזום, אם יש לך זמן.':'החזרות הבאות כבר נקבעו. אם מתפנה זמן, אפשר לתרגל שוב גם לפני המועד.'}</p></div><div class="stack">${s.queueSize?`<button class="button primary" data-cards-action="start">תרגול 5 כרטיסיות</button>`:''}${s.unlocked?'<button class="button" data-cards-action="extra">תרגול נוסף מהחומר שנלמד</button>':'<button class="button primary" data-cards-action="learned">כבר למדתי נושא — לסימון</button>'}</div></section>`+
      `<details class="recall-rules"><summary>איך נקבעות החזרות והזמן שלהן?</summary><div><p>לא זכרת? הכרטיסייה תחזור בעוד כ־10 דקות. זכרת חלקית? בעוד כ־6 שעות. זכרת והסברת? בדרך כלל אחרי יום, אחר כך יומיים ואז ארבעה. בשבוע האחרון המרווחים מתקצרים.</p><p>לא נקבעת חזרה אחרי 7.10 בשעה 20:00. כרגע מוקצות עד ${limit} כרטיסיות חדשות ביום; המכסה האוטומטית יכולה לעלות עד 12 כשצריך להספיק לפני הבחינה. זו ברירת מחדל לתכנון, לא מדד לשליטה.</p><p>חמש עד עשר דקות חזרה כלולות במשימה האחרונה של ימי הלימוד. סבב נוסף בזמנך הפנוי הוא לבחירתך. אם הצטברו כרטיסיות, הן נשארות בתור; אין צורך לסיים הכול בישיבה אחת.</p><p>תרגול נוסף לפני המועד אינו דוחה חזרה קיימת. תשובה שלא זכרת יכולה להקדים אותה.</p></div></details>`+
      `${s.newAvailable>s.newRemainingToday?`<div class="notice neutral">${s.newAvailable} כרטיסיות שנפתחו עדיין לא נוסו. היום יוצגו עד ${Math.min(s.newAvailable,s.newRemainingToday)} מהן, לצד חזרות קודמות. הכרטיסיות הסגורות אינן חלק מהתור.</div>`:''}`+
      `<div class="section-head"><h2>החומר בכרטיסיות</h2><select class="field-input" id="cards-topic-filter" aria-label="סינון כרטיסיות לפי נושא"><option value="all">כל הנושאים</option>${curriculum.topics.map(t=>`<option value="${t.id}" ${topicFilter===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</select></div><div class="topic-grid">${visibleTopics.map(topic=>topicCard(topic)).join('')}</div>`;
  }
  function topicCard(topic){
    const items=cards().filter(c=>c.topicId===topic.id),open=items.filter(unlocked),seen=open.filter(c=>progress()[c.id]?.reviews),nextDates=open.map(c=>progress()[c.id]?.dueAt).filter(Boolean).sort();
    const missing=[...new Set(items.flatMap(c=>engine().blockedReasons(c,state.sessionUpdates)))].map(sessionOf).filter(Boolean);
    return `<article class="panel recall-topic"><span class="eyebrow">${open.length?'חומר שנלמד':'טרם נפתח לתרגול'}</span><h3>${esc(topic.title)}</h3><p>${open.length} מתוך ${items.length} פתוחות · ${seen.length} כבר נוסו</p>${nextDates.length?`<p class="hint">החזרה הקרובה: <bdi>${esc(dueLabel(nextDates[0]))}</bdi></p>`:''}${missing.length?`<details class="task-details"><summary>מה צריך ללמוד כדי לפתוח את היתר?</summary><ul class="plain-list">${missing.map(s=>`<li><button class="text-link" data-action="session" data-id="${s.id}">${esc(s.title)} ←</button></li>`).join('')}</ul></details>`:''}<div class="dialog-actions">${open.length?`<button class="button small" data-cards-action="topic" data-id="${topic.id}">תרגול בנושא</button>`:''}<button class="text-link" data-cards-action="learned" data-id="${topic.id}">${open.length?'עדכון החומר שנלמד':'כבר למדתי חלק מהחומר'}</button></div></article>`;
  }
  function start(topicId=null,extra=false){
    const scoped=cards().filter(c=>!topicId||c.topicId===topicId);
    let queue=engine().dueCards(scoped,progress(),state.sessionUpdates,now(),options());
    if(extra){
      const ids=new Set(queue.map(c=>c.id));
      const other=scoped.filter(c=>unlocked(c)&&!ids.has(c.id)).sort((a,b)=>{
        const ar=progress()[a.id],br=progress()[b.id];
        return Number(!!ar?.reviews)-Number(!!br?.reviews)||(ar?.lastReviewedAt||'').localeCompare(br?.lastReviewedAt||'')||a.order-b.order;
      });queue=queue.concat(other);
    }
    if(!queue.length){notify('אין כרגע כרטיסיות פתוחות לסבב הזה.');return;}
    training={queue:queue.slice(0,5).map(c=>c.id),index:0,revealed:false,extra,topicId,ratings:[],finished:false};location.hash='flashcards';renderPage();
  }
  function renderPage(){if(page==='flashcards')main.innerHTML=render();}
  function safeMath(raw){
    try{
      const doc=new DOMParser().parseFromString(raw,'application/xml'),root=doc.documentElement;
      const allowed=new Set(['math','mrow','mi','mn','mo','mtext','msub','msup','msubsup','mfrac','msqrt','mroot','munder','mover','munderover','mtable','mtr','mtd','mfenced','mspace','mstyle']);
      if(root.localName!=='math'||doc.querySelector('parsererror'))return '';
      for(const el of [root,...root.querySelectorAll('*')]){
        if(!allowed.has(el.localName))return '';
        for(const attr of [...el.attributes])if(!['xmlns','display','mathvariant','stretchy','accent','accentunder','linethickness','columnalign','rowspacing','columnspacing','width','height','depth','dir'].includes(attr.name))el.removeAttribute(attr.name);
      }
      root.setAttribute('display','block');root.setAttribute('dir','ltr');return new XMLSerializer().serializeToString(root);
    }catch{return '';}
  }
  function renderTraining(){
    if(training.finished)return renderFinished();
    const c=cards().find(x=>x.id===training.queue[training.index]);
    if(!c||!unlocked(c)){training=null;return render();}
    const old=progress()[c.id];
    const kinds={definition:'הגדרה',conditions:'תנאי שימוש',proof:'רעיון הוכחה',method:'דרך פתרון'};
    return heading('תרגול קצר',`כרטיסייה ${training.index+1} מתוך ${training.queue.length}. אפשר לענות בקול או על דף; אין צורך להקליד.`,`<button class="button small" data-cards-action="stop">עצירה וחזרה לרשימה</button>`)+
      `<section class="recall-card panel"><div class="row-between"><div class="status-line">${tag(topicOf(c.topicId)?.title||c.topicId)}${tag(kinds[c.kind]||'חזרה')}</div><span class="small-text muted"><bdi>${training.index+1} / ${training.queue.length}</bdi></span></div><h2 class="recall-question">${esc(c.question)}</h2>${!training.revealed?`<p class="recall-instruction">נסה להיזכר לפני שאתה פותח את התשובה. אם אינך זוכר, זה הזמן לראות מה צריך לחזור עליו.</p><button class="button primary reveal-answer" data-cards-action="reveal">הצגת התשובה</button>`:`<div class="recall-answer"><span class="eyebrow">תשובה לבדיקה</span>${arr(c.answer).map(p=>`<p>${esc(p)}</p>`).join('')}${arr(c.formulas).map(f=>`<div class="flash-equation">${f.mathml?safeMath(f.mathml):''}${f.meaning?`<p>${esc(f.meaning)}</p>`:''}</div>`).join('')}</div><details class="task-details"><summary>פתיחת המקור בקורס</summary><div class="source-links">${arr(c.sourceRefs).map(r=>sourceLink(r.sourceId,r.pages)).join('')}</div></details><div class="recall-grade"><h3>איך הייתה התשובה שלך לפני ההצצה?</h3><div class="rating-buttons">${[['again','לא זכרתי'],['hard','זכרתי חלקית'],['good','זכרתי והסברתי']].map(([r,l])=>{const next=plannedReview(old,r,now(),training.extra);return `<button class="rating-button ${r}" data-cards-action="rate" data-rating="${r}" ${busy?'disabled':''}><strong>${l}</strong><small>${esc(dueLabel(next.dueAt))}</small></button>`;}).join('')}</div><p class="hint">הסימון הוא הערכה שלך אחרי השוואה לתשובה. כרטיסייה שנזכרה אינה מסמנת ששאלת בחינה שלמה נפתרה.</p></div>`}</section>`;
  }
  function renderFinished(){
    const total=training.ratings.length,again=training.ratings.filter((rating,i)=>rating==='again'&&progress()[training.queue[i]]?.dueAt).length,s=summary();
    return heading('הסבב נשמר',`תרגלת ${total} כרטיסיות. הדירוגים ומועדי החזרה נשמרו באתר.`)+`<section class="panel recall-finished"><span class="finish-check" aria-hidden="true">✓</span><h2>${again?`${again} כרטיסיות יחזרו בקרוב כדי לנסות שוב`:s.horizonEnded?'הסבב הסתיים; לא נקבעו חזרות נוספות':'מועדי החזרה הבאים נקבעו'}</h2><p>${s.horizonEnded?'אפשר לעצור כאן או לבחור תרגול נוסף לפי הצורך. לא נוספו מועדי חזרה אחרי תקופת ההכנה.':'אין צורך לחזור על הכול עכשיו. כרטיסיות חדשות יתווספו ככל שתסמן חומר נוסף כנלמד.'}</p><div class="dialog-actions">${s.queueSize?'<button class="button primary" data-cards-action="start">עוד 5 כרטיסיות מהתור</button>':''}<button class="button" data-cards-action="stop">חזרה לרשימת הנושאים</button></div></section>`;
  }
  async function rate(rating){
    if(busy||!training?.revealed||training.finished)return;busy=true;renderPage();
    const activeTraining=training,id=activeTraining.queue[activeTraining.index],previous=progress()[id],at=now(),next=plannedReview(previous,rating,at,activeTraining.extra);
    try{
      await save(d=>{d.settings.flashcards||={};d.settings.flashcards.progress||={};d.settings.flashcards.progress[id]=next;});
      if(training===activeTraining){
        activeTraining.ratings.push(rating);activeTraining.index++;activeTraining.revealed=false;
        if(activeTraining.index>=activeTraining.queue.length)activeTraining.finished=true;
      }
    }catch(e){notify(e.message);}finally{busy=false;renderPage();}
  }
  function learnedDialog(topicId=null){
    const relevant=cards().filter(c=>!topicId||c.topicId===topicId),ids=new Set(relevant.flatMap(c=>c.unlockAfter));
    const sessions=allSessions().filter(s=>ids.has(s.id));
    openDialog('cards-learned',topicId||'all','איזה חומר כבר למדת?',`<p>סמן נושאים שקראת ולמדת, גם אם אתה עדיין זקוק לעזרה בתרגילים. אל תסמן נושא רק מפני ששמו מוכר לך.</p><p class="hint">הסימון פותח כרטיסיות. הוא אינו מסמן משימות כגמורות או שאלות כפתורות.</p><form id="cards-learned-form"><div class="learned-list">${sessions.map(s=>`<label class="learned-item"><input type="checkbox" name="learned-session" value="${s.id}" ${s.learned?'checked':''}><span><strong>${esc(s.title)}</strong><small>${esc(topicOf(s.topicId)?.title||'')}</small></span></label>`).join('')}</div><div class="notice neutral" id="learned-preview">${summary().unlocked} כרטיסיות פתוחות כרגע. כרטיסייה תיפתח רק כשכל החומר שהיא דורשת מסומן.</div><div class="dialog-actions"><button class="button primary" type="submit">שמירת החומר שנלמד</button><button class="button" type="button" data-action="close">ביטול</button></div></form>`,'פתיחת כרטיסיות בהדרגה');
    $('#cards-learned-form').dataset.sessionIds=JSON.stringify(sessions.map(s=>s.id));
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-cards-action]');if(!b)return;const {cardsAction:a,id,rating}=b.dataset;
    if(a==='start')start();
    if(a==='extra')start(null,true);
    if(a==='topic')start(id,true);
    if(a==='reveal'&&training){training.revealed=true;renderPage();}
    if(a==='rate')await rate(rating);
    if(a==='stop'){training=null;renderPage();}
    if(a==='learned')learnedDialog(id||null);
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='cards-topic-filter'){topicFilter=event.target.value;renderPage();}
    if(event.target.name==='learned-session'){
      const form=$('#cards-learned-form'),updates=clone(state.sessionUpdates),ids=JSON.parse(form.dataset.sessionIds),chosen=new Set(new FormData(form).getAll('learned-session'));
      ids.forEach(id=>{updates[id]={...(updates[id]||{}),learned:chosen.has(id)};});
      $('#learned-preview').textContent=`לאחר השמירה יהיו ${cards().filter(c=>engine().unlocked(c,updates)).length} כרטיסיות פתוחות. החומר שטרם למדת יישאר סגור.`;
    }
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;if(form.id!=='cards-learned-form')return;event.preventDefault();const chosen=new Set(new FormData(form).getAll('learned-session')),ids=JSON.parse(form.dataset.sessionIds),button=$('button[type=submit]',form);button.disabled=true;
    try{await save(d=>{ids.forEach(id=>{d.sessionUpdates[id]={...(d.sessionUpdates[id]||{}),learned:chosen.has(id),learnedAt:chosen.has(id)?now():null};});},'החומר שנלמד נשמר. הכרטיסיות המתאימות נפתחו.');closeDialog();}catch(e){notify(e.message);}finally{button.disabled=false;}
  });
  return {render,homeCard,summary,start,learnedDialog,reset:()=>{training=null;}};
})();

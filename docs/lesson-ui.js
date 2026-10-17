'use strict';
window.StudyLessons=(()=>{
  const lessons=StudyLessonContent.lessons;
  const lessonFor=id=>lessons.find(l=>l.sessionId===id);
  const has=id=>!!lessonFor(id);
  const route=(id,section)=>'#lesson/'+encodeURIComponent(id)+(section?'/'+encodeURIComponent(section):'');
  const pending=new Map();
  let timer,writing=null,lastError='';
  const key=(id,section)=>id+'/'+section;
  const read=(l,s)=>({...StudyLessonEngine.section(state,l,s),...(pending.get(key(l.sessionId,s))?.patch||{})});
  const saved=l=>StudyLessonEngine.session(state,l);
  const validSection=(l,id)=>l.sections.find(s=>s.id===id)||l.sections[0];
  function parse(){
    const match=location.hash.match(/^#lesson\/([^/]+)(?:\/([^/]+))?$/);
    if(!match)return null;
    try{const lesson=lessonFor(decodeURIComponent(match[1]));if(!lesson)return null;return {lesson,section:validSection(lesson,match[2]?decodeURIComponent(match[2]):saved(lesson).currentSection)};}catch(error){lastError=error.message;return null;}
  }
  function status(text,error=false){
    const node=$('#lesson-save-state');if(node){node.textContent=text;node.classList.toggle('error',error);}
    const recovery=$('#lesson-save-recovery');if(recovery)recovery.hidden=!error;
  }
  function queue(l,section,patch={}){
    const k=key(l.sessionId,section),old=pending.get(k);
    const merged={...old?.patch,...patch};
    if(old?.patch.hints)merged.hints=Math.max(old.patch.hints,merged.hints||0);
    pending.delete(k); // Preserve the latest visit, including A → B → A before a save.
    pending.set(k,{lesson:l,section,patch:merged,token:crypto.randomUUID()});
    status('שומר…');clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),350);
  }
  async function flush(){
    clearTimeout(timer);
    if(writing){await writing;if(pending.size)return flush();return;}
    if(!pending.size)return;
    const batch=[...pending.entries()];
    writing=save(d=>{for(const [,entry] of batch)StudyLessonEngine.update(d,entry.lesson,entry.section,entry.patch);},null,{background:true});
    try{
      await writing;
      for(const [k,entry] of batch)if(pending.get(k)?.token===entry.token)pending.delete(k);
      lastError='';status(pending.size?'שומר…':'המקום והטיוטה נשמרו בדפדפן');
    }catch(error){lastError=error.message;status('לא נשמר. הטיוטה עדיין פתוחה כאן.',true);throw error;}
    finally{writing=null;}
    if(pending.size)return flush();
  }
  async function exportDrafts(){
    let copy,latest=true;
    try{copy=await StudyStorage.exportState();}catch{copy=clone(state);latest=false;}
    for(const entry of pending.values())StudyLessonEngine.update(copy,entry.lesson,entry.section,entry.patch);
    downloadFile('lesson-drafts.json',JSON.stringify(copy,null,2),'application/json;charset=utf-8');
    notify(latest?'הורד גיבוי של ההתקדמות השמורה עם הטיוטות הפתוחות. יבוא הגיבוי מחליף את ההתקדמות בדפדפן.':'הורד גיבוי מהחלון הזה. לא ניתן לקרוא את השמירה העדכנית. לפני יבוא, בדקו שאין בחלון אחר עבודה חדשה יותר.');
  }
  function blocks(items){return (items||[]).map(b=>{
    if(b.type==='heading')return `<h3>${esc(b.text)}</h3>`;
    if(b.type==='equation'){
      // Escape first. Only authored exponent/index notation becomes markup.
      const math=esc(b.text).replace(/\^\(([^)]+)\)/g,'<sup>$1</sup>').replace(/_\{([^}]+)\}/g,'<sub>$1</sub>').replace(/_\(([^)]+)\)/g,'<sub>$1</sub>');
      return `<div class="lesson-equation" dir="ltr" role="math" aria-label="${esc(b.label)}">${math}</div>`;
    }
    if(b.type==='note')return `<aside class="lesson-note"><strong>${esc(b.title)}</strong><p>${esc(b.text)}</p></aside>`;
    if(b.type==='table')return `<div class="lesson-table-wrap"><table class="lesson-table"><thead><tr>${b.headers.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(row=>`<tr>${row.map(x=>`<td><bdi>${esc(x)}</bdi></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return `<p>${esc(b.text)}</p>`;
  }).join('');}
  function link(l,label,primary=false){return `<a class="button ${primary?'primary':''}" href="${route(l.sessionId)}">${label|| (state.settings.lessonWorkspace?.sessions[l.sessionId]?'להמשיך ללמוד':'לפתיחת השיעור')} <span aria-hidden="true">←</span></a>`;}
  function card(l){const s=sessionOf(l.sessionId);return `<article class="lesson-card"><div class="lesson-number" aria-hidden="true">${l.number.toString().padStart(2,'0')}</div><div><span class="eyebrow">${s.unscheduled?'ללא שיבוץ':fmtDate(s.date)} · ${timeLabel(s.minutes)}</span><h2><a href="${route(l.sessionId)}">${esc(l.title)}</a></h2><p>${esc(l.summary)}</p><div class="lesson-card-bottom">${link(l)}${isDone(s)?tag('המפגש סומן כהושלם','green'):state.settings.lessonWorkspace?.sessions[l.sessionId]?tag('יש מקום שמור'):tag('שיעור באתר')}</div></div></article>`;}
  function directory(){
    const rest=allSessions().filter(s=>s.week!==1&&!s.disabled);
    return heading('השיעורים','פותחים שיעור, לומדים בקצב שלכם וממשיכים מהמקום שבו עצרתם.')+
      `<section class="course-week"><div class="section-head"><div><span class="eyebrow">שבוע 1 · ארבעה מפגשים</span><h2>תוחלת, שונות וחסמי הסתברות</h2></div><span class="tag">9 שעות מתוכננות</span></div><p class="subtitle">מהטלת מטבע לחישוב עומס ולהוכחות בממ״נים. אפשר להיעזר ב־NotebookLM מתוך השיעור כשצריך.</p><div class="lesson-list">${lessons.map(card).join('')}</div></section>
      <section class="section"><h2>בהמשך הקורס</h2><p class="subtitle">במפגשים הבאים עדיין לומדים בעזרת חומרי הקורס ו־NotebookLM. לכל מפגש יש הנחיות ושאלות מקור.</p>${[...new Set(rest.map(s=>s.week))].map(week=>`<details class="course-week-other"><summary>שבוע ${week} · ${rest.filter(s=>s.week===week).length} מפגשים</summary><div class="agenda-list">${rest.filter(s=>s.week===week).map(sessionRow).join('')}</div></details>`).join('')}</section>`;
  }
  function overview(){
    const next=nextSession(),lesson=next&&lessonFor(next.id),done=allSessions().filter(s=>!s.disabled&&isDone(s)).length;
    const overdue=allSessions().filter(s=>!isDone(s)&&!s.disabled&&!s.unscheduled&&s.date<activeDate&&isCommitted(s));
    const days=Math.max(0,Math.round((dayDate(schedule.exam.date)-dayDate(activeDate))/86400000));
    return heading('ממשיכים ללמוד','השיעור הבא והמשך התוכנית, במקום אחד.',`<label class="small-text muted" for="active-date">תאריך עבודה</label><input id="active-date" class="date-select" type="date" min="${StudyPlanCalendar.START}" max="${StudyPlanCalendar.END}" value="${activeDate}">`)+
      `<section class="study-home-hero"><div class="home-hero-copy"><span class="eyebrow">${next?'מכאן ממשיכים':'בחירת ההמשך'}</span><h2>${esc(lesson?.title||next?.title||'זמן לחזרה ולבדיקת ההבנה')}</h2><p>${esc(lesson?.summary||next?.objective||'אפשר לחזור לשיעורים ולבדוק אילו שאלות תרצו לתרגל שוב.')}</p><div class="hero-bottom">${lesson?link(lesson,undefined,true):next?`<button class="button primary" data-action="session" data-id="${esc(next.id)}">פתיחת המפגש <span aria-hidden="true">←</span></button>`:'<a class="button primary" href="#questions">לשאלות לתרגול</a>'}<a class="text-link" href="#lessons">כל השיעורים</a></div></div><div class="home-context"><span>הבחינה הבאה</span><strong>${fmtDate(schedule.exam.date)}</strong><p>עוד ${days} ימים</p><div class="home-context-line"></div><span>מפגשים שסומנו כהושלמו</span><strong><bdi>${done} / ${allSessions().filter(s=>!s.disabled).length}</bdi></strong><a class="text-link" href="#readiness">למצב הלימוד שלי ←</a></div></section>`+
      `${StudyPlanner?.backlog()||''}${overdue.length?`<section class="home-plan-notice"><div><h2>צריך להזיז את התוכנית?</h2><p>${overdue.length} מפגשים מתאריכים קודמים עדיין פתוחים. אפשר להתאים את המועדים לזמן שנשאר.</p></div>${StudyPlanner?.entry()||''}</section>`:''}`+
      `<section class="section home-next"><div class="section-head"><h2>המפגשים הקרובים</h2><a class="text-link" href="#schedule">לוח הזמנים ←</a></div><div class="agenda-list">${allSessions().filter(s=>s.id!==next?.id&&!s.disabled&&!s.unscheduled&&!isDone(s)&&isCommitted(s)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3).map(s=>`<div class="home-upcoming-session"><span class="eyebrow">${fmtDate(s.date)}</span>${sessionRow(s)}</div>`).join('')||'<p class="list-empty">אין מפגשים נוספים בתוכנית.</p>'}</div></section>`+
      `${window.StudyRecommendations?.enabled()?`<details class="course-week-other"><summary>המלצה לפי התרגול שתיעדתם</summary>${StudyRecommendations.card()}</details>`:''}`;
  }
  function prompt(id,sectionId){
    const l=lessonFor(id);if(!l)return '';
    const part=validSection(l,sectionId||saved(l).currentSection);
    const activity=part.activity||(part.id==='summary'?'wrapup':'practice');
    const textBlocks=items=>(items||[]).map(b=>b.type==='table'?[b.headers.join(' | '),...b.rows.map(row=>row.join(' | '))].join('\n'):[b.title,b.text].filter(Boolean).join(': ')).join('\n');
    const refs=[...(l.sourceRefs||[])];
    for(const problemId of part.official||[]){const problem=problemOf(problemId);refs.push({sourceId:problem.sourceId,pages:problem.pages,label:`שאלה ${problemId.split('-q')[1]}`});}
    const sources=typeof sourceOf==='function'&&StudyTeachingPolicy.sourceText?refs.map(ref=>StudyTeachingPolicy.sourceText(sourceOf(ref.sourceId),ref)).join('\n'):'';
    const exposure=read(l,part.id);
    const assistance=exposure.solution?'בחלק הזה כבר נפתח פתרון, דוגמה מוסברת או נוסח קודם עם הכוונה. אין להסיק מכך פתרון עצמאי.':exposure.hints?'בחלק הזה כבר נפתח רמז. אין להסיק עצמאות מלאה מהניסיון.':'';
    const exampleBoundary=part.example?'הדוגמה הנוספת הסגורה אינה כלולה בבקשה. אל תפתור אותה אלא אם אבקש במפורש; הסבר רק את הדוגמה הגלויה או את הקושי שאציין.':'';
    // Only the initial visible material belongs in this handoff. Optional examples,
    // hints, answer keys, archived wording and the learner's draft are excluded.
    return `${StudyTeachingPolicy.notebookContext()}\n\nאני לומד: ${l.title}.\nכעת: ${part.title}.\n\n${textBlocks(part.body)}\n\n${part.question?'השאלה שבה אני מבקש עזרה:\n'+part.question.text:activity==='wrapup'?'אני מבקש לסכם את מה שעשיתי. אל תניח שסיימתי או הבנתי; הסתמך על מה שאמסור.':'אני מבקש הסבר על המושג בחלק הזה. הסבר את הידע החסר לפי בקשתי, בלי לפתור מראש תרגיל אחר.'}\n\n${part.official?.length?'יש לקרוא את נוסח שאלת המקור במחברת ולשמור על כל סעיפיו והגבלותיו. אל תמציא נוסח או סעיפים.':'ההסבר ותרגיל הלימוד נכתבו לאתר ואינם נוסח ממ״ן.'}\n${sources?'מקורות לזיהוי במחברת:\n'+sources+'\n':''}${assistance}\n${exampleBoundary}\nהטיוטה שלי אינה כלולה בבקשה. אם כבר צירפתי ניסיון בשיחה, התחל ממנו. אין להסיק מהיעדר רישום עזרה שלא ראיתי הסבר קודם. אל תמשיך אוטומטית לחלק אחר ואל תסמן התקדמות באתר.\n${StudyTeachingPolicy.policy(window.StudyTeaching.mode(),activity)}`;
  }
  function reader(){
    const r=parse();if(!r)return `<section class="panel"><h1>לא ניתן לפתוח את השיעור</h1><p>${esc(lastError||'הכתובת אינה תואמת לשיעור קיים.')}</p><a class="button" href="#lessons">חזרה לשיעורים</a></section>`;
    const {lesson:l,section:s}=r,index=l.sections.indexOf(s),answer=read(l,s.id),next=l.sections[index+1];
    document.title=`${s.title} · ${l.title} · erdős`;
    return `<div class="lesson-reader"><a class="lesson-back" href="#lessons"><span aria-hidden="true">→</span> כל השיעורים</a>
      <header class="lesson-header"><span class="eyebrow">שבוע 1 · שיעור ${l.number} מתוך 4</span><h1>${esc(l.title)}</h1><p>${esc(l.summary)}</p><div class="lesson-meta"><span>${timeLabel(sessionOf(l.sessionId).minutes)} · כולל תרגול והפסקות</span>${next?'<button class="text-link" data-lesson-action="finish">לעצור ולסכם את המפגש</button>':''}</div></header>
      <div class="lesson-layout"><aside class="lesson-outline"><details open><summary>בשיעור הזה</summary><nav aria-label="חלקי השיעור"><ol>${l.sections.map((part,i)=>`<li><a href="${route(l.sessionId,part.id)}" ${part===s?'aria-current="step"':''}><span>${i+1}</span><span>${esc(part.title)}</span></a></li>`).join('')}</ol></nav></details><div class="lesson-outline-note"><strong>בסיום תוכלו</strong><p>${esc(l.outcome)}</p></div></aside>
      <article class="lesson-article" aria-labelledby="lesson-section-title"><div class="lesson-section-heading"><span class="eyebrow">${esc(s.kind)} · חלק ${index+1} מתוך ${l.sections.length} · כ־${s.minutes} דקות</span><h2 id="lesson-section-title" tabindex="-1">${esc(s.title)}</h2></div>
      ${index===0?`<details class="lesson-details"><summary>מה צריך לדעת לפני שמתחילים?</summary><p>${esc(l.prerequisites)}</p><p>${esc(l.time)}</p>${l.number>1?`<a class="text-link" href="${route(lessons[0].sessionId)}">חזרה לתוחלת ולשונות ←</a>`:''}</details>`:''}
      ${window.StudyMeetings?.taskSummary(l.sessionId)||''}<div class="lesson-prose">${blocks(s.body)}</div>
      ${s.example?`<details class="lesson-details lesson-worked-example" data-lesson-help="solution"><summary>${esc(s.example.title)}</summary><div class="lesson-prose">${blocks(s.example.body)}</div></details>`:''}
      ${s.official?.length?`<div class="lesson-source-task">${s.official.map(id=>{const problem=problemOf(id);return sourceLink(problem.sourceId,problem.pages,problem.title);}).join('')}<p>קובץ המקור נפתח בלשונית נוספת. אם טרם קישרתם אותו, אפשר לעשות זאת דרך ״חומרי הקורס״.</p></div>`:''}
      ${s.question?`<section class="lesson-exercise" aria-labelledby="exercise-title"><span class="eyebrow">${s.official?'הניסיון שלכם במטלה':'עכשיו תורכם · תרגיל לימוד'}</span><h3 id="exercise-title">${s.official?'עובדים לפי נוסח המקור':'בדקו את ההבנה'}</h3><p class="lesson-question-text">${esc(s.question.text)}</p><label for="lesson-draft">הטיוטה שלכם <span>אפשר גם לפתור במחברת</span></label><textarea id="lesson-draft" data-session="${l.sessionId}" data-section="${s.id}" rows="5" maxlength="12000" placeholder="כתבו את דרך הפתרון או את השלב שבו נתקעתם…">${esc(answer.draft)}</textarea><div class="lesson-draft-status"><span id="lesson-save-state" role="status" aria-live="polite">${lastError?'לא נשמר. הטיוטה עדיין פתוחה כאן.':pending.size?'שומר…':'הטיוטה נשמרת בדפדפן הזה'}</span><span>האתר אינו בודק את התשובה אוטומטית</span></div>
      <div id="lesson-save-recovery" ${lastError?'':'hidden'}><p class="error">${esc(lastError)}</p><button class="button" data-lesson-action="retry">ניסיון שמירה נוסף</button><button class="button" data-lesson-action="export">הורדת גיבוי עם הטיוטה</button></div>
      <div class="lesson-help"><details data-lesson-help="hint"><summary>רמז להתחלה</summary><div class="lesson-hints">${s.question.hints.map((hint,i)=>i===0?`<p>${esc(hint)}</p>`:`<details data-lesson-help="hint" data-hint-count="${i+1}"><summary>רמז נוסף ${i+1}</summary><p>${esc(hint)}</p></details>`).join('')}</div></details><details data-lesson-help="solution"><summary>פתרון והסבר</summary><div class="lesson-feedback">${blocks(s.question.solution)}<h4>מה לבדוק בניסיון שלכם</h4><ul>${s.question.check.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></details></div>
      ${answer.draft&&window.StudyPreviousLessonContent?.[l.sessionId]?.[s.id]?`<details class="lesson-details lesson-previous" data-lesson-help="solution"><summary>נוסח התרגיל לפני עדכון 17.10.2026 — כולל הכוונה</summary><p>אם כתבתם את הטיוטה לפני עדכון הניסוח, אפשר להיעזר בנוסח הקודם כדי להבין למה התייחסתם. הטיוטה נשארת כפי שכתבתם אותה. הנוסח הישן כולל הכוונה שהוסרה מהשאלה החדשה.</p><div class="lesson-prose">${blocks(window.StudyPreviousLessonContent[l.sessionId][s.id].body)}<p>${esc(window.StudyPreviousLessonContent[l.sessionId][s.id].question)}</p></div></details>`:''}</section>`:'<span id="lesson-save-state" class="lesson-position-status" role="status" aria-live="polite">המקום בשיעור נשמר אוטומטית</span><div id="lesson-save-recovery" hidden><p>השמירה לא הצליחה.</p><button class="button" data-lesson-action="retry">ניסיון נוסף</button><button class="button" data-lesson-action="export">הורדת גיבוי</button></div>'}
      <details class="lesson-details lesson-ai"><summary>צריך הסבר נוסף? עזרה ב־NotebookLM</summary><p>הבקשה כוללת את ההסבר הגלוי והשאלה בחלק הזה, בלי הרמזים, הפתרון או הטיוטה שלכם. העתיקו אותה לשיחה עם מחברת הקורס.</p>${['practice','recall','mixed'].includes(s.activity||'practice')?window.StudyTeaching?.selector?.()||'':''}<button class="button" data-lesson-action="copy">העתקת בקשת עזרה</button><button class="text-link" data-lesson-action="preview">הצגת הבקשה</button></details>
      <footer class="lesson-navigation">${index?`<a class="button" href="${route(l.sessionId,l.sections[index-1].id)}"><span aria-hidden="true">→</span> החלק הקודם</a>`:'<span></span>'}${next?`<a class="button primary" href="${route(l.sessionId,next.id)}">להמשך: ${esc(next.title)} <span aria-hidden="true">←</span></a>`:`<button class="button primary" data-lesson-action="finish">סיכום המפגש</button>`}</footer>
      ${!next?`<p class="lesson-end-note">אפשר לתעד מה למדתם ומה נשאר להמשך. ${lessons[l.number]?`השיעור הבא: <a class="text-link" href="${route(lessons[l.number].sessionId)}">${esc(lessons[l.number].title)} ←</a>`:'אפשר לחזור לכל שיעור כדי לתרגל שוב.'}</p>`:''}
      <details class="lesson-details lesson-sources"><summary>מקורות והערות לשיעור</summary><p>${esc(l.sourceNote)}</p><button class="text-link" data-task-action="edit" data-id="${l.sessionId}">מועד המפגש והערות</button><div class="source-links">${l.sourceRefs.map(ref=>sourceLink(ref.sourceId,ref.pages)).join('')}</div></details></article></div></div>`;
  }
  function refreshMathAccess(){
    document.querySelectorAll('.lesson-equation').forEach(node=>{node.tabIndex=node.scrollWidth>node.clientWidth?0:-1;});
  }
  function afterRender(){
    const r=parse();if(!r)return;
    const latest=[...pending.values()].filter(e=>e.lesson.sessionId===r.lesson.sessionId).at(-1);
    const old=latest?.section||saved(r.lesson).currentSection;
    if(!state.settings.lessonWorkspace?.sessions[r.lesson.sessionId]||old!==r.section.id)queue(r.lesson,r.section.id);
    if(window.matchMedia('(max-width: 760px)').matches){const details=$('.lesson-outline details');if(details)details.open=false;}
    refreshMathAccess();
  }
  document.addEventListener('input',event=>{const field=event.target;if(field.id!=='lesson-draft')return;queue(lessonFor(field.dataset.session),field.dataset.section,{draft:field.value});});
  document.addEventListener('toggle',event=>{
    if(event.target.open&&event.target.isConnected)refreshMathAccess();
    const type=event.target.dataset?.lessonHelp;if(!type||!event.target.open||!event.target.isConnected)return;
    const r=parse();if(!r)return;queue(r.lesson,r.section.id,type==='solution'?{solution:true}:{hints:Number(event.target.dataset.hintCount||1)});
  },true);
  window.addEventListener('resize',refreshMathAccess);
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-lesson-action]');if(!b)return;
    const r=parse();if(!r)return;
    const action=b.dataset.lessonAction;if(action!=='preview')b.disabled=true;
    try{
      if(action==='retry')await flush();
      if(action==='export')await exportDrafts();
      if(action==='finish'){await flush();b.disabled=false;b.focus?.({preventScroll:true});StudyMeetings.open(r.lesson.sessionId);}
      if(action==='copy'){try{await navigator.clipboard.writeText([prompt(r.lesson.sessionId,r.section.id),StudyLearningEngine.promptContext(state,r.lesson.sessionId)].filter(Boolean).join('\n\n'));notify('הבקשה הועתקה. הדביקו אותה בשיחה עם מחברת הקורס ב־NotebookLM.');}catch{b.disabled=false;b.focus?.({preventScroll:true});preview(r);}}
      if(action==='preview')preview(r);
    }catch(error){status('לא נשמר. הטיוטה עדיין פתוחה כאן.',true);notify(error.message);}finally{b.disabled=false;}
  });
  function preview(r){
    const getText=()=>[prompt(r.lesson.sessionId,r.section.id),StudyLearningEngine.promptContext(state,r.lesson.sessionId)].filter(Boolean).join('\n\n');
    openDialog('lesson-help',r.lesson.sessionId,'בקשת עזרה ל־NotebookLM',`<p>הבקשה מתייחסת לחלק ״${esc(r.section.title)}״. היא אינה שולחת הודעה ואינה כוללת את הטיוטה שלכם.</p>${['practice','recall','mixed'].includes(r.section.activity||'practice')?window.StudyTeaching?.selector?.()||'':''}<textarea id="prompt-text" class="prompt-textarea" readonly>${esc(getText())}</textarea><div class="dialog-actions"><button class="button primary" data-action="copy-prompt">העתקת הבקשה</button><button class="button" data-action="close">חזרה לשיעור</button></div>`,'עזרה בשיעור');
    window.StudyTeaching?.bindRefresh?.(getText);
  }
  window.addEventListener('beforeunload',event=>{if(pending.size){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',()=>{if(pending.size)flush().catch(()=>{});});
  window.addEventListener('hashchange',()=>{if(pending.size)flush().catch(()=>{});});
  function discardPending(){clearTimeout(timer);pending.clear();lastError='';}
  return {has,lessonFor,route,directory,overview,reader,afterRender,flush,prompt,discardPending};
})();

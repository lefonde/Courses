/* Preparation setup displays archived research labels, not approved lessons. */
'use strict';
window.StudyCourseSetup = (() => {
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const course = window.StudyCourses?.current();
  const viewKey = course ? `erdos:${course.id}:${course.offeringId}:prep-view:v1` : '';
  const defaults = {search:'', theme:'all', status:'all', page:1, pageSize:12};
  let data, rows = [], filters = {...defaults};
  if (course && !course.planner) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(viewKey) || 'null');
      if (saved && typeof saved === 'object') {
        if (typeof saved.search === 'string') filters.search = saved.search.slice(0,200);
        if (typeof saved.theme === 'string') filters.theme = saved.theme;
        if (['all','learned','remaining'].includes(saved.status)) filters.status = saved.status;
        if (Number.isInteger(saved.page) && saved.page > 0) filters.page = saved.page;
      }
    } catch {}
  }
  const engine = () => StudyExamDashboardEngine;
  const enabled = () => Boolean(course && !course.planner);
  const remember = () => {try {sessionStorage.setItem(viewKey,JSON.stringify(filters));} catch {}};
  async function load() {
    if (!enabled()) return;
    const response = await fetch(course.data.examDashboard, {cache:'no-store'});
    if (!response.ok) throw new Error('רשימת ההכנה לבחינה לא נטענה. אפשר לנסות שוב.');
    const next = await response.json();
    if (next.kind !== 'legacy-research-backlog' || next.courseId !== course.id || next.offeringId !== course.offeringId ||
        !Array.isArray(next.items) || !Array.isArray(next.topics)) throw new Error('רשימת ההכנה אינה שייכת לקורס שנבחר.');
    const ids = new Set();
    for (const item of next.items) {
      if (!Number.isSafeInteger(item.legacyId) || item.legacyId < 1 || item.id !== `legacy-${item.legacyId}` || ids.has(item.id) || typeof item.title !== 'string' ||
          item.contentStatus !== 'needs-review' || item.lessonUrl !== null || !next.topics.some(topic=>topic.id===item.topic)) {
        throw new Error('רשימת ההכנה אינה תקינה; לא נשמר שום שינוי בהתקדמות.');
      }
      ids.add(item.id);
    }
    data = next;
    rows = next.items.map(item=>({...item, theme:item.topic, themeLabel:next.topics.find(topic=>topic.id===item.topic).label, score:0, ordinal:item.legacyId}));
    if (!next.topics.some(topic=>topic.id===filters.theme)) filters.theme='all';
  }
  function summary() {
    const learned = rows.filter(item=>engine().getLearned(state,item.id)).length;
    return `<div class="course-facts" aria-label="מצב ההכנה"><div><strong>${rows.length}</strong><span>רשומות מהאתר הקודם</span></div><div><strong>0</strong><span>דפי לימוד זמינים</span></div><div><strong>${learned}</strong><span>סימנת שלמדת</span></div></div>`;
  }
  function controls() {
    return `<form class="course-filters" role="search" aria-label="חיפוש ברשימת ההכנה"><label for="course-search"><span>חיפוש ברשימה</span><input id="course-search" type="search" maxlength="200" value="${h(filters.search)}" placeholder="שם הרשומה או הנושא" autocomplete="off"></label><label for="course-topic"><span>נושא</span><select id="course-topic"><option value="all">כל הנושאים</option>${data.topics.map(topic=>`<option value="${h(topic.id)}" ${filters.theme===topic.id?'selected':''}>${h(topic.label)}</option>`).join('')}</select></label><label for="course-study-status"><span>הסימונים שלי</span><select id="course-study-status">${[['all','הכול'],['learned','סימנתי שלמדתי'],['remaining','ללא סימון למידה']].map(([id,label])=>`<option value="${id}" ${filters.status===id?'selected':''}>${label}</option>`).join('')}</select></label></form>`;
  }
  function resultList() {
    const result = engine().filterPagination(rows,state,filters); filters.page=result.page;
    return `<p class="course-result-count" role="status" aria-live="polite">${result.filteredCount?`${result.from}–${result.to} מתוך ${result.filteredCount} רשומות`:'לא נמצאו רשומות מתאימות'}</p><ol class="course-prep-list" start="${result.from||1}">${result.items.map(item=>`<li class="course-prep-item"><div><span class="course-item-topic" dir="auto">${h(item.themeLabel)}</span><h2 dir="auto">${h(item.title)}</h2><p class="course-item-status">רשומה ${item.legacyId} מהאתר הקודם · דף לימוד בהכנה</p></div><label class="course-study-mark"><input type="checkbox" data-course-learned="${h(item.id)}" ${engine().getLearned(state,item.id)?'checked':''} aria-label="למדתי: ${h(item.title)}"><span>למדתי</span></label></li>`).join('')}</ol>${!result.items.length?'<button class="button" data-course-action="reset">הצגת כל הרשימה</button>':''}<div class="course-pagination"><button class="button" data-course-action="previous" ${result.hasPrevious?'':'disabled'}>הקודם</button><span>עמוד ${result.page} מתוך ${Math.max(1,result.pageCount)}</span><button class="button" data-course-action="next" ${result.hasNext?'':'disabled'}>הבא</button></div>`;
  }
  function map() {
    return `<section class="course-prep"><header class="page-heading course-heading"><span class="eyebrow">${h(course.title)}</span><h1>הכנה לבחינה</h1><p class="subtitle">מתחילים מחומרי הקורס ומהמחקר שכבר נאסף.</p></header><section class="panel course-start"><div><h2>מחברים את חומרי הקורס</h2><p>קישור קובצי ה־PDF מאפשר לפתוח אותם כאן, בדפדפן הזה. הקבצים נשארים אצלך.</p></div><button class="button primary" data-action="source-manager">קישור חומרי הקורס</button></section><div id="course-summary">${summary()}</div><aside class="notice neutral"><strong>רשימת ההכנה בבנייה</strong><p>הכותרות והחלוקה לנושאים נשמרו מהאתר הקודם. מיקוד הבחינה, ההפניות והתוכן עדיין דורשים בדיקה מול חומרי הקורס. הרשימה אינה סילבוס מאושר, ודפי לימוד ופתרונות יתווספו בהמשך.</p></aside><section aria-label="רשומות מהאתר הקודם">${controls()}<p class="course-progress-note">״למדתי״ הוא דיווח שלך, שאפשר לבטל. הסימון אינו אישור לפתרון עצמאי או למוכנות לבחינה.</p><div id="course-results">${resultList()}</div></section></section>`;
  }
  function library() {
    const sources = Object.values(curriculum.sources || {});
    return `<header class="page-heading course-heading"><span class="eyebrow">${h(course.title)}</span><h1>חומרי הקורס</h1><p class="subtitle">${sources.length} קובצי PDF שונים בקטלוג. קבצים זהים מופיעים פעם אחת.</p></header><section class="panel section"><h2>קישור הקבצים המקומיים</h2><p>בחרו את תיקיית הקורס או את קובצי ה־PDF. ההתאמה נעשית לפי תוכן הקובץ, גם כשיש קבצים שונים עם אותו שם. המספור כאן מזהה את המקור בקטלוג; פרטי ההפניות והעמודים יתווספו בעת בדיקת החומר.</p><button class="button primary" data-action="source-manager">קישור ובדיקת קבצים</button><p class="hint">הקבצים נשמרים בדפדפן הזה בלבד ואינם נכללים בגיבוי ההתקדמות.</p></section><ul class="course-source-list">${sources.map(source=>`<li><a href="${h(StudyStorage.sourceUrl(source))}" target="_blank" rel="noopener">${h(source.label)}</a><span>PDF · ${Number(source.bytes/1048576).toLocaleString('he-IL',{maximumFractionDigits:1})} MB</span></li>`).join('')}</ul><p class="hint">זיהוי הקובץ אינו אישור לתוכן או להתאמתו לבחינה. הקלטות משנים קודמות אינן מקושרות בשלב הזה.</p>`;
  }
  function progress() {
    const learned = rows.filter(item=>engine().getLearned(state,item.id));
    return `<header class="page-heading course-heading"><span class="eyebrow">${h(course.title)}</span><h1>מצב הלימוד שלי</h1><p class="subtitle">סימוני הלמידה שלך בקורס הזה, בנפרד מהקורסים האחרים.</p></header>${summary()}<section class="panel section"><h2>הרשומות שסימנת</h2>${learned.length?`<ul class="course-studied-list">${learned.map(item=>`<li dir="auto">${h(item.title)}</li>`).join('')}</ul>`:'<p>עדיין אין סימוני למידה. אפשר לסמן ולבטל סימון ברשימת ההכנה.</p>'}<p class="hint">הרישום מבוסס על הדיווח שלך. אין כאן ציון מוכנות או בדיקה של פתרונות.</p><a class="button" href="#exam-map">לרשימת ההכנה</a></section><button class="button" data-action="settings">גיבוי והגדרות</button>`;
  }
  function render(page) {
    if (!data) return '<div class="panel"><h1>רשימת ההכנה אינה זמינה</h1><p>אפשר לרענן ולנסות שוב.</p></div>';
    return page==='library'?library():page==='readiness'?progress():map();
  }
  function refresh() {
    const slot=document.getElementById('course-results');if(slot)slot.innerHTML=resultList();
    const overview=document.getElementById('course-summary');if(overview)overview.innerHTML=summary();remember();
  }
  function settings() {
    openDialog('settings','settings','גיבוי והגדרות',`<p>ההתקדמות של <strong>${h(course.title)}</strong> נשמרת בדפדפן ובמכשיר הזה.</p><p>הגיבוי כולל את הסימונים וההגדרות של הקורס הזה בלבד. קובצי ה־PDF אינם כלולים. יבוא גיבוי מחליף את נתוני הקורס הזה אחרי אישור, ושומר עותק לשחזור; נתוני הקורס האחר נשארים בנפרד.</p><div class="dialog-actions"><button class="button primary" data-action="export">יצוא התקדמות וגיבוי</button><button class="button" data-action="import">יבוא גיבוי</button></div><input type="file" accept="application/json,.json" id="import-file" hidden><p class="hint">אין סנכרון אוטומטי בין דפדפנים. שמירה ${state.revision}.</p>`);
  }
  document.addEventListener('submit',event=>{if(event.target.matches('.course-filters'))event.preventDefault();});
  document.addEventListener('input',event=>{
    if(!enabled()||!data||event.target.id!=='course-search')return;
    filters.search=event.target.value;filters.page=1;refresh();
  });
  document.addEventListener('change',async event=>{
    if(!enabled()||!data)return;
    const target=event.target;
    if(target.id==='course-topic'||target.id==='course-study-status'){filters[target.id==='course-topic'?'theme':'status']=target.value;filters.page=1;refresh();}
    const id=target.dataset.courseLearned;if(!id||!rows.some(item=>item.id===id))return;
    const checked=target.checked;target.disabled=true;
    try{await save(next=>engine().setLearned(next,id,checked,new Date().toISOString()),'סימון הלמידה נשמר',{background:true});refresh();document.querySelector(`[data-course-learned="${id}"]`)?.focus({preventScroll:true});}
    catch{target.checked=!checked;target.disabled=false;}
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-course-action]');if(!enabled()||!data||!button)return;
    const action=button.dataset.courseAction;
    if(action==='reset'){filters={...defaults};window.render();remember();document.getElementById('course-search')?.focus();return;}
    filters.page+=action==='next'?1:-1;refresh();document.getElementById('course-results')?.scrollIntoView({block:'start'});
    const focusTarget=document.querySelector(`[data-course-action="${action}"]:not(:disabled)`)||document.querySelector('#course-results .course-result-count');
    if(focusTarget){focusTarget.tabIndex=-1;focusTarget.focus({preventScroll:true});}
  });
  return {load,render,settings,afterRender:()=>{}};
})();

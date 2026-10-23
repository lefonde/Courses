/* The ranked map owns only its filters and explicit self-reported learning marks. */
'use strict';
window.StudyExamDashboard = (() => {
  const engine = () => window.StudyExamDashboardEngine;
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = value => h(String(value ?? '').replace(/[A-Za-zΑ-Ωα-ω0-9][A-Za-zΑ-Ωα-ω0-9₀-₉⁰-⁹(){}\[\]|=<>≤≥≠≈∞+−*/^.,:_%–-]*/g, m => '\u2066'+m+'\u2069'));
  const defaults = {search:'',theme:'all',band:'all',status:'all',page:1,pageSize:12};
  let filters = {...defaults}, data = null, pending = null, error = '', searchTimer;
  const expanded = new Set();
  try { const view = JSON.parse(sessionStorage.getItem('erdos:exam-map:view:v1') || 'null'); if (view && typeof view === 'object') filters = {...defaults,...view}; } catch {}

  const families = () => data?.families || [];
  const available = family => family?.contentStatus === 'ready' && Boolean(family.lessonUrl);
  const result = () => engine().filterPagination(families(), state, filters);
  const isHere = () => typeof currentPage === 'function' && currentPage() === 'exam-map';
  function remember() { try { sessionStorage.setItem('erdos:exam-map:view:v1', JSON.stringify(filters)); } catch {} }
  async function load() {
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetch('./data/exam-dashboard.json?v=20261023');
        if (!response.ok) throw new Error('רשימת השאלות לא נטענה.');
        const next = await response.json();
        if (!Array.isArray(next.families) || !next.families.length) throw new Error('רשימת השאלות אינה זמינה.');
        data = next; error = '';
        if (!families().some(f => f.theme === filters.theme)) filters.theme = 'all';
        if (!families().some(f => f.band === filters.band)) filters.band = 'all';
        if (!['all','learned','remaining'].includes(filters.status)) filters.status = 'all';
        if (![12,24,48].includes(filters.pageSize)) filters.pageSize = 12;
        if (typeof filters.search !== 'string') filters.search = '';
      } catch (err) { error = err.message; }
      finally { pending = null; if (isHere()) render(); }
    })();
    return pending;
  }
  function stats() {
    const s = engine().summary(families(), state);
    const next = families().find(f => !engine().getLearned(state, f.id));
    return `<section class="exam-overview" aria-label="התקדמות הלמידה">
      <div class="exam-progress-panel">
        <div class="exam-progress-head"><h2>ההתקדמות שלי</h2><span>לפי סימוני ״למדתי״</span></div>
        <div class="exam-progress-value"><strong>${s.learned}</strong><span>מתוך ${s.total} משפחות שאלות</span><bdi>${s.percent}%</bdi></div>
        <progress class="exam-progress" max="${s.total}" value="${s.learned}" aria-label="משפחות שסומנו כנלמדות">${s.learned} מתוך ${s.total}</progress>
        <div class="exam-progress-facts"><div><strong>${s.remaining}</strong><span>נותרו ללמידה</span></div><div><strong><bdi>${s.priorityLearned} / ${s.priorityTotal}</bdi></strong><span>נלמדו בציון עדיפות 40 ומעלה</span></div><div><strong>${s.readyCount}</strong><span>דפי לימוד זמינים</span></div></div>
        <p class="exam-progress-note">הסימון מתעד את הלמידה שלך. הוא אינו מעיד לבדו על פתרון עצמאי בבחינה.</p>
      </div>
      <aside class="exam-next" aria-label="המשפחה הבאה לפי הדירוג"><span class="eyebrow">${next?'הבאה לפי סדר העדיפות':'כל המשפחות סומנו כנלמדות'}</span>
        <h2>${next?text(next.title):'אפשר לחזור ולתרגל'}</h2>
        <p>${next?`${text(next.themeLabel)} · ${next.score} נקודות עדיפות`:'הסימונים נשמרו. אפשר לבחור משפחה מהרשימה לחזרה נוספת.'}</p>
        ${next?`<button class="button primary" data-exam-action="locate" data-id="${h(next.id)}">לעיון במשפחה <span aria-hidden="true">←</span></button><small>${available(next)?'דף הלימוד זמין':'דף הלימוד יתווסף בהמשך'}</small>`:'<button class="button" data-exam-action="reset">לכל הרשימה</button>'}
      </aside>
    </section>`;
  }
  function controls() {
    const themes = [...new Map(families().map(f=>[f.theme,f.themeLabel])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'he'));
    const bands = [...new Map(families().map(f=>[f.band,f.bandLabel])).entries()];
    return `<div class="exam-list-title"><div><span class="eyebrow">מפת השאלות</span><h2 id="exam-list-heading" tabindex="-1">מה ללמוד קודם</h2></div><span class="exam-sort">מהציון הגבוה לנמוך <span aria-hidden="true">↓</span></span></div>
      <form class="exam-filters" id="exam-filter-form" role="search" aria-label="סינון משפחות השאלות">
        <label class="exam-search" for="exam-search"><span>חיפוש</span><input id="exam-search" type="search" value="${h(filters.search)}" placeholder="שם שאלה, נושא או שיטה…" autocomplete="off"></label>
        <label for="exam-theme"><span>נושא</span><select id="exam-theme" data-exam-filter="theme"><option value="all">כל הנושאים</option>${themes.map(([id,label])=>`<option value="${h(id)}" ${filters.theme===id?'selected':''}>${text(label)}</option>`).join('')}</select></label>
        <label for="exam-band"><span>עדיפות</span><select id="exam-band" data-exam-filter="band"><option value="all">כל העדיפויות</option>${bands.map(([id,label])=>`<option value="${h(id)}" ${filters.band===id?'selected':''}>${text(label)}</option>`).join('')}</select></label>
        <label for="exam-status"><span>הלמידה שלי</span><select id="exam-status" data-exam-filter="status">${[['all','הכול'],['remaining','טרם למדתי'],['learned','למדתי']].map(([id,label])=>`<option value="${id}" ${filters.status===id?'selected':''}>${label}</option>`).join('')}</select></label>
      </form><div class="exam-results-meta"><span id="exam-results-count" role="status" aria-live="polite"></span><button class="exam-text-button" data-exam-action="reset">ניקוי הסינון</button></div>`;
  }
  function source(ref) {
    const pageLabel = ref.pages?.length ? `עמ׳ ${ref.pages.join(', ')}` : '';
    const title = `${ref.label || ref.filename}${ref.question ? ' · שאלה '+ref.question : ''}${ref.section ? ' · סעיף '+ref.section : ''}`;
    const known = ref.sourceId && sourceOf(ref.sourceId);
    return `<li>${known?`<a href="${h(sourceUrl(known,ref.pages?.[0]||1))}" target="_blank" rel="noopener">${text(title)} <span aria-hidden="true">↗</span></a>`:`<span>${text(title)}</span>`}<small>${text(pageLabel)}</small></li>`;
  }
  function detail(f) {
    const partLabels = {scope:'שייכות לקורס',current:'הרצאות, מטלות ודוגמה',family:'חזרת המשפחה בבחינות',theme:'חזרת הנושא',recency:'עדכניות',reported_recent_exam:'מועד א שנמסר בזיכרון'};
    return `<div class="exam-detail-grid"><section><h4>מה צריך לדעת לעשות</h4><ul>${f.tasks.map(t=>`<li>${text(t)}</li>`).join('')}</ul>
        ${f.techniques.length?`<p><strong>כלים מרכזיים:</strong> ${f.techniques.map(text).join(' · ')}</p>`:''}
        ${f.prerequisites.length?`<details class="exam-subdetail"><summary>הידע המקדים</summary><ul>${f.prerequisites.map(t=>`<li>${text(t)}</li>`).join('')}</ul></details>`:''}
      </section><section><h4>למה היא במקום הזה</h4><dl class="exam-score-breakdown">${Object.entries(f.scoreBreakdown).map(([key,value])=>`<div><dt>${partLabels[key]||text(key)}</dt><dd>${Number(value).toLocaleString('he-IL',{maximumFractionDigits:1})}</dd></div>`).join('')}</dl><p class="exam-detail-note">הציון הכולל מעוגל. הופיעה ב־${f.historicalExamCount} מתוך 8 בחינות עבר. טווח המקום בשינוי המשקלים: <bdi>${f.rankRange.join('–')}</bdi>.</p></section></div>
      ${f.caveats.length?`<details class="exam-subdetail"><summary>דיוקים והסתייגויות</summary><ul>${f.caveats.map(t=>`<li>${text(t)}</li>`).join('')}</ul></details>`:''}
      <details class="exam-subdetail"><summary>מקורות (${f.sources.length})</summary><ul class="exam-source-list">${f.sources.map(source).join('')}</ul><p class="exam-detail-note">העמודים הם עמודי PDF. לפתיחת מקור יש לקשר את קובצי הקורס ב<a href="#library">חומרי הקורס</a>.</p></details>
      <div class="exam-content-status">${available(f)?`<a class="button primary" href="${h(f.lessonUrl)}">פתיחת דף הלימוד ←</a>`:'<span class="exam-status-dot" aria-hidden="true"></span><p><strong>דף הלימוד טרם נכתב.</strong> התרגיל הבסיסי, שאלת הבחינה והפתרונות יתווספו בהמשך, משפחה אחת בכל פעם.</p>'}</div>`;
  }
  function row(f) {
    const learned = engine().getLearned(state,f.id), open = expanded.has(f.id);
    return `<article class="exam-row ${learned?'is-learned':''}" data-exam-id="${h(f.id)}">
      <div class="exam-row-main"><div class="exam-rank" aria-label="מקום ${f.rank} בדירוג"><span class="exam-mobile-label">מקום</span><bdi>${f.rank}</bdi></div>
        <div class="exam-row-name"><button class="exam-family-button" data-exam-action="expand" data-id="${h(f.id)}" aria-expanded="${open}" aria-controls="exam-detail-${h(f.id)}"><span>${text(f.title)}</span><span class="exam-chevron" aria-hidden="true">⌄</span></button><div class="exam-row-meta"><span>${text(f.themeLabel)}</span><span class="exam-band" data-band="${h(f.band)}">${text(f.bandLabel)}</span><span class="exam-content-label">${available(f)?'דף לימוד זמין':'דף לימוד בהמשך'}</span></div></div>
        <div class="exam-score"><strong>${f.score}</strong><span>/ 100</span><span class="exam-score-track" aria-hidden="true"><i style="width:${f.score}%"></i></span><span class="exam-mobile-label">נקודות עדיפות</span></div>
        <label class="exam-learned" for="exam-learned-${h(f.id)}"><input type="checkbox" id="exam-learned-${h(f.id)}" data-exam-learned="${h(f.id)}" ${learned?'checked':''} aria-label="למדתי: ${h(f.title)}"><span>למדתי</span></label>
      </div><div class="exam-family-detail" id="exam-detail-${h(f.id)}" ${open?'':'hidden'}>${open?detail(f):''}</div></article>`;
  }
  function pagination(r) {
    if (!r.filteredCount) return '';
    return `<nav class="exam-pagination" aria-label="עמודי רשימת השאלות"><div><button class="button" data-exam-action="previous" ${r.hasPrevious?'':'disabled'}><span aria-hidden="true">→</span> הקודם</button><label for="exam-page"><span class="sr-only">מעבר לעמוד</span><select id="exam-page">${Array.from({length:r.pageCount},(_,i)=>`<option value="${i+1}" ${r.page===i+1?'selected':''}>עמוד ${i+1} מתוך ${r.pageCount}</option>`).join('')}</select></label><button class="button" data-exam-action="next" ${r.hasNext?'':'disabled'}>הבא <span aria-hidden="true">←</span></button></div><label class="exam-size" for="exam-page-size">בכל עמוד<select id="exam-page-size">${[12,24,48].map(n=>`<option ${r.pageSize===n?'selected':''} value="${n}">${n}</option>`).join('')}</select></label></nav>`;
  }
  function refresh({focusId,scroll=false}={}) {
    if (!isHere() || !data) return;
    const r = result(); filters.page=r.page; remember();
    const overview=document.getElementById('exam-overview-slot'); if(overview) overview.innerHTML=stats();
    document.getElementById('exam-results-count').textContent = r.filteredCount ? `\u2066${r.from}–${r.to}\u2069 מתוך ${r.filteredCount} משפחות${r.filteredCount!==families().length?' בסינון הנוכחי':''}` : 'לא נמצאו משפחות שמתאימות לחיפוש';
    document.getElementById('exam-rows').innerHTML = r.items.length ? r.items.map(row).join('') : '<div class="exam-empty"><h3>אין תוצאות בסינון הזה</h3><p>אפשר לשנות את החיפוש או להציג שוב את כל המשפחות.</p><button class="button" data-exam-action="reset">הצגת כל הרשימה</button></div>';
    document.getElementById('exam-pagination-slot').innerHTML=pagination(r);
    if(focusId){(document.getElementById(focusId)||document.getElementById('exam-list-heading')).focus({preventScroll:true});}
    if(scroll) document.getElementById('exam-list-heading').scrollIntoView({block:'start',behavior:'instant'});
  }
  function methodology() {
    return `<details class="exam-method" id="exam-method"><summary>איך נקבע סדר העדיפויות?</summary><div><p>הדירוג מבוסס על המחקר מ־23 באוקטובר: 8 בחינות עבר, הרצאות, מטלות, שאלות לדוגמה וחומרי הקורס הקריאים. הציון מבטא עדיפות להכנה, ולא הסתברות שהשאלה תופיע.</p><p>הניקוד משלב שייכות לקורס (10), הוראה ומטלות (עד 45), חזרת המשפחה בבחינות (עד 25), חזרת הנושא (עד 10), עדכניות (עד 5) ומועד א האחרון שנמסר בזיכרון (עד 5). לציונים שווים יש אותו מקום בדירוג.</p><p>בכל משפחה אפשר לפתוח את פירוט הניקוד והמקורות. טווח המקום מראה את הרגישות לשישה תרחישי משקל. פרקי הספר 4, 6 ו־7 הוחרגו. זיכרון מועד א נשמר בנפרד משאלוני העבר המאומתים.</p><p>המאגר כולל גם הרחבות בעדיפות נמוכה. אין צורך להתייחס לכל 129 המשפחות כאילו משקלן בהכנה שווה. ההתקדמות בראש העמוד תמיד מתייחסת למאגר המלא, גם כשהרשימה מסוננת.</p></div></details>`;
  }
  function renderPage() {
    if(!data){if(!error&&!pending)load();return `<section class="exam-dashboard"><h1>הכנה לפי שאלות</h1><div class="panel" role="status"><p>${error?text(error):'טוענים את מפת השאלות…'}</p>${error?'<button class="button" data-exam-action="retry">ניסיון נוסף</button>':''}</div></section>`;}
    return `<div class="exam-dashboard"><header class="exam-heading"><div><span class="eyebrow">מועד ב · 23 בנובמבר</span><h1>הכנה לפי שאלות</h1><p>מתקדמים דרך בעיות, לפי סדר העדיפות שנבנה מחומרי הקורס ומבחינות העבר.</p></div><button class="exam-text-button" data-exam-action="method">על הדירוג <span aria-hidden="true">↙</span></button></header>
      <div id="exam-overview-slot">${stats()}</div>
      <section class="exam-list" aria-labelledby="exam-list-heading">${controls()}<div class="exam-column-head" aria-hidden="true"><span>מקום</span><span>משפחת שאלות</span><span>ציון עדיפות</span><span>הלמידה שלי</span></div><div id="exam-rows"></div><div id="exam-pagination-slot"></div></section>
      ${methodology()}<p class="exam-footer-note">הסימונים נשמרים בדפדפן הזה ונכללים ב<a href="#" data-exam-action="backup">גיבוי ההתקדמות</a>.</p></div>`;
  }
  document.addEventListener('input',event=>{
    if(event.target.id!=='exam-search')return;
    filters.search=event.target.value;filters.page=1;clearTimeout(searchTimer);searchTimer=setTimeout(()=>refresh(),120);
  });
  document.addEventListener('submit',event=>{if(event.target.id==='exam-filter-form'){event.preventDefault();clearTimeout(searchTimer);refresh();}});
  document.addEventListener('change',async event=>{
    const el=event.target;
    if(el.dataset.examFilter){filters[el.dataset.examFilter]=el.value;filters.page=1;refresh();}
    if(el.id==='exam-page'){filters.page=Number(el.value);refresh({focusId:'exam-list-heading',scroll:true});}
    if(el.id==='exam-page-size'){filters.pageSize=Number(el.value);filters.page=1;refresh({focusId:'exam-list-heading',scroll:true});}
    if(el.dataset.examLearned){
      const id=el.dataset.examLearned,wanted=el.checked;el.disabled=true;
      try{await save(d=>engine().setLearned(d,id,wanted,new Date().toISOString()),wanted?'סומן כנלמד':'סימון הלמידה הוסר',{background:true});refresh({focusId:document.activeElement?.id});}
      catch{el.checked=engine().getLearned(state,id);el.disabled=false;el.focus();}
    }
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-exam-action]');if(!button)return;
    event.preventDefault();const {examAction:action,id}=button.dataset;
    if(action==='retry'){error='';load();render();}
    if(action==='method'){const method=document.getElementById('exam-method');method.open=true;method.querySelector('summary').focus();method.scrollIntoView({block:'start'});}
    if(action==='backup')showSettings();
    if(action==='reset'){filters={...defaults,pageSize:filters.pageSize};remember();render();document.getElementById('exam-search')?.focus({preventScroll:true});}
    if(action==='previous'||action==='next'){filters.page=result().page+(action==='next'?1:-1);refresh({focusId:'exam-list-heading',scroll:true});}
    if(action==='expand'){
      const f=families().find(x=>x.id===id);if(!f)return;
      if(expanded.has(id))expanded.delete(id);else expanded.add(id);
      const open=expanded.has(id),target=document.getElementById('exam-detail-'+id);
      button.setAttribute('aria-expanded',String(open));target.hidden=!open;if(open)target.innerHTML=detail(f);
    }
    if(action==='locate'){
      filters={...defaults,pageSize:filters.pageSize,page:Math.floor(families().findIndex(f=>f.id===id)/filters.pageSize)+1};expanded.add(id);remember();render();
      const target=document.querySelector(`[data-exam-id="${CSS.escape(id)}"]`);target?.scrollIntoView({block:'start'});target?.querySelector('.exam-family-button').focus({preventScroll:true});
    }
  });
  return {render:renderPage,afterRender:refresh,load};
})();

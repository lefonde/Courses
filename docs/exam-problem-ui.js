/* One reading route per problem; learning marks share the dashboard's store. */
'use strict';
window.StudyExamProblems=(()=>{
  const version='20261024-course2', cache=new Map(), pending=new Map(), errors=new Map(), pendingReports=new Map();
  let manifest;
  const viewKey=key=>'erdos:exam-problem:view:v1:'+key;
  function readView(key){try{return JSON.parse(sessionStorage.getItem(viewKey(key))||'[]');}catch{return [];}}
  const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=()=>location.hash.slice('#exam-problem/'.length).split('/')[0];
  const here=key=>currentPage()==='exam-problem'&&id()===key;
  async function load(key){
    if(pending.has(key))return pending.get(key);
    const work=(async()=>{
      try{
        if(!/^[a-z0-9-]+$/.test(key))throw new Error('הכתובת אינה שייכת לדף לימוד זמין.');
        if(!manifest){const response=await fetch(`./data/exam-problem-pages.json?v=${version}`);if(!response.ok)throw new Error('רשימת דפי הלימוד לא נטענה.');manifest=await response.json();}
        const meta=manifest.pages.find(p=>p.id===key);if(!meta)throw new Error('דף הלימוד הזה עדיין אינו זמין.');
        const [response]=await Promise.all([fetch(`./exam-problems/${key}.html?v=${version}`),StudyExamDashboard.load(),StudyReference.load()]);
        if(!response.ok)throw new Error('דף הלימוד לא נטען. אפשר לנסות שוב.');
        const family=StudyExamDashboard.family(key);if(!family)throw new Error('פרטי השאלה לא נטענו.');
        cache.set(key,{meta,family,html:await response.text()});errors.delete(key);
      }catch(error){errors.set(key,error.message);}
      finally{pending.delete(key);if(here(key))render();}
    })();pending.set(key,work);return work;
  }
  function reader(){
    const key=id(),entry=cache.get(key);
    if(!entry){if(!pending.has(key)&&!errors.has(key))load(key);return `<div class="exam-problem"><a class="problem-back" href="#exam-map">→ חזרה למפת השאלות</a><h1>דף לימוד</h1><div class="panel" role="status"><p>${h(errors.get(key)||'טוענים את השאלה והכלים לפתרון…')}</p>${errors.has(key)?'<button class="button" data-problem-retry>ניסיון נוסף</button>':''}</div></div>`;}
    const {meta,family,html}=entry,learned=pendingReports.has(key)?pendingReports.get(key):StudyExamDashboardEngine.getLearned(state,key);
    const position=manifest.pages.findIndex(p=>p.id===key), next=manifest.pages[position+1];
    return `<article class="exam-problem" data-problem-id="${h(key)}" aria-labelledby="problem-title">
      <a class="problem-back" href="#exam-map">→ חזרה למפת השאלות</a>
      <header class="problem-heading"><div class="problem-kicker"><span>משפחה ${family.rank} בדירוג</span><span>${StudyMath.text(family.themeLabel)}</span><span><bdi>${family.score}/100</bdi> נקודות עדיפות</span></div>
        <h1 id="problem-title" tabindex="-1">${StudyMath.text(meta.title||family.title)}</h1><p class="problem-lead">${h(meta.lead)}</p>
        <div class="problem-session"><span>כ־<bdi>${h(meta.minutes)}</bdi> דקות, כולל ניסיון פתרון</span><span>רמזים ופתרונות לפי הצורך</span></div>
        <a class="button primary" href="#exam-problem/${h(key)}" data-problem-jump="problem-basic">לתחילת התרגול <span aria-hidden="true">↓</span></a>
        <p class="problem-instruction">כדאי לעבוד עם דף ועט. נסו תחילה את התרגיל הבסיסי; אם חסר כלי, חזרו להסבר שבהמשך העמוד. הרמזים והפתרונות נפתחים רק לפי בחירתכם.</p>
        ${StudyReference.help()}
      </header>
      <nav class="problem-nav" aria-label="בתוך דף הלימוד">${[['basic','תרגיל בסיסי'],['tools','כלים והגדרות'],['exam','שאלת בחינה'],['check','בדיקת הבנה'],['sources','מקורות']].map(([section,label])=>`<button type="button" data-problem-jump="problem-${section}">${label}</button>`).join('')}</nav>
      <div class="problem-body">${html}</div>
      <footer class="problem-finish"><div><h2>סיימתם את התרגול?</h2><p>סמנו ״למדתי״ לאחר שעברתם על שני התרגילים והבנתם את דרך הפתרון. הסימון מתעד למידה; פתרון חוזר ללא עזרה הוא בדיקה נפרדת.</p><label class="problem-learned"><input id="problem-learned" type="checkbox" data-problem-learned="${h(key)}" ${learned?'checked':''} ${pendingReports.has(key)?'disabled':''}><span>למדתי את משפחת השאלות הזאת</span></label><p id="problem-save-note" class="problem-save-note" role="status">${pendingReports.has(key)?'שומרים את סימון הלמידה…':learned?'מסומן כנלמד במפת השאלות.':'הסימון יישמר במפת השאלות ובגיבוי ההתקדמות.'}</p></div>
        <div class="problem-bottom-links"><a class="button" href="#exam-map">חזרה למפה</a>${next?`<a href="#exam-problem/${h(next.id)}">למשפחה הבאה בדירוג ←</a>`:'<span>שלושת הדפים הראשונים מוכנים לעיונך.</span>'}</div>
      </footer></article>`;
  }
  function afterRender(){
    const entry=cache.get(id());if(!entry)return;
    document.title=`erdős · ${entry.meta.title||entry.family.title}`;
    StudyReference.enhance(document.querySelector('.problem-body'),{newWindow:true});
    StudyMath.render(document.querySelector('.problem-body'));
    const opened=readView(id());
    document.querySelectorAll('.problem-body details').forEach((detail,index)=>{detail.dataset.problemDisclosure=String(index);detail.open=Array.isArray(opened)&&opened.includes(index);});
    document.querySelectorAll('[data-problem-source]').forEach(button=>{
      const source=sourceOf(button.dataset.problemSource);if(!source)return;
      const link=document.createElement('a');link.className=button.className;link.replaceChildren(...button.childNodes);link.href=sourceUrl(source,Number(button.dataset.sourcePage)||1);link.target='_blank';link.rel='noopener';button.replaceWith(link);
    });
  }
  document.addEventListener('toggle',event=>{
    const detail=event.target;if(!detail.isConnected||detail.dataset.problemDisclosure===undefined)return;
    const article=detail.closest('[data-problem-id]');if(!article)return;
    const opened=[...article.querySelectorAll('.problem-body details[open]')].map(d=>Number(d.dataset.problemDisclosure));
    try{sessionStorage.setItem(viewKey(article.dataset.problemId),JSON.stringify(opened));}catch{}
  },true);
  document.addEventListener('click',event=>{
    const jump=event.target.closest('[data-problem-jump]');
    if(jump){event.preventDefault();const section=document.getElementById(jump.dataset.problemJump);if(!section)return;const heading=section.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}section.scrollIntoView({block:'start',behavior:'instant'});}
    if(event.target.closest('[data-problem-retry]')){errors.delete(id());load(id());render();}
  });
  document.addEventListener('change',async event=>{
    const el=event.target;if(!el.dataset.problemLearned)return;
    const key=el.dataset.problemLearned,wanted=el.checked;el.disabled=true;pendingReports.set(key,wanted);
    try{await save(d=>StudyExamDashboardEngine.setLearned(d,key,wanted,new Date().toISOString()),wanted?'סומן כנלמד':'סימון הלמידה הוסר',{background:true});if(here(key))document.getElementById('problem-save-note').textContent=wanted?'נשמר: המשפחה מסומנת כנלמדת במפה.':'נשמר: סימון הלמידה הוסר.';}
    catch{el.checked=StudyExamDashboardEngine.getLearned(state,key);if(here(key))document.getElementById('problem-save-note').textContent='השינוי לא נשמר. אפשר לנסות שוב.';}
    finally{
      pendingReports.delete(key);el.disabled=false;
      if(here(key)){const current=document.getElementById('problem-learned');if(current){current.checked=StudyExamDashboardEngine.getLearned(state,key);current.disabled=false;}}
    }
  });
  return {reader,afterRender};
})();

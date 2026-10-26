/* Reading support only: no progress, scheduling, or assistance records change. */
'use strict';
window.StudyReference=(()=>{
  const version='20261025-fingerprinting-import1';
  const files=['reference-sat','reference-walk','reference-probability','reference-walk-imported','reference-isolated-imported','reference-fingerprinting-imported','reference-links'];
  let entries=[],links=[],byId=new Map(),pending=null,error='',ready=false,search='',kind='all';
  let tooltip=null,active=null,hoverTimer,closeTimer,dismissed=null;
  const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currentId=()=>{
    const id=location.hash.startsWith('#reference/')?location.hash.slice('#reference/'.length):null;
    // Keep saved links to the replaced entry usable without retaining its old definition.
    return id==='sample-space-support'?'sample-space':id;
  };
  const isBank=()=>currentPage()==='reference'||currentPage()==='reference-entry';
  async function load(){
    if(ready)return true;if(pending)return pending;
    pending=(async()=>{
      try{
        const results=await Promise.all(files.map(async file=>{const response=await fetch(`./data/${file}.json?v=${version}`);if(!response.ok)throw new Error('מאגר המושגים לא נטען.');return response.json();}));
        const next=results.slice(0,-1).flat();
        if(!next.length||next.some(e=>!e.id||!e.title||!e.summary||!e.body)||new Set(next.map(e=>e.id)).size!==next.length)throw new Error('לא ניתן לקרוא את מאגר המושגים.');
        entries=next;links=results.at(-1);byId=new Map(entries.map(e=>[e.id,e]));
        if(links.some(l=>!byId.has(l.id)))throw new Error('חלק מן ההפניות למושגים חסרות.');
        for(const entry of entries)entry.aliases=links.find(l=>l.id===entry.id)?.phrases||entry.aliases||[];
        ready=true;error='';return true;
      }catch(err){error=err.message;return false;}
      finally{pending=null;}
    })();return pending;
  }
  function anchor(id,text,newWindow=false){
    const link=document.createElement('a');link.href='#reference/'+encodeURIComponent(id);link.dataset.referenceId=id;
    link.className='reference-term';link.textContent=text;
    if(newWindow){link.target='_blank';link.rel='noopener';link.dataset.referenceWindow='true';}
    const notice=document.createElement('span');notice.className='reference-sr-only';
    notice.textContent=newWindow?' — הסבר מלא בחלון חדש':' — להסבר המלא';link.append(notice);
    return link;
  }
  function enhance(element,{newWindow=false,exclude=null,referenceIds=null}={}){
    if(!ready||!element)return;
    // Imported lessons can bind their supplied explanations without replacing shared entries.
    const selected=referenceIds===null?links:referenceIds.filter(id=>byId.has(id)).map(id=>({id,phrases:byId.get(id).aliases}));
    const split=StudyReferenceEngine.matcher(selected.filter(l=>l.id!==exclude));
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT,{acceptNode(node){
      return node.parentElement.closest('a,button,summary,h1,script,style,pre,code,svg,.katex,.study-math,#problem-sources')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const segments=split(node.textContent);if(!segments.some(s=>s.id))continue;
      const fragment=document.createDocumentFragment();
      for(const part of segments)fragment.append(part.id?anchor(part.id,part.text,newWindow):document.createTextNode(part.text));
      node.replaceWith(fragment);
    }
  }
  function help(){return `<p class="reference-instruction"><span class="reference-hover-note">מונח בקו מנוקד: ריחוף או מיקוד במקלדת מציגים תזכורת; לחיצה פותחת הסבר מלא בחלון חדש.</span><span class="reference-touch-note">נגיעה במונח בקו מנוקד פותחת הסבר מלא בחלון חדש.</span> <a href="#reference" target="_blank" rel="noopener" data-reference-window="true">למאגר המושגים והמשפטים ↗</a>${error?'<span role="status"> התזכורות לא נטענו. <button type="button" class="reference-retry" data-reference-retry>ניסיון נוסף</button></span>':''}</p>`;}
  function list(){
    return `<section class="reference-bank"><header><span class="eyebrow">עזרה בזמן פתרון</span><h1>מושגים ומשפטים</h1><p>הגדרות, סימונים וכלים מתוך דפי התרגול באתר. אפשר לחפש מונח ולפתוח את ההסבר המלא שלו.</p></header>
      <form id="reference-search-form" class="reference-search" role="search"><label for="reference-search">מה תרצו להיזכר בו?<input type="search" id="reference-search" autocomplete="off" value="${h(search)}" placeholder="למשל: קבוצת השמות, תוחלת, זמן הגעה"></label><label for="reference-kind">סוג הערך<select id="reference-kind"><option value="all">כל הסוגים</option>${[...new Set(entries.map(e=>e.kind))].map(k=>`<option ${kind===k?'selected':''} value="${h(k)}">${h(k)}</option>`).join('')}</select></label></form>
      <p class="reference-count" id="reference-count" role="status"></p><div id="reference-results" class="reference-results"></div></section>`;
  }
  function refreshList(){
    const target=document.getElementById('reference-results');if(!target||!ready)return;
    const found=StudyReferenceEngine.filter(entries,{search,kind});
    document.getElementById('reference-count').textContent=`${found.length} מתוך ${entries.length} ערכים`;
    target.innerHTML=found.length?found.map(entry=>`<article class="reference-card"><span class="reference-kind">${h(entry.kind)}</span><h2><a href="#reference/${h(entry.id)}">${StudyMath.text(entry.title)} <span aria-hidden="true">←</span></a></h2><p>${StudyMath.text(entry.summary)}</p>${entry.lessonId?`<p class="reference-scope"><a href="#exam-problem/${h(entry.lessonId)}">מתוך השיעור: ${StudyMath.text(entry.lessonTitle)}</a></p>`:''}</article>`).join(''):'<div class="panel"><h2>לא נמצא ערך מתאים</h2><p>נסו מילה קצרה יותר או הציגו שוב את כל הערכים.</p><button class="button" data-reference-clear>ניקוי החיפוש</button></div>';
  }
  function source(ref){
    const known=ref.sourceId&&sourceOf(ref.sourceId);
    return `<li>${known?`<a href="${h(sourceUrl(known,ref.page||1))}" target="_blank" rel="noopener">${StudyMath.text(ref.label)} ↗</a>`:StudyMath.text(ref.label)}${ref.excerpt?`<div class="reference-excerpt"><span>קטע מהמקור:</span><blockquote dir="auto">${StudyMath.text(ref.excerpt)}</blockquote></div>`:''}${ref.note?`<p>${StudyMath.text(ref.note)}</p>`:''}</li>`;
  }
  function reader(){
    close();
    if(!ready){if(!error)load().then(()=>{if(isBank())render();});return `<section class="reference-bank"><h1>מושגים ומשפטים</h1><div class="panel" role="status"><p>${h(error||'טוענים את מאגר המושגים…')}</p>${error?'<button class="button" data-reference-retry>ניסיון נוסף</button>':''}</div></section>`;}
    const key=currentId();if(!key)return list();
    const entry=byId.get(key);
    if(!entry)return '<section class="reference-bank"><h1>הערך אינו נמצא במאגר</h1><p>אפשר למצוא את המושג באמצעות החיפוש.</p><a class="button" href="#reference">למאגר המושגים</a></section>';
    return `<article class="reference-entry" aria-labelledby="reference-title"><a class="problem-back" href="#reference">→ לכל המושגים והמשפטים</a><header><span class="eyebrow">${h(entry.kind)}</span><h1 id="reference-title">${StudyMath.text(entry.title)}</h1>${entry.summaryIsBody?'':`<p class="reference-lead">${StudyMath.text(entry.summary)}</p>`}${entry.formula?StudyMath.text('\\['+entry.formula+'\\]'):''}</header>
      <div class="reference-body problem-body">${entry.body}</div>
      ${(entry.related||[]).filter(id=>byId.has(id)).length?`<section class="reference-related"><h2>מושגים קשורים</h2><div>${entry.related.filter(id=>byId.has(id)).map(id=>`<a href="#reference/${h(id)}">${StudyMath.text(byId.get(id).title)} ←</a>`).join('')}</div></section>`:''}
      ${(entry.sources||[]).length?`<details class="reference-sources"><summary>מקורות מהקורס וקטעים להשוואה</summary><p>הניסוח שבערך מפרט את חומר הקורס. הקטעים שלהלן מובאים מן המקורות כדי שאפשר יהיה להשוות; נוסחאות סודרו לתצוגה. הקישורים נפתחים בעמוד ה־PDF המצוין, מתוך ספריית הקבצים המקומית בדפדפן.</p><ul>${entry.sources.map(source).join('')}</ul></details>`:''}
      ${entry.lessonId?`<p><a href="#exam-problem/${h(entry.lessonId)}">לשיעור: ${StudyMath.text(entry.lessonTitle)}</a></p>`:''}
      <p class="reference-return-note">אפשר להשאיר חלון זה פתוח לצד התרגיל. הקריאה כאן אינה משנה את סימוני הלמידה.</p></article>`;
  }
  function afterRender(){
    const entry=byId.get(currentId());
    if(entry){document.title=`erdős · ${entry.title}`;const body=document.querySelector('.reference-body');enhance(body,{exclude:entry.id,referenceIds:entry.referenceIds||null});StudyMath.render(body);StudyMath.refreshOverflow(document.querySelector('.reference-entry'));}
    else refreshList();
  }
  function panel(){
    if(!tooltip){tooltip=document.createElement('div');tooltip.id='reference-tooltip';tooltip.className='reference-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);
      tooltip.addEventListener('pointerenter',()=>clearTimeout(closeTimer));tooltip.addEventListener('pointerleave',()=>scheduleClose());}
    return tooltip;
  }
  function close(){
    clearTimeout(hoverTimer);clearTimeout(closeTimer);
    if(active)active.removeAttribute('aria-describedby');
    active=null;if(tooltip)tooltip.hidden=true;
  }
  function scheduleClose(){clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(!tooltip?.matches(':hover')&&!active?.matches(':hover')&&document.activeElement!==active)close();},180);}
  function position(link,box){
    const rect=link.getBoundingClientRect(),width=box.offsetWidth,height=box.offsetHeight;
    const x=Math.max(12,Math.min(innerWidth-width-12,rect.right-width));
    const below=rect.bottom+9,above=rect.top-height-9;
    box.style.left=x+'px';box.style.top=Math.max(10,below+height<=innerHeight-10?below:above>=10?above:innerHeight-height-10)+'px';
  }
  function show(link){
    if(!link.isConnected||dismissed===link)return;
    const entry=byId.get(link.dataset.referenceId);if(!entry)return;
    close();active=link;const box=panel();
    box.innerHTML=`<span class="reference-kind">${h(entry.kind)}</span><h2>${StudyMath.text(entry.title)}</h2><p>${StudyMath.text(entry.summary)}</p>${entry.formula?`<div class="reference-tooltip-formula">${StudyMath.text('\\('+entry.formula+'\\)')}</div>`:''}${entry.example?`<p class="reference-tooltip-example"><strong>לדוגמה:</strong> ${StudyMath.text(entry.example)}</p>`:''}<span class="reference-tooltip-foot">${link.dataset.referenceWindow?'לחיצה על המונח פותחת הסבר מלא בחלון חדש':'לחיצה על המונח פותחת את ההסבר המלא'} · Esc לסגירה</span>`;
    box.hidden=false;link.setAttribute('aria-describedby',box.id);
    position(link,box);
  }
  document.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch')return;
    const link=event.target.closest?.('a[data-reference-id]');if(!link||link.contains(event.relatedTarget))return;
    dismissed=null;clearTimeout(closeTimer);clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>show(link),160);
  });
  document.addEventListener('pointerout',event=>{
    const link=event.target.closest?.('a[data-reference-id]');if(!link||link.contains(event.relatedTarget))return;
    clearTimeout(hoverTimer);scheduleClose();
  });
  document.addEventListener('focusin',event=>{const link=event.target.closest?.('a[data-reference-id]');if(link){dismissed=null;show(link);}});
  document.addEventListener('focusout',event=>{if(event.target===active){dismissed=null;scheduleClose();}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){dismissed=active;close();}});
  document.addEventListener('scroll',event=>{
    if(tooltip?.contains(event.target))return;
    // Browser scrolling after keyboard focus must not immediately dismiss help.
    if(active?.isConnected&&document.activeElement===active){
      const rect=active.getBoundingClientRect();
      if(rect.bottom>0&&rect.top<innerHeight){position(active,tooltip);return;}
    }
    close();
  },true);
  window.addEventListener('resize',close);window.addEventListener('hashchange',close);window.addEventListener('blur',close);
  document.addEventListener('input',event=>{if(event.target.id==='reference-search'){search=event.target.value;refreshList();}});
  document.addEventListener('change',event=>{if(event.target.id==='reference-kind'){kind=event.target.value;refreshList();}});
  document.addEventListener('submit',event=>{if(event.target.id==='reference-search-form'){event.preventDefault();refreshList();}});
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[data-reference-window]');
    if(link&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){
      // A user-initiated reading window; retain the native new-tab fallback.
      const opened=window.open(link.href,'_blank','popup,width=1040,height=840');
      if(opened){opened.opener=null;event.preventDefault();}close();
    }
    if(event.target.closest?.('[data-reference-retry]')){error='';load().then(()=>{if(isBank()||currentPage()==='exam-problem')render();});}
    if(event.target.closest?.('[data-reference-clear]')){search='';kind='all';render();document.getElementById('reference-search')?.focus();}
  });
  return {load,enhance,help,reader,afterRender,close};
})();

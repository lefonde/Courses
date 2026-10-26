/* Explicit TeX boundaries keep complete expressions independent of Hebrew bidi. */
(function(root){
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function prose(value){
    let result='',start=0;
    // Keep a multiword Latin source name in one LTR span inside Hebrew prose.
    for(const match of String(value).matchAll(/[A-Za-z0-9Α-Ωα-ω][A-Za-z0-9Α-Ωα-ω–-]*(?:\.[A-Za-z0-9]+)*(?:[ \t]+[A-Za-z0-9Α-Ωα-ω][A-Za-z0-9Α-Ωα-ω–-]*(?:\.[A-Za-z0-9]+)*)*/g)){
      result+=escape(value.slice(start,match.index))+`<bdi dir="ltr">${escape(match[0])}</bdi>`;
      start=match.index+match[0].length;
    }
    return result+escape(value.slice(start));
  }
  function text(value){
    const input=String(value??''), regex=/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
    let result='', start=0;
    for(const match of input.matchAll(regex)){
      result+=prose(input.slice(start,match.index));
      const tex=match[1]??match[2], display=match[2]!==undefined;
      try{
        const math=root.katex.renderToString(tex,{displayMode:display,throwOnError:true,trust:false,strict:'error',output:'htmlAndMathml'});
        result+=`<span class="study-math${display?' study-math-block':''}" dir="ltr">${math}</span>`;
      }catch(error){
        result+=`<bdi class="study-math-error" dir="ltr">${escape(tex)}</bdi>`;
        if(root.console)root.console.error('Math rendering failed:',tex,error.message);
      }
      start=match.index+match[0].length;
    }
    return result+prose(input.slice(start));
  }
  function render(element){
    if(!element)return;
    // Only authored text nodes are replaced; never reinterpret attributes or HTML.
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT,{
      acceptNode(node){return node.parentElement.closest('script,style,pre,code,bdi,.katex,.study-math')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}
    });
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{if(!/\\[([]|[A-Za-z0-9Α-Ωα-ω]/.test(node.textContent))return;const template=document.createElement('template');template.innerHTML=text(node.textContent);node.replaceWith(template.content);});
    refreshOverflow(element);
  }
  function refreshOverflow(element){
    element.querySelectorAll('.study-math-block').forEach(block=>{
      const overflow=block.clientWidth>0&&block.scrollWidth>block.clientWidth+1;
      if(overflow){block.tabIndex=0;block.setAttribute('role','region');block.setAttribute('aria-label','נוסחה רחבה; אפשר לגלול באמצעות מקשי החצים');}
      else{block.removeAttribute('tabindex');block.removeAttribute('role');block.removeAttribute('aria-label');}
    });
  }
  if(root.document){
    root.addEventListener('resize',()=>refreshOverflow(document));
    document.addEventListener('toggle',()=>requestAnimationFrame(()=>refreshOverflow(document)),true);
    document.fonts?.ready.then(()=>refreshOverflow(document));
  }
  const api={text,render,refreshOverflow};root.StudyMath=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);

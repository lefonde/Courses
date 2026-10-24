/* Explicit editorial aliases, never matches inside an unrelated TeX expression. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.StudyReferenceEngine=api;})(typeof window==='object'?window:globalThis,()=>{
  'use strict';
  const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function matcher(links){
    const byText=new Map();
    for(const link of links)for(const phrase of link.phrases){if(phrase)byText.set(phrase,link.id);}
    const alternatives=[...byText.keys()].sort((a,b)=>b.length-a.length).map(escapeRegex);
    if(!alternatives.length)return value=>value?[{text:value}]:[];
    const regex=new RegExp(alternatives.join('|')+'|\\\\\\([\\s\\S]*?\\\\\\)|\\\\\\[[\\s\\S]*?\\\\\\]','gu');
    return value=>{
      const parts=[];let start=0;
      for(const match of value.matchAll(regex)){
        const id=byText.get(match[0]);
        if(!id)continue;
        // Hebrew prefixes may precede a term; do not match a truncated suffix.
        if(/[\p{L}\p{N}]/u.test(match[0].at(-1))&&/[\p{L}\p{N}]/u.test(value[match.index+match[0].length]||''))continue;
        if(start<match.index)parts.push({text:value.slice(start,match.index)});
        parts.push({text:match[0],id});start=match.index+match[0].length;
      }
      if(start<value.length)parts.push({text:value.slice(start)});
      return parts;
    };
  }
  function normalize(value){return String(value??'').normalize('NFKD').replace(/[\u0591-\u05c7]/g,'').toLocaleLowerCase('he');}
  function filter(entries,{search='',kind='all'}={}){
    const words=normalize(search).trim().split(/\s+/).filter(Boolean);
    return entries.filter(entry=>(kind==='all'||entry.kind===kind)&&words.every(word=>normalize([entry.title,entry.summary,entry.formula,entry.example,...(entry.aliases||[])].join(' ')).includes(word))).sort((a,b)=>a.title.localeCompare(b.title,'he'));
  }
  return {matcher,filter};
});

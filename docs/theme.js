/* Appearance preferences do not modify learning or planning records. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&root.document){
    root.StudyTheme=api;
    const key=root.STUDY_CONFIG?.storageKey||'matzpen:22902:2026-s3:progress:v1';
    const restore=()=>{try{api.apply(root.document,JSON.parse(root.localStorage.getItem(key)||'{}').settings||{});}catch{api.apply(root.document,{});}};
    restore();
    root.addEventListener('storage',event=>{if(event.key===key)restore();});
  }
})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const choices=['dark-ink','dark-clay','light-ink','light-clay'];
  function resolve(settings={}){
    const mode=settings.theme==='light'?'light':'dark',palette=settings.themePalette==='clay'?'clay':'ink';
    return {mode,palette,choice:mode+'-'+palette};
  }
  function setChoice(state,choice){
    if(!choices.includes(choice))throw new Error('בחרו אחת מארבע התצוגות.');
    const [mode,palette]=choice.split('-');
    state.settings.theme=mode;state.settings.themePalette=palette;
  }
  function apply(document,settings){
    const {mode,palette,choice}=resolve(settings);
    document.documentElement.dataset.theme=mode;
    document.documentElement.dataset.palette=palette;
    const select=document.getElementById('theme-select');if(select)select.value=choice;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=({ 'dark-ink':'#181b20','dark-clay':'#211e1c','light-ink':'#f4f2ed','light-clay':'#f3eee8' })[choice];
    return choice;
  }
  return {resolve,setChoice,apply,choices};
});

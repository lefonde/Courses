'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const theme=require('../docs/theme.js'),storage=require('../docs/storage.js'),planning=require('../docs/planning-engine.js');
test('four appearance choices round trip without changing learning records',async()=>{
  for(const choice of theme.choices){
    const state=storage.defaultState();state.sessionUpdates.lesson={status:'in-progress',note:'keep my draft'};
    theme.setChoice(state,choice);storage.validateState(state);
    const data=new Map(),adapter=storage.createStorage({localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}},{mode:'static'});
    await adapter.save(state,0);const restored=await adapter.exportState();
    assert.equal(theme.resolve(restored.settings).choice,choice);
    assert.deepEqual(restored.sessionUpdates,state.sessionUpdates);
    assert.deepEqual(restored.problemProgress,{});
    const renewed=planning.activateFresh(restored,'2026-10-16T12:00:00Z');
    assert.equal(theme.resolve(renewed.settings).choice,choice);
  }
});
test('old preferences retain their mode and invalid choices do not modify state',()=>{
  assert.equal(theme.resolve({theme:'light'}).choice,'light-ink');
  assert.equal(theme.resolve({theme:'dark'}).choice,'dark-ink');
  const state=storage.defaultState(),before=JSON.stringify(state);
  assert.throws(()=>theme.setChoice(state,'unknown'));assert.equal(JSON.stringify(state),before);
  state.settings.themePalette='unknown';assert.throws(()=>storage.validateState(state));
});
test('theme rendering updates the selector and browser color for all four choices',()=>{
  const select={},meta={},document={documentElement:{dataset:{}},getElementById:()=>select,querySelector:()=>meta};
  for(const choice of theme.choices){const state=storage.defaultState();theme.setChoice(state,choice);theme.apply(document,state.settings);
    assert.equal(select.value,choice);assert.equal(document.documentElement.dataset.theme,state.settings.theme);assert.equal(document.documentElement.dataset.palette,state.settings.themePalette);assert.match(meta.content,/^#[0-9a-f]{6}$/);
  }
});
test('theme text and essential control boundaries retain contrast across the four palettes',()=>{
  const css=fs.readFileSync(require.resolve('../docs/styles.css'),'utf8');
  const rules=[...css.matchAll(/(:root[^{}]*)\{([^{}]*)\}/g)].slice(0,4);
  const sets=rules.map(([,selector,body])=>Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):(#[a-f0-9]{3,8})[;}]/g)].map(([,k,v])=>[k,v])));
  const lum=hex=>{hex=hex.slice(1);if(hex.length===3)hex=[...hex].map(x=>x+x).join('');const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb.reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);};
  const contrast=(a,b)=>{const [low,high]=[lum(a),lum(b)].sort((a,b)=>a-b);return(high+.05)/(low+.05);};
  for(const i of [0,1,2,3]){const colors={...sets[0],...(i===1||i===3?sets[1]:{}),...(i>=2?sets[2]:{}),...(i===3?sets[3]:{})};
    for(const bg of ['bg','panel','panel-2'])for(const fg of ['text','muted','faint'])assert.ok(contrast(colors[fg],colors[bg])>=4.5,`${i} ${fg} on ${bg}`);
    assert.ok(contrast(colors['on-accent'],colors.accent)>=4.5);
    assert.ok(contrast(colors.control,colors.panel)>=3);
  }
});

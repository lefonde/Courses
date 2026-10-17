'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const policy=require('../docs/teaching-policy.js');

function harness(){
  const inputs=[],events={};
  const document={
    querySelectorAll:()=>inputs,
    getElementById:()=>null,
    addEventListener:(name,callback)=>{events[name]=callback;}
  };
  const context={document,StudyTeachingPolicy:policy};
  context.window=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../docs/teaching-ui.js'),'utf8'),context);
  function mount(){
    const mounted=[];
    for(const match of context.StudyTeaching.selector().matchAll(/<input\b[^>]*>/g)){
      const markup=match[0],input={
        name:markup.match(/\bname="([^"]+)"/)[1],
        value:markup.match(/\bvalue="([^"]+)"/)[1],
        hasAttribute:name=>name==='data-teaching-mode',
        _checked:false
      };
      // Browser radios with the same name and form owner are mutually exclusive.
      Object.defineProperty(input,'checked',{
        get(){return this._checked;},
        set(value){
          if(value)for(const peer of inputs)if(peer.name===this.name)peer._checked=false;
          this._checked=Boolean(value);
        }
      });
      inputs.push(input);mounted.push(input);
      input.checked=/\schecked(?:\s|>)/.test(markup);
    }
    return mounted;
  }
  function choose(group,value){
    const target=group.find(input=>input.value===value);
    target.checked=true;
    events.change({target});
  }
  function remove(group){for(const input of group)inputs.splice(inputs.indexOf(input),1);}
  return {teaching:context.StudyTeaching,mount,choose,remove};
}
const checked=group=>group.filter(input=>input.checked).map(input=>input.value);

test('main and preview selectors stay selected together after changing mode and closing preview',()=>{
  const h=harness(),main=h.mount(),preview=h.mount();
  assert.deepEqual(checked(main),['guided']);
  assert.deepEqual(checked(preview),['guided']);
  h.choose(preview,'independent');
  assert.equal(h.teaching.mode(),'independent');
  assert.deepEqual(checked(main),['independent']);
  assert.deepEqual(checked(preview),['independent']);
  h.remove(preview);
  assert.deepEqual(checked(main),['independent']);
  const reopened=h.mount();
  assert.deepEqual(checked(reopened),['independent']);
  h.choose(main,'guided');
  assert.deepEqual(checked(main),['guided']);
  assert.deepEqual(checked(reopened),['guided']);
});

test('each selector retains one native radio group and rerendering keeps the transient choice',()=>{
  const h=harness(),original=h.mount();
  assert.equal(new Set(original.map(input=>input.name)).size,1);
  h.choose(original,'independent');
  h.remove(original);
  const rerendered=h.mount();
  assert.equal(new Set(rerendered.map(input=>input.name)).size,1);
  assert.deepEqual(checked(rerendered),['independent']);
  h.choose(rerendered,'guided');
  assert.deepEqual(checked(rerendered),['guided']);
});

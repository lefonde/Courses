'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
globalThis.katex=require('../docs/vendor/katex/katex.min.js');
const math=require('../docs/study-math.js'),catalogue=require('../docs/data/exam-dashboard.json'),manifest=require('../docs/data/exam-problem-pages.json');

test('complete mathematical expressions have an isolated LTR boundary and accessible MathML',()=>{
  const rendered=math.text('נוסחה \\(|\\Omega|=\\Theta(n^{k/2})\\) בתוך עברית');
  assert.match(rendered,/class="study-math" dir="ltr"/);
  assert.match(rendered,/<math/);
  assert.match(rendered,/<msup>/);
  assert.doesNotMatch(rendered,/study-math-error/);
  assert.match(rendered,/נוסחה/);
  assert.match(rendered,/בתוך עברית/);
});

test('mathematical formatting does not interpret prose as markup or trusted commands',()=>{
  const rendered=math.text('<img src=x onerror=alert(1)> SAT & עברית');
  assert.doesNotMatch(rendered,/<img/);assert.match(rendered,/&lt;/);assert.match(rendered,/&amp;/);
  assert.match(rendered,/<bdi dir="ltr">SAT<\/bdi>/);
  const untrusted=globalThis.katex.renderToString('\\href{javascript:alert(1)}{x}',{trust:false,throwOnError:false});
  assert.doesNotMatch(untrusted,/href="javascript:/);
});

test('all catalogue display notation parses as TeX without changing the raw research strings',()=>{
  let count=0;
  for(const [plain,marked] of Object.entries(catalogue.mathText)){
    assert.ok(plain&&!plain.includes('\\('));
    for(const match of marked.matchAll(/\\\(([\s\S]*?)\\\)/g)){
      assert.doesNotThrow(()=>globalThis.katex.renderToString(match[1],{throwOnError:true,strict:'error'}),plain);count++;
    }
  }
  assert.ok(count>150);
});

test('only the three requested pages are registered and all exercises and formulae are consumable',()=>{
  assert.deepEqual(manifest.pages.map(p=>p.id),catalogue.families.slice(0,3).map(f=>f.id));
  for(const entry of manifest.pages){
    const html=fs.readFileSync(path.join(__dirname,'../docs/exam-problems',entry.id+'.html'),'utf8');
    for(const section of ['basic','tools','exam','check','sources'])assert.match(html,new RegExp('id="problem-'+section+'"'));
    assert.doesNotMatch(html,/<details[^>]*\bopen(?:\s|=|>)/);
    assert.ok((html.match(/class="problem-solution"/g)||[]).length>=3);
    let count=0;
    for(const match of html.matchAll(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g)){
      const tex=(match[1]??match[2]).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      assert.doesNotThrow(()=>globalThis.katex.renderToString(tex,{throwOnError:true,strict:'error'}),entry.id+': '+tex);count++;
    }
    assert.ok(count>40,entry.id+' has explicit typeset mathematical content');
    assert.equal(catalogue.families.find(f=>f.id===entry.id).lessonUrl,'#exam-problem/'+entry.id);
  }
});

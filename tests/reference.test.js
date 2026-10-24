'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../docs/reference-engine.js'),links=require('../docs/data/reference-links.json');
const entries=['sat','walk','probability'].flatMap(name=>require('../docs/data/reference-'+name+'.json'));
const katex=require('../docs/vendor/katex/katex.min.js');
const sources=require('../docs/data/curriculum.json').sources;

test('the exact family phrase is one reference and preserves surrounding Hebrew and math',()=>{
  const phrase='משפחה \\(\\mathcal F_{n,k}\\) של \\(O(n^{\\lfloor k/2\\rfloor})\\) השמות';
  const text='הוכיחו שקיימת '+phrase+', הנבחרת לפני קבלת הקלט.';
  const parts=engine.matcher(links)(text);
  assert.equal(parts.map(p=>p.text).join(''),text);
  assert.deepEqual(parts.filter(p=>p.id),[{text:phrase,id:'assignment-family'},{text:'לפני קבלת הקלט',id:'universal-family'}]);
});

test('specific concepts take precedence, word endings are intact, and unrelated TeX is never split',()=>{
  const split=engine.matcher(links);
  assert.equal(split('לינאריות התוחלת')[0].id,'linearity-expectation');
  assert.equal(split('אי־תלות בשלשות')[0].id,'kwise-independence');
  assert.equal(split('התוחלת')[1].id,'expectation');
  assert.equal(split('תוחלתית').some(p=>p.id),false);
  const tex='\\(\\text{תוחלת} + O(n)\\)';
  assert.deepEqual(split(tex),[{text:tex}]);
  assert.deepEqual(engine.matcher([])('טקסט'),[{text:'טקסט'}]);
});

test('every reference and related link resolves and each entry has an explanation and provenance',()=>{
  const ids=new Set(entries.map(e=>e.id));
  assert.equal(ids.size,entries.length);
  for(const link of links){assert.ok(ids.has(link.id),link.id);assert.ok(link.phrases.length);}
  for(const entry of entries){
    for(const key of ['id','title','kind','summary','example','body'])assert.ok(entry[key],entry.id+' '+key);
    assert.match(entry.body,/<h2>/,entry.id+' has structured full text');
    assert.ok(entry.sources.length,entry.id+' provenance');
    for(const ref of entry.sources)if(ref.sourceId)assert.ok(sources[ref.sourceId],entry.id+' source '+ref.sourceId);
    for(const id of entry.related)assert.ok(ids.has(id),entry.id+' → '+id);
    assert.doesNotMatch(entry.body,/<script|\bon\w+\s*=|javascript:|file:\/\/|C:\\\\Users/i);
  }
});

test('all reference TeX renders under strict untrusted KaTeX',()=>{
  for(const entry of entries){
    const texts=[entry.title,entry.summary,entry.example,entry.body];
    if(entry.formula)texts.push('\\['+entry.formula+'\\]');
    for(const value of texts)for(const m of value.matchAll(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g)){
      const tex=(m[1]??m[2]).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      assert.doesNotThrow(()=>katex.renderToString(tex,{strict:'error',throwOnError:true,trust:false}),entry.id+': '+tex);
    }
  }
});

test('search accepts Hebrew vowel marks and aliases, combines words, and respects kind filtering',()=>{
  const sample=[{id:'one',title:'תוחלת מותנית',kind:'הגדרה',summary:'ממוצע',aliases:['התניה']},{id:'two',title:'לינאריות התוחלת',kind:'משפט',summary:'סכום תוחלות'}];
  assert.deepEqual(engine.filter(sample,{search:'תּוֹחֶלֶת מותנית'}).map(e=>e.id),['one']);
  assert.deepEqual(engine.filter(sample,{search:'התניה'}).map(e=>e.id),['one']);
  assert.deepEqual(engine.filter(sample,{search:'תוחלת',kind:'משפט'}).map(e=>e.id),['two']);
  assert.deepEqual(engine.filter(sample,{search:'אין מושג כזה'}),[]);
});

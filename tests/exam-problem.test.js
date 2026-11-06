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

test('English source names keep their word order as one LTR phrase in Hebrew prose',()=>{
  const rendered=math.text("מקור: Course Guide Chapter 3, עמ' 65. לאחר מכן Course Book Chapter 3.");
  assert.match(rendered,/<bdi dir="ltr">Course Guide Chapter 3<\/bdi>/);
  assert.match(rendered,/<bdi dir="ltr">Course Book Chapter 3<\/bdi>/);
  assert.doesNotMatch(rendered,/<bdi dir="ltr">Course<\/bdi>/);
  assert.match(rendered,/לאחר מכן/);
  const supplied=math.text("מקור: Course Guide - Chapter 2, עמ' 33. English - עברית");
  assert.match(supplied,/<bdi dir="ltr">Course Guide - Chapter 2<\/bdi>/);
  assert.match(supplied,/<bdi dir="ltr">English<\/bdi> - עברית/);
});

test('lesson introduction typesets inline formulas while treating its prose as untrusted text',async()=>{
  const vm=require('node:vm'),key='synthetic-lesson';
  let loaded;
  const ready=new Promise(resolve=>{loaded=resolve;});
  const family={id:key,title:'כותרת',themeLabel:'נושא',rank:1,score:1};
  const meta={id:key,lead:String.raw`חסם \(4\vert{}V\vert{}\vert{}E\vert{}\) <img src=x onerror=alert(1)>`};
  const context=vm.createContext({window:{},location:{hash:'#exam-problem/'+key},document:{addEventListener(){}},state:{},
    currentPage:()=> 'exam-problem',render:loaded,StudyMath:math,
    StudyExamDashboard:{load:async()=>{},family:()=>family},
    StudyReference:{load:async()=>{},help:()=>''},StudyExamDashboardEngine:{getLearned:()=>false},
    fetch:async url=>({ok:true,json:async()=>({pages:[meta]}),text:async()=>'<section></section>'})});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../docs/exam-problem-ui.js'),'utf8'),context);
  context.window.StudyExamProblems.reader();await ready;
  const output=context.window.StudyExamProblems.reader(),lead=output.match(/<p class="problem-lead">([\s\S]*?)<\/p>/)[1];
  assert.match(lead,/class="study-math" dir="ltr"/);
  assert.match(lead,/<math/);assert.doesNotMatch(lead,/study-math-error|<img/);
  assert.match(lead,/&lt;/);assert.match(lead,/&gt;/);
});

test('Hebrew event labels retain their wording and RTL direction within LTR probability formulas',()=>{
  const tex=String.raw`P(\text{לפחות סל אחד אינו מאוזן}) \le \frac{1}{n^2}`;
  const rendered=math.text('\\['+tex+'\\]');
  assert.doesNotMatch(rendered,/study-math-error/);
  assert.match(rendered,/class="study-math study-math-block" dir="ltr"/);
  assert.match(rendered,/<span class="mord text" dir="auto" style="unicode-bidi:isolate">/);
  assert.match(rendered,/<mtext dir="rtl">לפחות\s+סל\s+אחד\s+אינו\s+מאוזן<\/mtext>/);
  assert.ok(rendered.includes(tex));
  assert.throws(()=>math.renderFormula(String.raw`\unknownCommand{x}`));
  assert.throws(()=>math.renderFormula(String.raw`\text{😀}`));
  const untrusted=math.renderFormula(String.raw`\href{javascript:alert(1)}{\text{עברית}}`);
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

test('the ten requested pages are registered and all exercises and formulae are consumable',()=>{
  assert.deepEqual(manifest.pages.map(p=>p.id),catalogue.families.slice(0,10).map(f=>f.id));
  for(const entry of manifest.pages){
    const html=fs.readFileSync(path.join(__dirname,'../docs/exam-problems',entry.id+'.html'),'utf8');
    for(const section of ['basic','tools','exam','check'])assert.match(html,new RegExp('id="problem-'+section+'"'));
    const sections=entry.sections||[['basic'],['tools'],['exam'],['check'],['sources']];
    for(const [section] of sections)assert.match(html,new RegExp('id="problem-'+section+'"'),entry.id+' navigation destination '+section);
    assert.doesNotMatch(html,/<details[^>]*\bopen(?:\s|=|>)/);
    assert.ok((html.match(/class="problem-solution"/g)||[]).length>=3);
    let count=0;
    for(const match of html.matchAll(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g)){
      const tex=(match[1]??match[2]).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      assert.doesNotThrow(()=>math.renderFormula(tex),entry.id+': '+tex);count++;
    }
    assert.ok(count>40,entry.id+' has explicit typeset mathematical content');
    assert.equal(catalogue.families.find(f=>f.id===entry.id).lessonUrl,'#exam-problem/'+entry.id);
  }
});

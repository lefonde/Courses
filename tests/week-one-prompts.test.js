'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {lessons}=require('../docs/lesson-content.js'),engine=require('../docs/lesson-engine.js'),storage=require('../docs/storage.js'),policy=require('../docs/teaching-policy.js'),curriculum=require('../docs/data/curriculum.json');
const clone=x=>JSON.parse(JSON.stringify(x));
function harness(){
 const events={},elements=new Map(),content=clone(lessons);
 const context={StudyLessonContent:{lessons:content},StudyLessonEngine:engine,StudyTeachingPolicy:policy,StudyLearningEngine:{promptContext:()=>''},state:storage.defaultState(),location:{hash:'#lesson/'+content[0].sessionId+'/guided'},crypto:require('node:crypto').webcrypto,
  setTimeout:()=>0,clearTimeout:()=>{},document:{querySelectorAll:()=>[],getElementById:id=>elements.get(id),addEventListener:(type,fn)=>events[type]=fn},addEventListener:()=>{},esc:x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  sourceOf:id=>curriculum.sources[id],problemOf:id=>curriculum.problems.find(p=>p.id===id),sessionOf:()=>({minutes:90}),timeLabel:()=>'',sourceLink:()=>'<a>source</a>',notify:()=>{},
  openDialog:(...args)=>{context.dialog=args;elements.set('prompt-text',{tagName:'TEXTAREA',value:''});},$:()=>({}),navigator:{clipboard:{writeText:async text=>context.clipboard=text}}};
 context.window=context;vm.createContext(context);for(const file of ['teaching-ui','lesson-ui'])vm.runInContext(fs.readFileSync(require.resolve('../docs/'+file+'.js'),'utf8'),context);
 return {context,events,elements,content};
}
test('every section request respects activity and chosen mode without exporting hidden help or draft',()=>{
 const h=harness(),c=h.context;
 for(const l of h.content)for(const s of l.sections){
  const hidden='HIDDEN_HELP_'+l.number+'_'+s.id,privateText='PRIVATE_DRAFT_'+l.number+'_'+s.id;
  s.example={title:hidden,body:[{type:'paragraph',text:hidden}]};if(s.question){s.question.hints.push(hidden);s.question.solution.push({type:'paragraph',text:hidden});s.question.check.push(hidden);}
  engine.update(c.state,l,s.id,{draft:privateText});
  for(const mode of ['guided','independent']){
   c.StudyTeaching.setMode(mode);const before=JSON.stringify(c.state),request=c.StudyLessons.prompt(l.sessionId,s.id);
   assert.equal(JSON.stringify(c.state),before,'prompt generation cannot save progress');assert.ok(request.includes(s.title));if(s.question)assert.ok(request.includes(s.question.text));
   assert.ok(!request.includes(hidden));assert.ok(!request.includes(privateText));assert.doesNotMatch(request,/התחל בשאלה ממוקדת על הקושי שלי|החזר מקטע JSON|reportId|progress\.json|schedule\.json|Lectures\/|Mamans\//);
   assert.ok(request.includes('אל תפתור אותה אלא אם אבקש במפורש'));
   assert.ok(request.includes('NotebookLM'));assert.ok(request.includes('עמודי PDF'));
   const activity=s.activity||(s.id==='summary'?'wrapup':'practice');
   if(activity==='wrapup'){assert.ok(request.includes('אל תתחיל תרגיל חדש'));assert.ok(!request.includes('אופן העבודה שבחרתי'));}
   else if(['practice','recall','mixed'].includes(activity)){assert.ok(request.includes(mode==='guided'?'אופן העבודה שבחרתי: פתרון בהכוונה.':'אופן העבודה שבחרתי: ניסיון עצמאי ואז פתרון מלא.'));}
   else assert.ok(!request.includes('אופן העבודה שבחרתי'));
   for(const id of s.official||[])assert.ok(request.includes('שאלה '+id.split('-q')[1]));
  }
 }
});
test('revealing hidden equations makes only horizontally scrollable formulas keyboard reachable',()=>{
 const h=harness(),nodes=[{scrollWidth:600,clientWidth:190},{scrollWidth:100,clientWidth:190}];
 h.context.document.querySelectorAll=selector=>selector==='.lesson-equation'?nodes:[];
 h.events.toggle({target:{open:true,isConnected:true,dataset:{}}});
 assert.equal(nodes[0].tabIndex,0);assert.equal(nodes[1].tabIndex,-1);
 nodes[0].clientWidth=650;h.events.toggle({target:{open:true,isConnected:true,dataset:{}}});assert.equal(nodes[0].tabIndex,-1);
});
test('recorded help is reported honestly while absent records never claim independence',()=>{
 const {context:c,content}=harness(),l=content[0],sid='guided';
 assert.ok(c.StudyLessons.prompt(l.sessionId,sid).includes('אין להסיק מהיעדר רישום עזרה'));
 engine.update(c.state,l,sid,{hints:1});assert.ok(c.StudyLessons.prompt(l.sessionId,sid).includes('כבר נפתח רמז'));
 engine.update(c.state,l,sid,{solution:true});assert.ok(c.StudyLessons.prompt(l.sessionId,sid).includes('כבר נפתח פתרון'));
});
test('practice offers both help modes and preview refreshes the same payload copied by its action',async()=>{
 const h=harness(),c=h.context,sid=h.content[0].sessionId;
 c.location.hash='#lesson/'+sid+'/guided';const html=c.StudyLessons.reader();assert.ok(html.includes('data-teaching-mode'));assert.ok(html.includes('value="guided"'));assert.ok(html.includes('value="independent"'));
 await h.events.click({target:{closest:()=>({dataset:{lessonAction:'preview'}})}});assert.ok(c.dialog[3].includes('data-teaching-mode'));
 c.StudyTeaching.setMode('independent');const preview=h.elements.get('prompt-text').value;assert.ok(preview.includes('ניסיון עצמאי ואז פתרון מלא'));
 await h.events.click({target:{closest:()=>({dataset:{lessonAction:'copy'}})}});assert.equal(c.clipboard,preview);
});
test('optional worked example and prior question context are closed and never interpolated unsafely',()=>{
 const h=harness(),c=h.context,l=h.content[0],s=l.sections.find(s=>s.id==='guided');
 s.example={title:'דוגמה לבחירה',body:[{type:'paragraph',text:'<script>bad()</script>'}]};
 c.StudyPreviousLessonContent={[l.sessionId]:{guided:{body:[{type:'paragraph',text:'older experiment'}],question:'older question'}}};
 assert.ok(!c.StudyLessons.reader().includes('older experiment'));
 engine.update(c.state,l,'guided',{draft:'existing work'});const before=JSON.stringify(c.state),html=c.StudyLessons.reader();assert.equal(JSON.stringify(c.state),before);
 assert.match(html,/<details class="lesson-details lesson-worked-example" data-lesson-help="solution">/);assert.match(html,/<details class="lesson-details lesson-previous" data-lesson-help="solution">/);assert.ok(html.includes('older experiment'));assert.ok(html.includes('existing work'));assert.doesNotMatch(html,/<script>bad/);assert.ok(html.includes('&lt;script&gt;'));
});

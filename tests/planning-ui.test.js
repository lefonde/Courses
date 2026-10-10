'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const engine=require('../docs/catch-up-engine.js'),storage=require('../docs/storage.js'),calendar=require('../docs/plan-calendar.js'),schedule=require('../docs/data/schedule.json');
const clone=x=>JSON.parse(JSON.stringify(x));
// Event-level integration harness: real wizard + planner + storage validation.
// This does not claim browser layout or accessibility-tree coverage.
function harness(date='2026-10-10'){
 const handlers={},elements=new Map(),view={title:'',body:'',footer:'',closed:false},original=storage.defaultState();
 original.settings.activePlanId='november-2026';original.sessionUpdates[schedule.sessions[0].id]={note:'keep this note',learned:false};
 function element(selector){if(!elements.has(selector))elements.set(selector,{textContent:'',disabled:false,checked:false,isConnected:true,scrollIntoView(){},reportValidity(){return true;},insertAdjacentHTML(where,text){if(selector==='#dialog-content')view.footer+=text;else this.textContent+=text;}});return elements.get(selector);}
 class Fields{constructor(form){this.values=form.values||{};}get(key){const value=this.values[key];return Array.isArray(value)?value[0]:value??null;}getAll(key){const v=this.values[key];return v===undefined?[]:Array.isArray(v)?v:[v];}has(key){return Object.hasOwn(this.values,key);}}
 const RealDate=Date;class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[date+'T08:00:00Z']));}static now(){return new RealDate(date+'T08:00:00Z').getTime();}}
 const context={StudyCatchUpEngine:engine,StudyPlanCalendar:calendar,StudyPlanningEngine:require('../docs/planning-engine.js'),schedule,state:clone(original),activeDate:date,selectedDate:date,previousSchedule:{sessions:[]},console,Date:FixedDate,FormData:Fields,setTimeout,clearTimeout,location:{hash:''},esc:x=>String(x??'').replaceAll('<','&lt;').replaceAll('"','&quot;'),fmtDate:x=>x,fmtDay:()=>'',timeLabel:n=>n+' דקות',dateNow:()=>date,safeDate:x=>x,heading:()=>'',problemOf:()=>null,notify:message=>{view.notice=message;},render(){},closeDialog(){view.closed=true;},openDialog(type,id,title,body){view.title=title;view.body=body;view.footer='';elements.clear();},$:element,document:{addEventListener(type,handler){handlers[type]=handler;},querySelector:element}};
 context.window=context;context.sessionOf=id=>engine.effective(schedule,context.state).find(s=>s.id===id);
 context.save=async fn=>{const next=clone(context.state);fn(next);next.revision++;context.state=storage.validateState(next);};
 context.StudyStorage={exportState:async()=>clone(context.state)};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../docs/planning-ui.js'),'utf8'),context);
 const click=async(action,id)=>{const b={dataset:{planAction:action,id},isConnected:true};await handlers.click({target:{closest:()=>b}});};
 const submit=async(id,values)=>{const form={id,values,reportValidity:()=>true};elements.set('#'+id,form);await handlers.submit({target:form,preventDefault(){}});};
 const progress=()=>Object.fromEntries([['from',date],...schedule.sessions.flatMap(s=>[['status-'+s.id,'planned'],['remaining-'+s.id,'']])]);
 const adjustment=()=>Object.fromEntries(schedule.days.filter(d=>d.date>=date&&d.date<schedule.exam.date).map(d=>['capacity-'+d.date,engine.capacity(schedule,context.state,d.date)]));
 return {context,view,original,elements,element,handlers,click,submit,progress,adjustment};
}
test('guided partial-plan flow requires acknowledgement and saves learning intact',async()=>{
 const h=harness();await h.click('repair');assert.match(h.view.title,/איפה ממשיכים/);assert.match(h.view.body,/catch-up-from/);assert.match(h.view.footer,/catch-up-progress/);
 await h.submit('catch-up-progress',h.progress());assert.match(h.view.title,/נתאים/);assert.match(h.view.body,/6|360/);assert.match(h.view.body,/capacity-2026-10-10/);
 await h.submit('catch-up-adjust',h.adjustment());assert.match(h.view.title,/לפני שמירה/);assert.match(h.view.body,/חומר שלא נכנס/);assert.match(h.view.footer,/disabled/);
 const ack=h.element('#plan-partial-ack');ack.checked=true;h.handlers.change({target:{id:'plan-partial-ack',checked:true}});assert.equal(h.element('[form="catch-up-save"]').disabled,false);
 await h.submit('catch-up-save',{});assert.equal(h.view.title,'התוכנית נשמרה');assert.match(h.view.body,/תוכנית חלקית/);assert.equal(h.context.state.sessionUpdates[schedule.sessions[0].id].note,'keep this note');assert.match(h.context.StudyPlanner.backlog(),/ללא שיבוץ/);assert.equal(h.context.state.revision,1);
 await h.click('history');assert.match(h.view.body,/נשמרה תוכנית חלקית/);
});
test('additional-window flow reaches complete review and saves without partial acknowledgement',async()=>{
 const h=harness();await h.click('repair');await h.submit('catch-up-progress',h.progress());h.elements.set('#catch-up-adjust',{values:h.adjustment(),reportValidity:()=>true});await h.click('suggest-time');assert.match(h.view.body,/נוספו לטיוטה/);
 // Read the availability defaults actually emitted by the wizard, including suggestions.
 const values={};for(const match of h.view.body.matchAll(/name="(capacity-[^"]+)"[^>]*value="(\d+)"/g))values[match[1]]=Number(match[2]);
 await h.submit('catch-up-adjust',values);assert.match(h.view.body,/תוכנית מלאה/);assert.doesNotMatch(h.view.body,/id="plan-partial-ack"/);
 await h.submit('catch-up-save',{});assert.equal(h.view.title,'התוכנית נשמרה');assert.equal(h.context.state.settings.catchUpChanges[0].partial,false);assert.equal(h.context.StudyPlanner.backlog(),'');
});
test('cancelling staged completion and availability never changes saved progress',async()=>{
 const h=harness();await h.click('repair');const values=h.progress();values['status-'+schedule.sessions[0].id]='completed';await h.submit('catch-up-progress',values);await h.click('cancel');assert.deepEqual(h.context.state,h.original);assert.equal(h.view.closed,true);
});
test('a changed state keeps the proposal unsaved and offers refresh',async()=>{
 const h=harness();await h.click('repair');await h.submit('catch-up-progress',h.progress());await h.submit('catch-up-adjust',h.adjustment());h.element('#plan-partial-ack').checked=true;h.context.state.revision++;
 await h.submit('catch-up-save',{});assert.match(h.element('#plan-error').textContent,/השתנו/);assert.match(h.element('#plan-error').textContent,/refresh/);assert.equal(h.context.state.settings.catchUpChanges,undefined);
});
test('after the exam there is no impossible date form',async()=>{const h=harness('2026-11-23');await h.click('repair');assert.match(h.view.title,/הסתיימה/);assert.doesNotMatch(h.view.body,/type="date"/);});
test('all entrypoints load the new engine before the wizard and scripts parse',()=>{
 for(const page of ['index.html','preview-learning.html']){const html=fs.readFileSync(path.join(__dirname,'../docs',page),'utf8');assert.ok(html.indexOf('catch-up-engine.js')<html.indexOf('planning-ui.js'));assert.ok(html.includes('catch-up-engine.js'));}
 for(const file of fs.readdirSync(path.join(__dirname,'../docs')).filter(f=>f.endsWith('.js')))new vm.Script(fs.readFileSync(path.join(__dirname,'../docs',file),'utf8'),{filename:file});
});

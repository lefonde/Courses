'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const {File,Blob}=require('node:buffer');
const code=fs.readFileSync(path.join(__dirname,'../docs/source-library.js'),'utf8');
const legacyDB='study-compass-course-sources-v1';
const course={id:'advanced-algorithms',offeringId:'exam-prep',sourceDatabase:'study-erdos-advanced-algorithms-exam-prep-sources-v1',data:{curriculum:'./courses/advanced-algorithms/curriculum.json'}};
const digest=text=>createHash('sha256').update(text).digest('hex');
function harness(selected=course, databases=new Map()) {
  const opened=[], fetched=[], nodes=new Map(), listeners={};
  let rejectWrites=false;
  for (const id of ['source-library-status','source-library-feedback','source-library-missing']) nodes.set(id,{textContent:'',innerHTML:''});
  const indexedDB={open(name) {
    opened.push(name);
    if (!databases.has(name)) databases.set(name,new Map());
    const records=databases.get(name);
    const request={result:{objectStoreNames:{contains:()=>true},close(){},transaction() {
      const transaction={objectStore:()=>({
        get(key) {const read={};queueMicrotask(()=>{read.result=records.get(key);read.onsuccess?.();});return read;},
        getAllKeys() {const read={};queueMicrotask(()=>{read.result=[...records.keys()];read.onsuccess?.();});return read;},
        put(record) {const write={};queueMicrotask(()=>{if(rejectWrites){transaction.error=Object.assign(new Error('Synthetic storage quota'),{name:'QuotaExceededError'});transaction.onabort?.();return;}records.set(record.path,record);transaction.oncomplete?.();});return write;}
      })};return transaction;
    }}};
    queueMicrotask(()=>request.onsuccess?.());return request;
  }};
  const context={Blob,Uint8Array,crypto:webcrypto,indexedDB,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},
    document:{getElementById:id=>nodes.get(id)||null,addEventListener:(type,handler)=>{listeners[type]=handler;}},dispatchEvent(){},
    fetch:async url=>{fetched.push(url);return {ok:true,json:async()=>({sources:{}})};}, location:{href:''}};
  if (selected!==undefined) context.StudyCourses={current:()=>selected};
  context.window=context;vm.runInNewContext(code,context);
  return {api:context.SourceLibrary,context,opened,fetched,databases,nodes,listeners,rejectWrites:()=>{rejectWrites=true;}};
}
test('same source paths are isolated by course database and catalog URL', async()=>{
  const databases=new Map([[legacyDB,new Map([['same.pdf',{path:'same.pdf',blob:new Blob(['old'])}]])]]);
  const h=harness(course,databases); await h.api.getSources();
  assert.deepEqual(h.fetched,[course.data.curriculum]);
  await h.api.init({sources:{x:{path:'same.pdf',label:'Synthetic source'}}});
  assert.equal(await h.api.getFile('same.pdf'),null);
  assert.deepEqual(h.opened,[course.sourceDatabase]);
  assert.equal(await databases.get(legacyDB).get('same.pdf').blob.text(),'old');
  assert.equal(h.api.libraryUrl(),'./?course=advanced-algorithms&offering=exam-prep#library');
});
test('legacy source database and path matching remain compatible', async()=>{
  const h=harness({id:'random-algorithms',offeringId:'2026-s3',sourceDatabase:legacyDB,data:{curriculum:'./data/curriculum.json'}});
  const file=new File(['%PDF-old'],'source.pdf');
  Object.defineProperty(file,'webkitRelativePath',{value:'Course/Lectures/source.pdf'});
  const match=await h.api.matchSelection([file],[{path:'Lectures/source.pdf'}]);
  assert.equal(match.matches.length,1); assert.equal(match.matches[0][0],'Lectures/source.pdf');
  const duplicates=await h.api.matchSelection([file,file],[{path:'Lectures/source.pdf'}]);
  assert.equal(duplicates.matches.length,0);assert.equal(duplicates.duplicateCount,1);
  await h.api.savedPaths(); assert.deepEqual(h.opened,[legacyDB]);
  assert.equal(h.api.libraryUrl(),'./#library');
});
test('hashed source import distinguishes same names and deduplicates byte-identical copies', async()=>{
  const h=harness(), good='%PDF-good', wrong='%PDF-else';
  const source={id:'neutral',path:'aa-source-neutral.pdf',label:'מקור 1',sha256:digest(good),bytes:Buffer.byteLength(good)};
  await h.api.init({sources:{neutral:source}});
  const files=[new File([wrong],'identical-name.pdf'),new File([good],'identical-name.pdf'),new File([good],'renamed-copy.pdf')];
  const match=await h.api.matchSelection(files,[source]);
  assert.equal(match.matches.length,1);assert.equal(match.duplicateCount,0);
  assert.equal(await match.matches[0][1][0].text(),good);
  await h.api.importSelection(files);
  const record=h.databases.get(course.sourceDatabase).get(source.path);
  assert.equal(await record.blob.text(),good);
  assert.equal(h.databases.has(legacyDB),false);
  assert.equal(h.databases.get(course.sourceDatabase).size,1);
});
test('hash failures never fall back to matching the neutral filename', async()=>{
  const h=harness(), content='%PDF-data', source={path:'aa-source.pdf',sha256:digest(content),bytes:content.length};
  h.context.crypto={subtle:{digest:async()=>{throw new Error('Synthetic digest failure');}}};
  await h.api.init({sources:{x:source}});
  const match=await h.api.matchSelection([new File([content],source.path)],[source]);
  assert.equal(match.matches.length,0); assert.equal(match.hashFailures.length,1);
  await h.api.importSelection([new File([content],source.path)]);
  assert.equal([...h.databases.values()].every(records=>records.size===0),true);
});
test('unknown course context cannot fetch the legacy catalog or open its database',async()=>{
  const h=harness(null);
  assert.throws(()=>h.api.getSources());
  await assert.rejects(h.api.savedPaths());
  assert.deepEqual(h.fetched,[]);assert.deepEqual(h.opened,[]);
  assert.equal(h.api.libraryUrl(),'./');
});
test('source viewer loads course selection before sources and retains return context',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../docs/source.html'),'utf8');
  assert.ok(html.indexOf('course-manifests.js')<html.indexOf('course-context.js'));
  assert.ok(html.indexOf('course-context.js')<html.indexOf('source-library.js'));
  const viewer=fs.readFileSync(path.join(__dirname,'../docs/source-viewer.js'),'utf8');
  assert.match(viewer,/SourceLibrary\.libraryUrl\(\)/);
});
test('source quota failure retains the prior PDF and exposes a recoverable message',async()=>{
  const content='%PDF-actual',source={path:'aa-source.pdf',label:'Synthetic source',sha256:digest(content),bytes:content.length};
  const prior={path:source.path,blob:new Blob(['%PDF-prior']),name:'old.pdf'};
  const records=new Map([[source.path,prior]]),h=harness(course,new Map([[course.sourceDatabase,records]]));
  await h.api.init({sources:{x:source}});h.rejectWrites();
  await h.api.importSelection([new File([content],'new.pdf')]);
  assert.equal(records.get(source.path),prior);
  assert.equal(await records.get(source.path).blob.text(),'%PDF-prior');
  assert.match(h.nodes.get('source-library-feedback').textContent,/אין מספיק מקום/);
});
test('the actual public source catalog has neutral unique identities and complete hashes',async()=>{
  const curriculum=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/courses/advanced-algorithms/curriculum.json'),'utf8'));
  const sources=Object.values(curriculum.sources);
  assert.equal(curriculum.meta.courseId,course.id);assert.equal(curriculum.meta.offeringId,course.offeringId);
  assert.equal(sources.length,31);assert.equal(new Set(sources.map(source=>source.sha256)).size,31);
  const h=harness();await h.api.init(curriculum);
  assert.equal((await h.api.getSources()).length,31);
  for(const source of sources){assert.match(source.path,/^aa-source-[a-f0-9]+\.pdf$/);assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isInteger(source.bytes)&&source.bytes>0);}
});
test('invalid source-viewer context offers explicit course choices before accessing any source data',async()=>{
  const courses=require('../docs/course-context.js').createContext('?course=missing');
  const element=tag=>({tag,children:[],append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;}});
  const nodes=new Map(['source-library-back','source-title','source-view','source-detail'].map(id=>[id,element('div')]));
  let sourceAccess=0;
  const context={StudyCourses:courses,SourceLibrary:{libraryUrl:()=> './',getSources:()=>{sourceAccess++;throw new Error('Unexpected catalog access');}},
    document:{getElementById:id=>nodes.get(id),createElement:element},location:{search:'?course=missing',hash:''},addEventListener(){}};
  context.window=context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../docs/source-viewer.js'),'utf8'),context);
  await Promise.resolve();
  assert.equal(sourceAccess,0);
  const panel=nodes.get('source-view').children[0], choices=panel.children.at(-1).children;
  assert.equal(choices.length,courses.all().length);
  for(let i=0;i<choices.length;i++){
    const url=new URL(choices[i].href,'https://example.test/Courses/');
    assert.equal(courses.resolve(url.search).course.id,courses.all()[i].id);
    assert.equal(url.hash,'#library');assert.equal(choices[i].textContent,courses.all()[i].title);
  }
  assert.equal(nodes.get('source-library-back').href,'./');
});
test('folder and individual PDF inputs both import through the event handler and stay disabled while working',async()=>{
  for(const inputId of ['source-folder-input','source-files-input']){
    const h=harness(),content='%PDF-event',source={path:'aa-event.pdf',label:'Synthetic source',sha256:digest(content),bytes:content.length};
    await h.api.init({sources:{x:source}});
    const file=new File([content],'guide.pdf');
    if(inputId==='source-folder-input')Object.defineProperty(file,'webkitRelativePath',{value:'Synthetic/guide.pdf'});
    for(const id of ['source-folder-input','source-files-input'])h.nodes.set(id,{id,files:[file],disabled:false,value:'selected'});
    let finishHash;const waiting=new Promise(resolve=>{finishHash=resolve;});
    h.context.crypto={subtle:{digest:async(...args)=>{await waiting;return webcrypto.subtle.digest(...args);}}};
    const imported=h.listeners.change({target:h.nodes.get(inputId)});
    assert.equal(h.nodes.get('source-folder-input').disabled,true);assert.equal(h.nodes.get('source-files-input').disabled,true);
    finishHash();await imported;
    assert.equal(await h.databases.get(course.sourceDatabase).get(source.path).blob.text(),content);
    for(const id of ['source-folder-input','source-files-input']){assert.equal(h.nodes.get(id).disabled,false);assert.equal(h.nodes.get(id).value,'');}
  }
});
test('individual legacy PDF selection uses a unique filename and refuses ambiguous names',async()=>{
  const selected={id:'random-algorithms',offeringId:'2026-s3',sourceDatabase:legacyDB,data:{curriculum:'./data/curriculum.json'}};
  const h=harness(selected), file=new File(['%PDF-legacy'],'guide.pdf');
  await h.api.init({sources:{x:{path:'Lectures/guide.pdf',label:'Synthetic source'}}});
  await h.listeners.change({target:{id:'source-files-input',files:[file]}});
  assert.equal(await h.databases.get(legacyDB).get('Lectures/guide.pdf').blob.text(),'%PDF-legacy');
  const ambiguous=harness(selected);
  await ambiguous.api.init({sources:{x:{path:'Lectures/guide.pdf'},y:{path:'Other/guide.pdf'}}});
  await ambiguous.listeners.change({target:{id:'source-files-input',files:[file]}});
  assert.equal(ambiguous.databases.get(legacyDB).size,0);
  assert.match(ambiguous.nodes.get('source-library-feedback').textContent,/מתאים לכמה מקורות/);
});

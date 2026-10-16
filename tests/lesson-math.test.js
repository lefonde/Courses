'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {lessons}=require('../docs/lesson-content.js'),schedule=require('../docs/data/schedule.json'),curriculum=require('../docs/data/curriculum.json');
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length,variance=xs=>mean(xs.map(x=>(x-mean(xs))**2));
const section=(i,id)=>lessons[i].sections.find(s=>s.id===id),equations=s=>s.question.solution.filter(b=>b.type==='equation').map(b=>b.text);
function permutations(xs){if(!xs.length)return [[]];return xs.flatMap((x,i)=>permutations(xs.filter((_,j)=>i!==j)).map(p=>[x,...p]));}
test('exhaustive coin outcomes independently verify both covariance exercises',()=>{
 const triples=Array.from({length:8},(_,i)=>[i>>2&1,i>>1&1,i&1]),a=triples.map(([x,y])=>x*y),b=triples.map(([,y,z])=>y*z),v=triples.map(([,y,z])=>(1-y)*z);
 approx(mean(a),1/4);approx(variance(a),3/16);approx(mean(a.map((x,i)=>x*b[i]))-mean(a)*mean(b),1/16);
 approx(variance(a.map((x,i)=>x+b[i])),1/2);approx(mean(a.map((x,i)=>x*v[i]))-mean(a)*mean(v),-1/16);approx(variance(a.map((x,i)=>x+v[i])),1/4);
 assert.ok(equations(section(0,'guided')).includes('Var(S) = 3/16 + 3/16 + 2/16 = 1/2'));assert.ok(equations(section(0,'practice')).includes('E[T] = 1/2,   Var(T) = 3/16 + 3/16 − 2/16 = 1/4'));
});
test('enumerating all permutations verifies fixed points, transpositions and joint probabilities',()=>{
 for(let n=2;n<=7;n++){
  const all=permutations(Array.from({length:n},(_,i)=>i)),fixed=all.map(p=>p.filter((x,i)=>x===i).length),swaps=all.map(p=>p.filter((x,i)=>x>i&&p[x]===i).length);
  approx(mean(fixed),1);approx(variance(fixed),1);approx(mean(swaps),1/2);if(n>=4)approx(variance(swaps),1/2);
  approx(all.filter(p=>p[0]===0&&p[1]===1).length/all.length,1/(n*(n-1)));
 }
 assert.deepEqual(section(2,'recall').question.solution.find(b=>b.type==='table').rows.map(r=>Number(r[1])),[3,1,1,0,0,1]);
 const bounds=section(2,'assignment').question.solution.find(b=>b.type==='table');assert.deepEqual(bounds.rows,[['X ≥ 7','1/7','1/(7−1)² = 1/36'],['Y ≥ 3','(1/2)/3 = 1/6','(1/2)/(3−1/2)² = 2/25']]);approx((.5)/(3-.5)**2,2/25);
});
test('the balls/bin argument uses only pairwise independence and the published constant works',()=>{
 // Affine functions over a prime field are pairwise independent, not jointly independent.
 for(const n of [2,3,5,7]){
  const outcomes=[];for(let a=0;a<n;a++)for(let b=0;b<n;b++)outcomes.push(Array.from({length:n},(_,i)=>(a*i+b)%n));
  const loads=outcomes.map(o=>o.filter(j=>j===0).length);approx(mean(loads),1);approx(variance(loads),1-1/n);
  const failure=outcomes.filter(o=>Math.max(...Array.from({length:n},(_,j)=>o.filter(v=>v===j).length))>3*Math.sqrt(n)).length/outcomes.length;assert.ok(failure<=.5);
 }
 for(let n=1;n<=1000;n++){assert.ok(1+2*Math.sqrt(n)<=3*Math.sqrt(n)+1e-10);approx(n/(2*Math.sqrt(n))**2,.25);}
 assert.ok(equations(section(1,'assignment')).includes('P(M ≥ 1+2√n) ≤ 1/4'));
});
test('coupon and run bounds respect rounding, overlap and the requested limits',()=>{
 const m=Math.ceil(100*Math.log(2000));assert.equal(m,761);assert.ok(100*Math.exp(-m/100)<=.05);
 assert.equal(100-10+1,91);assert.ok(91/1024<.089);
 for(let n=2;n<=16;n++){
  const k=Math.ceil(2*Math.log2(n));assert.ok(n*2**(-k)<=1/n+1e-10);
  let runs=0;for(let bits=0;bits<2**n;bits++){let longest=0,current=0;for(let i=0;i<n;i++){current=(bits>>i&1)?current+1:0;longest=Math.max(longest,current);}if(longest>=k)runs++;}
  assert.ok(runs/2**n<=Math.max(0,n-k+1)*2**(-k)+1e-10);
  assert.ok(n*Math.exp(-Math.ceil(2*n*Math.log(n))/n)<=1/n+1e-10);
 }
 assert.ok(equations(section(3,'coupons')).includes('m = ⌈100(ln 100 + ln 20)⌉ = ⌈100 ln 2000⌉ = 761'));
});
test('first week covers the scheduled original questions within existing time allocations',()=>{
 assert.equal(lessons.length,4);const sources=new Set(Object.keys(curriculum.sources));
 for(const l of lessons){const scheduled=schedule.sessions.find(s=>s.id===l.sessionId);assert.equal(scheduled.week,1);assert.equal(new Set(l.sections.map(s=>s.id)).size,l.sections.length);assert.equal(l.sections.reduce((n,s)=>n+s.minutes,0),scheduled.minutes===90?80:135);
  for(const ref of l.sourceRefs)assert.ok(sources.has(ref.sourceId));
  const official=l.sections.flatMap(s=>s.official||[]);assert.deepEqual(official,[...scheduled.problemIds].filter(id=>/^m\d+-q\d+$/.test(id)));
  for(const s of l.sections){if(s.question){assert.ok(s.question.hints.length);assert.ok(s.question.solution.length);assert.ok(s.question.check.length);}for(const b of [...s.body,...s.question?.solution||[]])if(b.type==='equation')assert.doesNotMatch(b.text,/[א-ת]/,'equations isolate LTR notation from Hebrew prose');}
 }
});

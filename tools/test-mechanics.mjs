import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes('const MAT='));
const ctx={localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:id=>id==='sky'?{getContext:()=>null}:{innerHTML:''},addEventListener(){}},matchMedia:()=>({matches:true}),queueMicrotask(){},PW_TELEMETRY:{configured:()=>false,getDraft:()=>'',getQueue:()=>[],getDrafts:()=>({})}};
ctx.window=ctx;ctx.addEventListener=()=>{};ctx.scrollTo=()=>{};vm.createContext(ctx);
vm.runInContext(script+`\nglobalThis.review={CLASSES,K,v,availableU,compute,outcome,priorityWeights,bankValue,questionGroup,aggregate,threatCount,decideU,load(a={}){state=initial();state.phase='quiz';state.demo=false;state.answers={...a};state.history=Object.keys(a);},get state(){return state}}`,ctx);
const r=ctx.review;
const base={Q01:'D',Q02:'B',Q03:'A',Q04:'D',U06:'F',P04:'B',P02:'B'};
const weights=(a)=>{r.load(a);return r.priorityWeights()};
assert(weights({...base,P04:'B'}).role>weights({...base,P04:'D'}).role);
assert(weights({...base,P04:'D'}).role>weights({...base,P04:'C'}).role);
assert(weights({...base,P02:'B'}).damage>weights({...base,P02:'D'}).damage);
assert(weights({...base,P02:'D'}).damage>weights({...base,P02:'C'}).damage);
r.load({...base,Q03:'B',P04:'A'});const before=r.compute();r.state.answers.U16='A';r.state.history.push('U16');const after=r.compute();assert.equal(before.weights.role,after.weights.role,'new mechanics cannot increase their group weight');
r.load({...base,Q03:'B',P04:'A'});const neutral=r.compute().list.map(x=>[x.name,x.score]);r.state.answers.U16='D';r.state.history.push('U16');assert.equal(JSON.stringify(neutral),JSON.stringify(r.compute().list.map(x=>[x.name,x.score])),'neutral answer changes scores');
r.load({Q01:'C',Q02:'A',Q03:'B',Q04:'C',P01:'D',P04:'A',U06:'A'});assert.equal(r.outcome().status,'single');assert.equal(r.compute().leader.name,'Мистик');
r.load({...base,P04:'A',P02:'A'});let o=r.outcome();assert.equal(o.question.id,'P03');assert(o.question.options.some(x=>x[0]==='B'),'support compromise missing');r.state.answers.P03='B';r.state.history.push('P03');assert(r.compute().list.every(x=>r.v(x.cl,r.K.range)>=3),'distance relaxed by compromise');assert(r.compute().list.length>0);
r.load({...base,P04:'A',P02:'A',U06:'E'});o=r.outcome();assert.equal(o.question.id,'P03');assert(!o.question.options.some(x=>x[0]==='B'),'unworkable compromise shown');
r.load({...base,P04:'A',P02:'A',P03:'C'});assert.equal(r.outcome().status,'conflict');
r.load({Q01:'B',Q02:'C',Q03:'D',Q04:'D',U06:'D',U16:'D',U18:'D',U11:'D',U10:'D',U13:'D'});o=r.outcome();assert.equal(o.status,'tie');assert(Math.abs(o.e.leader.score-o.e.runner.score)<1e-9);assert.equal(ctx.runPayload(o).leader,null);assert.equal(ctx.runPayload(o).tied_candidates.length,2);assert(ctx.resultHTML(o).includes('Порядок отображения не означает преимущество'));
// Compare the full-budget bound with exhaustive subsets and answers for two and three steps.
for(const a of [base,{Q01:'B',Q02:'D',Q03:'B',Q04:'C',U06:'A',U18:'A',U10:'C'}]){
 r.load(a);const e=r.compute(),available=r.availableU();
 for(const budget of [2,3]){
 const threats=new Set();
 const inspect=(extra)=>{
  const terms=[...e.terms,...extra.map(([b])=>({id:b.id,group:r.questionGroup(b.id),weight:1}))];
  const ranked=e.list.map(item=>({name:item.name,score:r.aggregate([...item.values,...extra.map(([b,c])=>r.bankValue(item.cl,b,c))],terms,e.weights).score}));
  const leader=ranked.find(x=>x.name===e.leader.name).score;for(const x of ranked)if(x.name!==e.leader.name&&x.score>=leader-1e-9)threats.add(x.name);
 };
 const explore=(start,extra)=>{inspect(extra);if(extra.length===budget)return;for(let i=start;i<available.length;i++)for(const code of 'ABC')explore(i+1,[...extra,[available[i],code]]);};
 explore(0,[]);
 assert.equal(r.threatCount(e,budget),threats.size,`bound differs from exhaustive ${budget}-question search`);
 }
 assert.equal(r.threatCount(e,0),0,'no future questions at the limit');
}
// Q04-C must not reward gear dependency when damage ratings are equal.
r.load({Q01:'B',Q02:'C',Q03:'D',Q04:'C',U06:'D'});const eq=r.compute().list.filter(x=>r.v(x.cl,r.K.dmg)===5);const q4=r.compute().terms.findIndex(x=>x.id==='Q04');assert(new Set(eq.map(x=>x.values[q4])).size===1);
console.log('MECHANICS PASS: priorities, fixed group budgets, neutral choices, singleton, ties, feasible compromises, strict range, exact future bound, gear proxy removal');

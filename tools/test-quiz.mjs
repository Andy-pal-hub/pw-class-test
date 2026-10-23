import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname;
const html=fs.readFileSync(root+'index.html','utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes('const MAT='));
const values=new Map(), pending=[], requests=[];
let online=false,compatible=false;
const ctx={console,crypto:webcrypto,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},navigator:{get onLine(){return online}},document:{getElementById:id=>id==='sky'?{getContext:()=>null}:{innerHTML:'',value:'проверка отзыва'},addEventListener(){}},matchMedia:()=>({matches:true}),queueMicrotask:f=>pending.push(f),setTimeout,clearTimeout,AbortController,URL,Blob,Uint8Array,fetch:async(url,opts)=>{if(String(url).endsWith('/health'))return new Response(JSON.stringify({ok:true,configured:true,capabilities:compatible?['distance-hard-v1']:[]}));requests.push(JSON.parse(opts.body));return new Response(JSON.stringify({ok:true}),{status:200})}};
ctx.window=ctx;ctx.addEventListener=()=>{};ctx.scrollTo=()=>{};
vm.createContext(ctx);
for(const name of ['config.js','telemetry-client.js']) vm.runInContext(fs.readFileSync(root+name,'utf8'),ctx);
vm.runInContext(script,ctx);
const dev=ctx.PW_TEST_DEV;
let runs=0,conflicts=0;
for(const a of 'ABCD')for(const b of 'ABCD')for(const c of 'ABCD')for(const d of 'ABCD')for(const dist of 'ABCDEF'){
 dev.reset();const s=dev.get().state;s.demo=runs%2===0;
 let seen=false,steps=0;
 while(dev.get().view.kind==='question'){
  const q=dev.get().view.question;
  const choice=({Q01:a,Q02:b,Q03:c,Q04:d,U06:dist})[q.id] || q.options[(runs+steps)%q.options.length][0];
  if(q.id==='U06')seen=true;
  dev.set(q.id,choice);assert(++steps<=30,'run did not terminate');
 }
 const {view,state}=dev.get();assert.equal(view.kind,'result');assert(seen,'U06 missing');
 assert.equal(state.history.filter(x=>!x.startsWith('B')).length<=10,true,'question limit');
 for(const item of view.e.list){assert(Number.isFinite(item.score)&&item.score>=0&&item.score<=5);if(dist==='E')assert(item.cl.scores[8]<=2);if(dist==='F')assert(item.cl.scores[8]>=3);}
 if(view.status==='conflict'){assert.equal(view.e.list.length,0);conflicts++;}
 const payload=ctx.runPayload(view);assert.equal(payload.version,'0.6-distance-hard');assert.equal(payload.answers.find(x=>x.id==='U06').choice,dist);
 while(pending.length)pending.shift()();
 runs++;
}
assert.equal(ctx.PW_TELEMETRY.getQueue().length,0,'no consent must send nothing');
ctx.queueRun(dev.get().view,true);
assert.equal(ctx.PW_TELEMETRY.getQueue().length,1,'explicit submission queues run offline');
online=true;await ctx.PW_TELEMETRY.flush();assert.equal(ctx.PW_TELEMETRY.getQueue().length,1,'old collector must leave v0.6 events queued');assert.equal(requests.length,0);compatible=true;await ctx.PW_TELEMETRY.flush();assert.equal(ctx.PW_TELEMETRY.getQueue().length,0);assert.equal(requests.length,1);
dev.get().state.telemetryEnabled=true;dev.get().state.reportedHash=null;ctx.queueRun(dev.get().view);await new Promise(r=>setTimeout(r,0));await ctx.PW_TELEMETRY.flush();assert.equal(requests.length,2);
ctx.queueRun(dev.get().view);await new Promise(r=>setTimeout(r,0));await ctx.PW_TELEMETRY.flush();assert.equal(requests.length,2,'unchanged result must not duplicate');
const module=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(root+'worker/worker.js','utf8')+'\nexport {cleanEvent};').toString('base64'));
for(const event of requests){const cleaned=module.cleanEvent(event);assert.equal(cleaned.record.distance_requirement,'ranged');assert.equal(cleaned.record.answers.find(x=>x.id==='U06').choice,'F');}
await ctx.sendQuestionIssue('U06');await ctx.PW_TELEMETRY.flush();const last=requests.at(-1);assert.equal(last.type,'question_feedback');assert.equal(module.cleanEvent(last).record.answer_at_feedback,'F');
console.log(`PASS ${runs} complete paths (${conflicts} conflicts); hard filters, scores, required distance, question limits, consent, offline retry, deduplication, run and feedback validation`);

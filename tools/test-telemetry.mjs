import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
const data=new Map(),timers=new Map();let nextTimer=0,ready=false,posts=0;
const ctx={crypto:webcrypto,URL,Uint8Array,AbortController,navigator:{onLine:true},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id),fetch:async(url,opts)=>{if(opts.method==='POST'){posts++;return new Response(JSON.stringify({ok:true}))}return new Response(JSON.stringify({configured:true,capabilities:ready?['distance-hard-v1','decision-v07']:['distance-hard-v1']}))}};
ctx.window=ctx;ctx.addEventListener=()=>{};ctx.PW_CONFIG={endpoint:'https://collector.example/collect'};vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../telemetry-client.js',import.meta.url),'utf8'),ctx);
const payload={session_id:webcrypto.randomUUID(),version:'0.7-priorities',status:'single'};
await ctx.PW_TELEMETRY.send('run',payload);assert.equal(posts,0);assert.equal(ctx.PW_TELEMETRY.getQueue().length,1);assert.equal(timers.size,1);
let retry=[...timers.values()][0];assert.equal(retry.delay,2000);
// A deployed collector becomes compatible while the page remains open.
ready=true;timers.clear();retry.fn();await new Promise(setImmediate);
assert.equal(posts,1);assert.equal(ctx.PW_TELEMETRY.getQueue().length,0);assert.equal(timers.size,0);
console.log('TELEMETRY PASS: old collector keeps v0.7 queued; compatible collector receives pending event on timed retry without page reload');

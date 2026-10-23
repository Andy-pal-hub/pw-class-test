/* Public browser code. No secrets here. */
(function(){
'use strict';
const KEY='pw_pilot_telemetry_v1';
const QKEY='pw_pilot_drafts_v1';
const settings=window.PW_CONFIG||{};
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function newId(){if(crypto?.randomUUID)return crypto.randomUUID();const arr=new Uint8Array(16);crypto.getRandomValues(arr);return [...arr].map(v=>v.toString(16).padStart(2,'0')).join('')}
function endpoint(){return typeof settings.endpoint==='string'&&/^https:\/\/[\w.-]+\/[\w/?=-]+$/.test(settings.endpoint)?settings.endpoint:''}
function getQueue(){return read(KEY,[])}
function getDrafts(){return read(QKEY,{})}
let sending=false;
async function flush(){if(sending||!endpoint()||!navigator.onLine)return false;sending=true;let ok=true;
try{let count=0;while(count++<70){const queue=getQueue();if(!queue.length)break;const event=queue[0];try{
const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),12000);
let res;try{res=await fetch(endpoint(),{method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),signal:ctl.signal})}finally{clearTimeout(timer)}
if(!res.ok)throw Error('HTTP '+res.status);
const body=await res.json();if(body?.ok!==true)throw Error('not saved');
write(KEY,getQueue().filter(e=>e.event_id!==event.event_id));
}catch(e){ok=false;break;}}}finally{sending=false}return ok;}
async function send(type,payload){
const event={event_id:newId(),type,client_timestamp:new Date().toISOString(),payload};
const prev=getQueue();const q=prev.filter(x=> !(type==='run'&&x.type==='run'&&x.payload?.session_id===payload.session_id)
 &&!(type==='question_feedback'&&x.type==='question_feedback'&&x.payload?.session_id===payload.session_id&&x.payload?.question_id===payload.question_id));
q.push(event);write(KEY,q.slice(-70));
if(!endpoint())return {sent:false,queued:true};
const good=await flush();return {sent:good&&!getQueue().some(x=>x.event_id===event.event_id),queued:true};
}
window.PW_TELEMETRY={
newId,send,flush,getQueue,getDrafts,
withdrawRunConsent(){write(KEY,getQueue().filter(e=>e.type!=='run'))},
getDraft(id){return String(getDrafts()[id]||'')},
saveDraft(id,text){const drafts=getDrafts();drafts[id]=String(text||'').slice(0,1200);write(QKEY,drafts)},
configured(){return !!endpoint()},
exportQueue(){const data={exported_at:new Date().toISOString(),events:getQueue(),drafts:getDrafts()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='pw-feedback-queue.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
};
window.addEventListener('online',()=>flush().catch(()=>{}));
})();

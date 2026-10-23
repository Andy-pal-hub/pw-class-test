/* Cloudflare Worker, deployed separately from GitHub Pages.
 * The GitHub token exists ONLY as GH_TOKEN Cloudflare Secret.
 * For small private pilots, creates/upserts records in public JSON files.
 */
const GH='https://api.github.com';
const reply=(status,data,origin)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS, GET','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'}});
const shorten=(x,n=120)=>String(x??'').slice(0,n);
const isId=x=>typeof x==='string'&&/^[\da-fA-F-]{24,64}$/.test(x);
const now=()=>new Date().toISOString();
function gitAuth(env){return {'Authorization':'Bearer '+env.GH_TOKEN,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'pw-class-pilot-collector','Content-Type':'application/json'};}
function toBase64(text){const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=16384){binary+=String.fromCharCode(...bytes.subarray(i,i+16384));}return btoa(binary);}
function fromBase64(text){const b=atob(text.replace(/\s/g,'')),bytes=Uint8Array.from(b,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
const getURL=(env,path)=>`${GH}/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents/${path}`;
const pause=(ms)=>new Promise(ok=>setTimeout(ok,ms));
function cleanEvent(event){
if(!event||typeof event!=='object'||!isId(event.event_id))throw Error('Invalid event id');
const p=event.payload;if(!p||typeof p!=='object'||!isId(p.session_id))throw Error('Invalid session id');
if(event.type==='question_feedback'){
if(!/^(Q0[1-4]|P0[1-4]|U(0[1-9]|1[0-8])|B0[1-4])$/.test(p.question_id||''))throw Error('Invalid question id');
const comment=shorten(p.comment,1200).trim();if(!comment)throw Error('Empty feedback');
return{kind:'question_feedback',record:{id:`${p.session_id}:${p.question_id}`,session_id:p.session_id,submitted_at:now(),question_id:p.question_id,question_type:shorten(p.question_type,20),question_text:shorten(p.question_text,200),question_index:Math.max(0,Math.min(30,Number(p.question_index)||0)),answer_at_feedback:/^[ABCD]$/.test(p.answer_at_feedback||'')?p.answer_at_feedback:null,comment,version:shorten(p.version,30),candidates:Array.isArray(p.candidates)?p.candidates.slice(0,3).map(x=>shorten(x,45)):[]}};
}
if(event.type==='run'){
const statuses=['sufficient','limit','ambiguous','conflict'];
if(!Array.isArray(p.answers)||p.answers.length>30||!statuses.includes(p.status))throw Error('Invalid run');
const answers=p.answers.filter(x=>x&&/^(Q0[1-4]|P0[1-4]|U(0[1-9]|1[0-8])|B0[1-4])$/.test(x.id)&&/^[ABCD]$/.test(x.choice)).map(x=>({id:x.id,choice:x.choice}));
const fb=p.feedback||{};
return{kind:'run',record:{id:p.session_id,session_id:p.session_id,submitted_at:now(),version:shorten(p.version,30),answers,class_question_count:Math.max(0,Math.min(15,Number(p.class_question_count)||0)),total_question_count:answers.length,status:p.status,leader:shorten(p.leader,50)||null,alternatives:Array.isArray(p.alternatives)?p.alternatives.slice(0,3).map(x=>({name:shorten(x.name,50),score_percent:Math.max(0,Math.min(100,Number(x.score_percent)||0))})):[],feedback:{rating:Math.max(0,Math.min(5,Math.round(Number(fb.rating)||0))),expected:['yes','maybe','no'].includes(fb.expected)?fb.expected:null,text:shorten(fb.text,1200)},demo:!!p.demo}};
}
throw Error('Invalid event type');
}
async function save(env,kind,record){const file=kind==='run'?'data/runs.json':'data/feedback.json',url=getURL(env,file);
for(let attempt=0;attempt<5;attempt++){
const read=await fetch(`${url}?ref=${encodeURIComponent(env.GITHUB_BRANCH||'main')}`,{headers:gitAuth(env)});
let sha,doc;
if(read.status===404){doc={schema_version:1,entries:[]};}
else if(read.ok){const fetched=await read.json();sha=fetched.sha;doc=JSON.parse(fromBase64(fetched.content));}
else throw Error('Repository read failed: '+read.status);
if(!doc||!Array.isArray(doc.entries))throw Error('Unexpected JSON data format');
const existing=doc.entries.findIndex(x=>x.id===record.id);
if(existing<0)doc.entries.push(record);else doc.entries[existing]=record;
const payload={message:`record ${kind}: ${record.id.slice(0,12)}`,branch:env.GITHUB_BRANCH||'main',content:toBase64(JSON.stringify(doc,null,2)+'\n')};if(sha)payload.sha=sha;
const write=await fetch(url,{method:'PUT',headers:gitAuth(env),body:JSON.stringify(payload)});
if(write.ok)return true;
if(write.status===409||write.status===422){await pause(80+attempt*150);continue;}
throw Error('Repository update failed: '+write.status);
}
throw Error('Write conflict: retries exhausted');
}
export default {async fetch(request,env){
const origin=request.headers.get('Origin')||'';
const allow=origin&&origin===env.ALLOWED_ORIGIN;
if(request.method==='GET'&&new URL(request.url).pathname==='/health')return reply(200,{ok:true,revision:'config-diagnostic-1',configured:!!(env.GH_TOKEN&&env.GITHUB_OWNER&&env.GITHUB_REPO),missing:['GH_TOKEN','GITHUB_OWNER','GITHUB_REPO','ALLOWED_ORIGIN'].filter(key=>!env[key])},allow?origin:'*');
if(request.method==='OPTIONS')return allow?new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}}):reply(403,{ok:false,error:'Origin not allowed'},'*');
if(request.method!=='POST'||new URL(request.url).pathname!=='/collect')return reply(404,{ok:false},allow?origin:'*');
if(!allow)return reply(403,{ok:false,error:'Origin not allowed'},'*');
if(!env.GH_TOKEN||!env.GITHUB_OWNER||!env.GITHUB_REPO)return reply(503,{ok:false,error:'Collector not configured'},origin);
const len=Number(request.headers.get('Content-Length')||0);if(len>8000)return reply(413,{ok:false,error:'Payload too large'},origin);
try{const raw=await request.text();if(raw.length>8000)return reply(413,{ok:false,error:'Payload too large'},origin);
const event=JSON.parse(raw),{kind,record}=cleanEvent(event);await save(env,kind,record);return reply(200,{ok:true,saved:kind},origin);
}catch(e){const msg=String(e?.message||'');const invalid=msg.startsWith('Invalid')||msg.startsWith('Empty');if(invalid)return reply(400,{ok:false,error:msg},origin);return reply(503,{ok:false,error:'Temporary write failure'},origin);}
}};

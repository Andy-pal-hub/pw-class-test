import worker from './worker.js';
let repo={'data/runs.json':{schema_version:1,entries:[]},'data/feedback.json':{schema_version:1,entries:[]}};
let revisions={'data/runs.json':'rev1','data/feedback.json':'rev2'};
const env={GH_TOKEN:'server-secret',GITHUB_OWNER:'owner',GITHUB_REPO:'repo',GITHUB_BRANCH:'main',ALLOWED_ORIGIN:'https://owner.github.io'};
const original=globalThis.fetch;
globalThis.fetch=async (url,opts)=>{
  const m=String(url).match(/contents\/(data\/\w+\.json)/);if(!m)throw Error('Unexpected URL '+url);
  const file=m[1];
  if(opts?.method==='PUT'){
    const request=JSON.parse(opts.body);
    if(request.sha!==revisions[file])return new Response(JSON.stringify({error:'conflict'}),{status:409});
    const text=Buffer.from(request.content,'base64').toString('utf8');repo[file]=JSON.parse(text);revisions[file]='rev'+(Number(revisions[file].slice(3))+1);
    return new Response(JSON.stringify({ok:true}),{status:200});
  }
  return new Response(JSON.stringify({sha:revisions[file],content:Buffer.from(JSON.stringify(repo[file]),'utf8').toString('base64')}),{status:200});
};
const headers={'Origin':'https://owner.github.io','Content-Type':'application/json'};
const uuid='e9692be5-21dc-4350-b16a-4a49eccf6880';
async function send(type,payload){const event={event_id:crypto.randomUUID(),type,payload};return worker.fetch(new Request('https://worker.example/collect',{method:'POST',headers,body:JSON.stringify(event)}),env)}
let res=await send('question_feedback',{session_id:uuid,question_id:'U16',question_text:'Нравятся ли тебе формы?',question_index:7,comment:'Неоднозначно: «трансформация» слишком общий термин',version:'0.4-pilot'});
console.log('FEEDBACK 1',res.status,repo['data/feedback.json'].entries.length);
if(res.status!==200)throw Error('feedback failed');
res=await send('question_feedback',{session_id:uuid,question_id:'U16',comment:'Уточнить, считаются ли временные боевые формы?',question_index:7});
if(res.status!==200||repo['data/feedback.json'].entries.length!==1)throw Error('feedback upsert failed');
console.log('FEEDBACK UPSERT',repo['data/feedback.json'].entries[0].comment);
res=await send('run',{session_id:uuid,answers:[{id:'Q01',choice:'A'},{id:'U16',choice:'B'}],status:'limit',leader:'Мистик',alternatives:[{name:'Мистик',score_percent:88}],feedback:{rating:4,expected:'maybe',text:'Хороший тест'},class_question_count:10});
console.log('RUN',res.status,repo['data/runs.json'].entries[0].leader);
if(res.status!==200||repo['data/runs.json'].entries.length!==1)throw Error('run failed');
const forbidden=await worker.fetch(new Request('https://worker.example/collect',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}),env);
if(forbidden.status!==403)throw Error('origin validation failed');
console.log('FORBIDDEN',forbidden.status);
const invalid=await send('question_feedback',{session_id:uuid,question_id:'U999',comment:'bad'});
if(invalid.status!==400)throw Error('input validation failed');
console.log('INVALID',invalid.status);
// v0.6: strict range options E/F must be preserved by the server, not silently dropped.
res=await send('run',{session_id:uuid,answers:[{id:'Q01',choice:'A'},{id:'U06',choice:'E'},{id:'Q03',choice:'A'}],distance_requirement:'melee',distance_threshold:2,status:'sufficient',leader:'Странник',class_question_count:6});
const r=repo['data/runs.json'].entries[0];
if(res.status!==200||r.distance_requirement!=='melee'||r.answers.find(x=>x.id==='U06')?.choice!=='E')throw Error('U06 E not persisted');
console.log('RANGE RUN',r.distance_requirement,r.answers);
res=await send('question_feedback',{session_id:uuid,question_id:'U06',question_index:5,answer_at_feedback:'F',comment:'Почему дальность от 3 — это ренж?'});
if(res.status!==200||repo['data/feedback.json'].entries.find(x=>x.question_id==='U06')?.answer_at_feedback!=='F')throw Error('U06 feedback F not persisted');
console.log('RANGE FEEDBACK',res.status);
const health=await worker.fetch(new Request('https://worker.example/health',{headers}),env);
const healthInfo=await health.json();
if(!healthInfo.configured||!healthInfo.capabilities.includes('distance-hard-v1'))throw Error('distance capability missing');
console.log('WORKER PASS');
globalThis.fetch=original;

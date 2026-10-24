import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker from './worker.js';
const sqlite=new DatabaseSync(':memory:');let fail=false,release;
const DB={prepare(sql){return {sql,args:[],bind(...args){return {...this,args}}}},async batch(statements){if(release)await release;if(fail)throw Error('DB offline');sqlite.exec('BEGIN');try{const results=statements.map(s=>{sqlite.prepare(s.sql).run(...s.args);return {success:true}});sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const env={DB,ALLOWED_ORIGIN:'https://test.github.io'};
globalThis.fetch=async()=>{throw Error('D1 must never call GitHub')};
const uuid='db3b3ae8-08b3-4c0e-933c-d10a8b35c61a';
async function send(type,payload){return worker.fetch(new Request('https://collector.example/collect',{method:'POST',headers:{Origin:env.ALLOWED_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({event_id:crypto.randomUUID(),type,payload:{session_id:uuid,version:'0.7-priorities',...payload}})}),env)}
for(const comment of ['first','updated']){const res=await send('question_feedback',{question_id:'U06',answer_at_feedback:'F',comment});assert.equal(res.status,200)}
let rows=sqlite.prepare('SELECT * FROM events').all();assert.equal(rows.length,1);assert.equal(JSON.parse(rows[0].record_json).comment,'updated');
let res=await send('run',{status:'tie',answers:[{id:'U06',choice:'F'}],leader:null,tied_candidates:['Маг','Шаман']});assert.equal(res.status,200);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM events').get().n,2);
let allow;release=new Promise(resolve=>{allow=resolve});let finished=false;const pending=send('question_feedback',{question_id:'B02',comment:'durable'}).then(r=>{finished=true;return r});await new Promise(setImmediate);assert.equal(finished,false,'acknowledged before commit');allow();await pending;release=null;
fail=true;res=await send('question_feedback',{question_id:'B03',comment:'must retry'});assert.equal(res.status,503);assert.equal(sqlite.prepare("SELECT count(*) AS n FROM events WHERE id LIKE '%B03'").get().n,0);
const health=await (await worker.fetch(new Request('https://collector.example/health'),env)).json();assert.equal(health.storage,'d1');assert.equal(health.configured,true);
console.log('D1 PASS: real SQLite upsert, Unicode, ties, no GitHub calls, acknowledgement only after commit, failures retained for retry');
sqlite.close();

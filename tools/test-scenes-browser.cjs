const {chromium}=require(process.env.PW_PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
const b=await chromium.launch({executablePath:process.env.PW_CHROME||undefined,headless:true,args:['--no-sandbox']});
const p=await b.newPage(); const errors=[],requests=[];
p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
await p.route('**/*.workers.dev/**',r=>r.fulfill({json:{ok:true,configured:true,capabilities:['distance-hard-v1','decision-v07']}}));
await p.goto(process.env.PW_URL||'http://127.0.0.1:8765/');
assert(!requests.some(s=>s.includes('scene-engine.js')),'eager engine');
await p.evaluate(()=>{PW_TEST_DEV.reset(); PW_TEST_DEV.get().state.demo=false; for(const [id,v]of Object.entries({Q01:'C',Q02:'A',Q03:'B',Q04:'C',P01:'D',P04:'A',U06:'A'}))PW_TEST_DEV.set(id,v)});
await p.waitForFunction(()=>PW_RESULT_VISUALS.current?.ready);
assert.equal(await p.evaluate(()=>PW_RESULT_VISUALS.current.classId),'mystic');
assert.equal(await p.evaluate(()=>PW_RESULT_VISUALS.current.muted),true);
assert(!requests.some(s=>s.includes('multibox/')),'eager launch images');
const signature=await p.evaluate(()=>JSON.stringify({...runPayload(PW_TEST_DEV.get().view),completed_at:null}));
for(const width of [1440,768,430,375,320]){
 await p.setViewportSize({width,height:900});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
 if(process.env.PW_SCREENSHOT_DIR)await p.screenshot({path:require('node:path').join(process.env.PW_SCREENSHOT_DIR,`pw-ui-${width}.png`),fullPage:true});
}
for(const cls of ['Друид','Мистик','Воин'])for(const tag of ['gambler','multibox','fashion','farmer','afk','chatter','parkour','dizzy']){
 await p.evaluate(({cls,tag})=>{PW_RESULT_VISUALS.current.setResult(cls,[tag]);},{cls,tag});
 await p.waitForFunction(()=>PW_RESULT_VISUALS.current?.ready);
 await p.evaluate(()=>{const s=PW_RESULT_VISUALS.current;s.t=5;s.render()});
}
await p.locator('[data-scene-control="sound"]').click();
assert(await p.evaluate(()=>PW_RESULT_VISUALS.current.sounds.running));
await p.locator('[data-scene-volume]').fill('45');
assert.equal(await p.evaluate(()=>PW_RESULT_VISUALS.current.sounds.volume),.45);
await p.locator('[data-scene-control="pause"]').click();
assert.equal(await p.evaluate(()=>PW_RESULT_VISUALS.current.raf),0);
await p.locator('[data-scene-control="portrait"]').click();
assert(await p.locator('.is-portrait').count());
await p.locator('[data-scene-control="preprocess"]').click();
assert.equal(await p.evaluate(()=>PW_RESULT_VISUALS.current.preprocessing),false);
assert.equal(await p.evaluate(()=>JSON.stringify({...runPayload(PW_TEST_DEV.get().view),completed_at:null})),signature,'controls changed quiz');
await p.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
await p.waitForFunction(()=>PW_RESULT_VISUALS.current?.ready);
assert.equal(await p.evaluate(()=>PW_RESULT_VISUALS.current.muted),true);
assert.equal(await p.evaluate(()=>JSON.stringify({...runPayload(PW_TEST_DEV.get().view),completed_at:null})),signature);
await p.locator('[data-action="back"]').last().click();
assert.equal(await p.evaluate(()=>PW_RESULT_VISUALS.current),null);
assert.equal(await p.locator('.pw-scene').count(),0);
// Fallback results must never create a supported scene host.
await p.evaluate(()=>{const v={...PW_TEST_DEV.get().view,e:PW_TEST_DEV.compute()};PW_RESULT_VISUALS.clear();app.innerHTML=resultHTML({...v,status:'tie'});});
assert.equal(await p.locator('[data-result-scene]').count(),0);
await p.evaluate(()=>{const v={...PW_TEST_DEV.get().view,e:PW_TEST_DEV.compute()};app.innerHTML=resultHTML({...v,status:'conflict',e:{...v.e,leader:null,list:[]}});});
assert.equal(await p.locator('[data-result-scene]').count(),0);
await p.evaluate(()=>{const v={...PW_TEST_DEV.get().view,e:PW_TEST_DEV.compute()};app.innerHTML=resultHTML({...v,status:'single',e:{...v.e,leader:{...v.e.leader,name:'Маг'}}});});
assert.equal(await p.locator('[data-result-scene]').count(),0);
await p.emulateMedia({reducedMotion:'reduce'});
await p.evaluate(()=>{const v={...PW_TEST_DEV.get().view,e:PW_TEST_DEV.compute()};app.innerHTML=resultHTML({...v,status:'single',e:{...v.e,leader:{...v.e.leader,name:'Мистик'}}});PW_RESULT_VISUALS.mount('Мистик',['твиновод']);});
await p.waitForFunction(()=>PW_RESULT_VISUALS.current?.ready);
assert.equal(await p.evaluate(()=>PW_RESULT_VISUALS.current.raf),0);
await p.route('**/assets/classes/*.jpg',r=>r.abort());
await p.evaluate(()=>{PW_RESULT_VISUALS.clear();const v={...PW_TEST_DEV.get().view,e:PW_TEST_DEV.compute()};app.innerHTML=resultHTML({...v,status:'single',e:{...v.e,leader:{...v.e.leader,name:'Воин'}}});PW_RESULT_VISUALS.mount('Воин',[])});
await p.waitForSelector('.result-scene-fallback');
assert.equal(await p.locator('.result-scene-controls').isVisible(),false);
assert.deepEqual(errors,[]);
console.log('UI PASS: natural Mystic result, 24 class/effect combinations, 320–1440px, lazy loading, default mute, sound, volume, pause, portrait, preprocessing, state isolation, cleanup, bfcache restore, fallback, reduced motion, image failure.');
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

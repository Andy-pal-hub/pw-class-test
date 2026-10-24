/* Result presentation only. Does not read/write quiz answers or telemetry. */
(function(global){
'use strict';
const root=new URL('./',document.currentScript.src).href;
let pending=null,scene=null,generation=0;
function loadScript(path){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL(path,root).href;script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('Scene asset unavailable'));};document.head.append(script);});}
function assets(){if(global.PWScene&&global.PWSoundscape&&global.PW_SCENES)return Promise.resolve();if(!pending)pending=(async()=>{if(!global.PW_SCENES)await loadScript('data/scenes.js');if(!global.PWSoundscape)await loadScript('soundscape.js');if(!global.PWScene)await loadScript('scene-engine.js');})().catch(e=>{pending=null;throw e;});return pending;}
function clear(){generation++;if(scene){scene.destroy();scene=null;}}
async function mount(className,tags){
 const ticket=++generation,host=document.querySelector('[data-result-scene]');if(!host||!['Друид','Мистик','Воин'].includes(className))return;
 const fallback=host.innerHTML,panel=host.closest('.result-scene-panel'),controls=panel.querySelector('.result-scene-controls');
 function restore(){if(ticket!==generation)return;if(scene){scene.destroy();scene=null;}host.innerHTML=fallback;controls.hidden=true;}
 try{await assets();if(ticket!==generation||!host.isConnected)return;host.replaceChildren();scene=new global.PWScene(host,{classId:className,archetypes:tags,assetRoot:root,onUpdate:s=>{if(s.error)restore();}});controls.hidden=false;}catch{restore();}
}
document.addEventListener('click',event=>{const b=event.target.closest('[data-scene-control]');if(!b||!scene)return;
 const panel=b.closest('.result-scene-panel');switch(b.dataset.sceneControl){
  case 'sound':scene.setMuted(!scene.muted);b.textContent=scene.muted?'Звук: выкл.':'Звук: вкл.';b.setAttribute('aria-pressed',String(!scene.muted));break;
  case 'pause':scene.setPaused(!scene.paused);b.textContent=scene.paused?'Продолжить':'Пауза';b.setAttribute('aria-pressed',String(scene.paused));break;
  case 'preprocess':scene.setPreprocessing(!scene.preprocessing);b.textContent=scene.preprocessing?'Обработка: вкл.':'Обработка: выкл.';b.setAttribute('aria-pressed',String(scene.preprocessing));break;
  case 'portrait':{const v=panel.classList.toggle('is-portrait');b.textContent=v?'Весь кадр':'Портрет';b.setAttribute('aria-pressed',String(v));break;}
 }
});
document.addEventListener('input',event=>{if(event.target.matches('[data-scene-volume]')&&scene)scene.setVolume(Number(event.target.value)/100);});
global.addEventListener('pagehide',clear);
global.PW_RESULT_VISUALS={clear,mount,get current(){return scene;}};
})(window);

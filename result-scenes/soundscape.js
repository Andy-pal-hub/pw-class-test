/* Original synthesized soundscapes: seamless beds + recurring small events. */
(function(global){
'use strict';
const presets={
 gambler:{root:164.81,air:.10,bed:1.0,period:1.05,event:'coin'},
 multibox:{root:110,air:.20,bed:.65,period:0,event:'window'},
 fashion:{root:220,air:.08,bed:1.0,period:2.6,event:'chime'},
 farmer:{root:146.83,air:.16,bed:.85,period:.82,event:'pickup'},
 afk:{root:110,air:.22,bed:.18,period:0,event:null},
 chatter:{root:130.81,air:.16,bed:.65,period:2.0,event:'pop'},
 parkour:{root:98,air:.62,bed:.80,period:1.9,event:'swoosh'},
 dizzy:{root:174.61,air:.18,bed:.28,period:4.2,event:'softChime'}
};
class PWSoundscape{
 constructor(){this.ctx=null;this.enabled=false;this.active=false;this.running=false;this.tags=[];this.volume=.30;this.nodes=new Set();this.beds=[];this.timer=null;this.suspendTimer=null;this.buffers=new Map();this.next={};this.eventsPlayed=0;this.phase=0;}
 ensure(){if(this.ctx)return;const C=global.AudioContext||global.webkitAudioContext;if(!C)return;this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=0;const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-20;limiter.knee.value=12;limiter.ratio.value=4;limiter.attack.value=.008;limiter.release.value=.2;this.master.connect(limiter);limiter.connect(this.ctx.destination);}
 setEnabled(v){this.enabled=Boolean(v);if(this.enabled)this.ensure();this.sync();}
 setVolume(v){this.volume=Math.max(0,Math.min(1,Number(v)||0));if(this.ctx)this.master.gain.setTargetAtTime(this.running?this.volume:0,this.ctx.currentTime,.06);}
 setProfile(tags){const next=tags.filter(k=>presets[k]);if(next.join('|')===this.tags.join('|'))return;const was=this.running;this.stop();this.tags=next;this.next={};if(was||this.active)this.sync();}
 setActive(v){this.active=Boolean(v);this.sync();}
 sync(){const wanted=this.enabled&&this.active&&this.tags.length>0;if(!wanted){this.stop();return;}if(this.running||!this.ctx)return;clearTimeout(this.suspendTimer);this.ctx.resume().catch(()=>{});this.running=true;this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.08);this.phase=this.ctx.currentTime;
  for(const tag of this.tags){const p=presets[tag],source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),pan=this.ctx.createStereoPanner();source.buffer=this.bed(tag);source.loop=true;gain.gain.setValueAtTime(0,this.ctx.currentTime);gain.gain.linearRampToValueAtTime(p.bed/Math.sqrt(this.tags.length),this.ctx.currentTime+.18);pan.pan.value=(this.beds.length%2?.16:-.16);source.connect(gain);gain.connect(pan);pan.connect(this.master);source.start();this.beds.push({source,gain,pan});this.next[tag]=this.ctx.currentTime+.35;}
  this.pump();this.timer=setInterval(()=>this.pump(),100);
 }
 stop(){clearInterval(this.timer);this.timer=null;if(!this.ctx)return;this.running=false;const now=this.ctx.currentTime;this.master.gain.cancelScheduledValues(now);this.master.gain.setTargetAtTime(0,now,.012);for(const b of this.beds){try{b.source.stop(now+.045);}catch{}b.source.onended=()=>{b.source.disconnect();b.gain.disconnect();b.pan.disconnect();};}this.beds=[];for(const node of this.nodes){try{node.stop(now+.045);}catch{}}this.nodes.clear();clearTimeout(this.suspendTimer);this.suspendTimer=setTimeout(()=>{if(!this.running&&this.ctx)this.ctx.suspend().catch(()=>{});},65);}
 bed(tag){if(this.buffers.has(tag))return this.buffers.get(tag);const p=presets[tag],seconds=12,sr=22050,n=sr*seconds,b=this.ctx.createBuffer(2,n,sr),root=Math.round(p.root*seconds)/seconds;
  for(let channel=0;channel<2;channel++){const out=b.getChannelData(channel);for(let i=0;i<n;i++){const t=i/sr;let v=0;for(let k=0;k<3;k++){const f=Math.round(root*[.5,1,1.5][k]*seconds)/seconds;v+=Math.sin(2*Math.PI*f*t+channel*.43+k)*(.032/(k+1))*(.73+.27*Math.cos(2*Math.PI*t/seconds+k));}let air=0;for(let k=0;k<15;k++){const f=Math.round((173+k*127.73)*seconds)/seconds;air+=Math.sin(2*Math.PI*f*t+k*2.399+channel*.71)*.003;}out[i]=(v+air*p.air*2.8)*(.87+.13*Math.cos(2*Math.PI*t/seconds));}}
  this.buffers.set(tag,b);return b;}
 pump(){if(!this.running)return;const now=this.ctx.currentTime;for(const tag of this.tags){const p=presets[tag];if(p.period&&this.next[tag]<now+.13){this.cue(p.event,Math.max(now,this.next[tag]),tag);this.next[tag]=Math.max(now,this.next[tag])+p.period*(.92+Math.random()*.16);}}for(let i=0;i<this.beds.length;i++)this.beds[i].pan.pan.setTargetAtTime(Math.sin((now-this.phase)*.22+i*2)*.24,now,.25);}
 track(node){this.nodes.add(node);node.onended=()=>{this.nodes.delete(node);node.disconnect();};return node;}
 tone(freq,at,duration=.4,level=.05,ratio=1){const c=this.ctx,o=this.track(c.createOscillator()),g=c.createGain(),pan=c.createStereoPanner();o.type='sine';o.frequency.setValueAtTime(freq,at);if(ratio!==1)o.frequency.exponentialRampToValueAtTime(freq*ratio,at+duration);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(level,at+.007);g.gain.exponentialRampToValueAtTime(.0001,at+duration);pan.pan.value=(Math.random()-.5)*.65;o.connect(g);g.connect(pan);pan.connect(this.master);o.onended=()=>{this.nodes.delete(o);o.disconnect();g.disconnect();pan.disconnect();};o.start(at);o.stop(at+duration+.01);}
 noise(at,duration,level=.04,from=1000,to=2200){const c=this.ctx,n=Math.floor(c.sampleRate*duration),buffer=c.createBuffer(1,n,c.sampleRate),d=buffer.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;const source=this.track(c.createBufferSource()),gain=c.createGain(),filter=c.createBiquadFilter();source.buffer=buffer;filter.type='bandpass';filter.Q.value=.7;filter.frequency.setValueAtTime(from,at);filter.frequency.exponentialRampToValueAtTime(to,at+duration*.65);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(level,at+duration*.15);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);source.connect(filter);filter.connect(gain);gain.connect(this.master);source.onended=()=>{this.nodes.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};source.start(at);source.stop(at+duration+.01);}
 cue(type,at,tag){if(!this.running||!this.ctx)return;at=at??this.ctx.currentTime;this.eventsPlayed++;const normal=1/Math.sqrt(Math.max(1,this.tags.length));
  if(type==='coin'){const f=[1174.66,1396.91,1567.98][Math.floor(Math.random()*3)];this.tone(f,at,.36,.042*normal);this.tone(f*2.76,at,.17,.009*normal);}
  else if(type==='chime'||type==='softChime'){const s=type==='softChime'?.35:1;[1046.5,1318.5,1568].forEach((f,i)=>this.tone(f,at+i*.085,.9,.025*s*normal));}
  else if(type==='pickup'){this.tone(659.25,at,.13,.04*normal,1.5);this.tone(1318.5,at+.07,.35,.025*normal);if(Math.random()>.65)this.tone(2093,at+.14,.55,.012*normal);}
  else if(type==='pop'){this.tone(420,at,.075,.065*normal,1.55);this.noise(at,.04,.014*normal,1100,700);}
  else if(type==='swoosh'){this.noise(at,.44,.10*normal,500,2700);this.tone(150,at+.28,.12,.022*normal,.7);}
  else if(type==='window'){this.noise(at,.032,.035*normal,1800,600);this.noise(at+.08,.025,.018*normal,900,1900);this.tone(622,at+.13,.16,.027*normal,1.25);}
 }
 destroy(){this.stop();clearTimeout(this.suspendTimer);if(this.ctx)this.ctx.close().catch(()=>{});this.ctx=null;this.buffers.clear();}
}
global.PWSoundscape=PWSoundscape;
})(window);

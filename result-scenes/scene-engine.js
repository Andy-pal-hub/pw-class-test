/* Full-scene compositor. Original screenshots stay intact; no character cutouts. */
(function (global) {
'use strict';
const TAU=Math.PI*2, clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)), frac=x=>x-Math.floor(x);
const rnd=(i,s=0)=>frac(Math.sin(i*127.1+s*311.7)*43758.5453);
const ease=x=>x*x*(3-2*x);
class PWScene {
 constructor(host,options={}){
  this.host=host;this.config=options.config||global.PW_SCENES;this.root=options.assetRoot||'';this.sounds=new global.PWSoundscape();this.preprocessing=true;this.lastLaunchStep=-1;
  this.shots={};this.t=0;this.paused=false;this.effectsEnabled=true;this.intensity=1;this.destroyed=false;this.visible=true;this.muted=true;this.raf=0;this.frameCount=0;this.generation=0;this.onUpdate=options.onUpdate||(()=>{});
  this.motion=matchMedia('(prefers-reduced-motion: reduce)');
  this.el=document.createElement('div');this.el.className='pw-scene';this.el.setAttribute('role','img');
  this.image=document.createElement('img');this.image.className='pw-scene__image';this.image.alt='';this.image.draggable=false;
  this.processed=document.createElement('canvas');this.processed.className='pw-scene__processed';
  this.toneDefs=this.createToneFilter();
  this.canvas=document.createElement('canvas');this.canvas.className='pw-scene__effects';this.canvas.setAttribute('aria-hidden','true');this.ctx=this.canvas.getContext('2d');
  this.veil=document.createElement('div');this.veil.className='pw-scene__reveal';this.veil.setAttribute('aria-hidden','true');
  this.el.append(this.image,this.processed,this.canvas,this.veil,this.toneDefs);host.append(this.el);
  this.launchImages=[];
  this.onVisibility=()=>this.schedule();this.onMotion=()=>{this.render();this.schedule();};
  document.addEventListener('visibilitychange',this.onVisibility);this.motion.addEventListener('change',this.onMotion);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.el);
  this.intersectionObserver=new IntersectionObserver(es=>{this.visible=es[0].isIntersecting;this.schedule();});this.intersectionObserver.observe(this.el);
  this.setResult(options.classId||'druid',options.archetypes||['gambler']);
 }
 resolveClass(v){return this.config.classes[v]?v:Object.keys(this.config.classes).find(k=>this.config.classes[k].name===v);}
 resolveArchetype(v){return this.config.archetypes[v]?v:Object.keys(this.config.archetypes).find(k=>this.config.archetypes[k].aliases.includes(v));}
 loadLaunchImages(){if(this.launchImages.length)return;this.launchImages=(this.config.launchSequence||[]).map(step=>{const img=new Image();img.onload=()=>{if(!this.destroyed)this.render();};img.src=this.root+step.src;return img;});}
 setResult(value,tags=[]){
  if(this.destroyed)return;
  const id=this.resolveClass(value);if(!id)throw Error('Unknown class: '+value);
  this.classId=id;const base=this.config.classes[id];this.sourceIndex=this.shots[id]??base.defaultShot??0;this.c=Object.assign({},base,base.shots?.[this.sourceIndex]||{});this.tags=[...new Set(tags.map(x=>this.resolveArchetype(x)).filter(Boolean))].slice(0,this.config.rendering.maxArchetypes);
  if(this.tags.includes('multibox'))this.loadLaunchImages();
  const token=++this.generation;this.ready=false;this.stop();this.t=0;this.el.classList.add('is-loading');this.el.classList.remove('is-entering');
  this.el.style.setProperty('--scene-color',this.c.color);this.image.style.objectPosition=`${this.c.focal[0]*100}% ${this.c.focal[1]*100}%`;this.processed.style.objectPosition=this.image.style.objectPosition;
  this.el.setAttribute('aria-label',`${this.c.name}. ${this.tags.map(k=>this.config.archetypes[k].name).join(', ')}. Игровая сцена с анимированными эффектами.`);
  this.image.onload=()=>{if(token!==this.generation||this.destroyed)return;this.ready=true;this.prepareScene();this.resize();this.el.classList.remove('is-loading');this.el.classList.add('is-entering');this.schedule();};
  this.image.onerror=()=>{if(token!==this.generation||this.destroyed)return;this.ready=false;this.el.classList.remove('is-loading');this.onUpdate({error:'Не удалось загрузить исходный кадр.'});};
  this.image.src=this.root+this.c.scene;
  this.lastLaunchStep=-1;this.sounds.setProfile(this.tags);this.onUpdate({classId:id,tags:this.tags,loot:0});
 }
 resize(){
  const b=this.el.getBoundingClientRect();this.w=Math.max(1,b.width);this.h=Math.max(1,b.height);this.dpr=Math.min(devicePixelRatio||1,this.config.rendering.maxDpr);
  this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
  if(this.ready){const scale=Math.max(this.w/this.image.naturalWidth,this.h/this.image.naturalHeight);this.iw=this.image.naturalWidth*scale;this.ih=this.image.naturalHeight*scale;this.ix=(this.w-this.iw)*this.c.focal[0];this.iy=(this.h-this.ih)*this.c.focal[1];}
  this.render();
 }
 point(x,y){return [this.ix+x*this.iw,this.iy+y*this.ih];}
 buildEcho(){
  const [x,y,w,h]=this.c.hero;this.echo=document.createElement('canvas');this.echo.width=320;this.echo.height=Math.round(320*h*this.image.naturalHeight/(w*this.image.naturalWidth));
  const c=this.echo.getContext('2d'),ew=this.echo.width,eh=this.echo.height;
  c.drawImage(this.image,x*this.image.naturalWidth,y*this.image.naturalHeight,w*this.image.naturalWidth,h*this.image.naturalHeight,0,0,ew,eh);
  c.globalCompositeOperation='destination-in';c.save();c.translate(ew/2,eh/2);c.scale(ew/2,eh/2);let g=c.createRadialGradient(0,0,.22,0,0,1);g.addColorStop(0,'#fff');g.addColorStop(.62,'#fffd');g.addColorStop(1,'#fff0');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
 }
 stop(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.last=null;}
 schedule(){this.stop();this.sounds.setActive(Boolean(this.ready&&this.effectsEnabled&&!this.paused&&!document.hidden&&this.visible&&!this.destroyed));this.el.classList.toggle('is-paused',this.paused);if(!this.ready||!this.effectsEnabled||this.paused||document.hidden||!this.visible||this.motion.matches||this.destroyed){this.render();return;}this.last=performance.now();this.raf=requestAnimationFrame(n=>this.tick(n));}
 tick(now){this.raf=0;if(this.destroyed)return;this.t+=Math.min((now-this.last)/1000,.05);this.last=now;this.render();this.raf=requestAnimationFrame(n=>this.tick(n));}
 setEffectsEnabled(v){this.effectsEnabled=Boolean(v);this.el.classList.toggle('is-original',!this.effectsEnabled);this.schedule();}
 setShot(index){const n=Number(index),shots=this.config.classes[this.classId].shots;if(!Number.isInteger(n)||n<0||n>=shots.length)throw Error('Unknown shot');this.shots[this.classId]=n;this.setResult(this.classId,this.tags);}
 setIntensity(v){this.intensity=clamp(Number(v)||1,.3,1.2);this.render();}
 setPaused(v){this.paused=Boolean(v);this.schedule();}
 replay(){this.t=0;this.el.classList.remove('is-entering');void this.el.offsetWidth;this.el.classList.add('is-entering');this.render();this.schedule();this.sounds.cue('chime');}
 setMuted(v){this.muted=Boolean(v);this.sounds.setEnabled(!this.muted);}
 setVolume(v){this.sounds.setVolume(v);}
 setPreprocessing(v){this.preprocessing=Boolean(v);this.el.classList.toggle('no-preprocess',!this.preprocessing);}
 playSound(){if(!this.muted)this.sounds.sync();}
 createToneFilter(){
  const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg'),defs=document.createElementNS(NS,'defs'),filter=document.createElementNS(NS,'filter');svg.classList.add('pw-tone-defs');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');const id='pw-tone-'+(++PWScene.filterNumber);filter.id=id;filter.setAttribute('color-interpolation-filters','sRGB');
  const sat=document.createElementNS(NS,'feColorMatrix');sat.setAttribute('type','saturate');sat.setAttribute('values',String(this.config.preprocessing?.saturation??.97));filter.append(sat);
  const transfer=document.createElementNS(NS,'feComponentTransfer');for(const channel of ['R','G','B']){const f=document.createElementNS(NS,'feFunc'+channel);f.setAttribute('type','table');f.setAttribute('tableValues',(this.config.preprocessing?.toneTable||[0,.26,.51,.75,.94]).join(' '));transfer.append(f);}filter.append(transfer);defs.append(filter);svg.append(defs);this.processed.style.filter=`url(#${id})`;return svg;
 }
 prepareScene(){
  const w=this.image.naturalWidth,h=this.image.naturalHeight;this.processed.width=w;this.processed.height=h;const out=this.processed.getContext('2d');out.clearRect(0,0,w,h);out.filter=`blur(${this.config.preprocessing?.backgroundBlur??.7}px)`;out.drawImage(this.image,-2,-2,w+4,h+4);out.filter='none';
  const mask=document.createElement('canvas');mask.width=w;mask.height=h;const m=mask.getContext('2d');m.filter=`blur(${this.config.preprocessing?.maskFeather??13}px)`;m.fillStyle='#fff';
  for(const [x,y,rw,rh] of (this.c.sharpZones||[this.c.hero])){m.beginPath();m.roundRect((x-.015)*w,(y-.025)*h,(rw+.03)*w,(rh+.05)*h,18);m.fill();}
  for(const [x,y,rx,ry] of this.c.faces.concat(this.c.silhouettes)){m.beginPath();m.ellipse(x*w,y*h,rx*w*1.25,ry*h*1.25,0,0,TAU);m.fill();}
  for(const [x,y,xx,yy,r]of this.c.weapons){m.strokeStyle='#fff';m.lineWidth=r*w+20;m.lineCap='round';m.beginPath();m.moveTo(x*w,y*h);m.lineTo(xx*w,yy*h);m.stroke();}
  const sharp=document.createElement('canvas');sharp.width=w;sharp.height=h;const sc=sharp.getContext('2d');sc.drawImage(this.image,0,0);sc.globalCompositeOperation='destination-in';sc.drawImage(mask,0,0);out.drawImage(sharp,0,0);
 }
 glow(x,y,r,color,alpha=.3){const c=this.ctx;c.save();c.globalCompositeOperation='screen';c.globalAlpha=alpha;let g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
 star(x,y,r,color,alpha=1){const c=this.ctx;c.save();c.translate(x,y);c.globalAlpha=alpha;c.fillStyle=color;c.beginPath();for(let k=0;k<8;k++){let a=k*Math.PI/4,rr=k%2?r*.19:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.restore();}
 trail(points,color,width=1,alpha=.4){const c=this.ctx;c.save();c.globalCompositeOperation='screen';c.strokeStyle=color;c.lineWidth=width;c.globalAlpha=alpha;c.lineCap='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.restore();}
 coin(x,y,r,rot,tilt,alpha){const c=this.ctx;c.save();c.translate(x,y);c.rotate(rot);c.scale(Math.max(.10,Math.abs(Math.cos(tilt))),1);c.globalAlpha=alpha;
  const g=c.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#fff4ba');g.addColorStop(.3,'#ebba4f');g.addColorStop(.52,'#ffeaaa');g.addColorStop(1,'#916023');c.fillStyle=g;c.strokeStyle='#fff1ad';c.lineWidth=Math.max(.8,r*.1);c.beginPath();c.ellipse(0,0,r,r,0,0,TAU);c.fill();c.stroke();c.strokeStyle='#9c6c2d';c.lineWidth=r*.1;c.beginPath();c.arc(0,0,r*.71,0,TAU);c.stroke();c.fillStyle='#9b6828';c.fillRect(-r*.19,-r*.45,r*.38,r*.9);c.fillStyle='#ffe395';c.fillRect(-r*.10,-r*.4,r*.15,r*.8);c.restore();}
 crystal(x,y,r,rot,a){const c=this.ctx;c.save();c.translate(x,y);c.rotate(rot);c.globalAlpha=a;let g=c.createLinearGradient(-r,0,r,0);g.addColorStop(0,'#c7fff0');g.addColorStop(.4,'#83ebc3');g.addColorStop(1,'#296b8a');c.fillStyle=g;c.strokeStyle='#c0ffe3';c.lineWidth=.8;c.beginPath();c.moveTo(0,-r*1.5);c.lineTo(r,0);c.lineTo(r*.6,r);c.lineTo(-r*.5,r);c.lineTo(-r,0);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(0,-r*1.5);c.lineTo(-r*.25,0);c.lineTo(r*.6,r);c.moveTo(-r,0);c.lineTo(r,0);c.stroke();c.restore();}
 resource(x,y,r,angle,alpha,type){
  if(type===0){this.crystal(x,y,r,angle,alpha);return;}const c=this.ctx;c.save();c.translate(x,y);c.rotate(angle);c.globalAlpha=alpha;
  if(type===1){const g=c.createRadialGradient(-r*.3,-r*.3,0,0,0,r);g.addColorStop(0,'#f4fff6');g.addColorStop(.3,'#a8f7cf');g.addColorStop(.7,'#397e9c');g.addColorStop(1,'#14304a');c.fillStyle=g;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();c.strokeStyle='#b7edee';c.lineWidth=1;c.stroke();}
  else if(type===2){c.fillStyle='#a98455';c.strokeStyle='#e8cd96';c.lineWidth=1;c.beginPath();c.moveTo(-r*.42,-r*.55);c.quadraticCurveTo(-r*.15,-r*.05,-r*.75,r*.35);c.quadraticCurveTo(-r,r*1.1,0,r);c.quadraticCurveTo(r,r*1.1,r*.75,r*.35);c.quadraticCurveTo(r*.15,-r*.05,r*.42,-r*.55);c.closePath();c.fill();c.stroke();c.strokeStyle='#e7c46e';c.lineWidth=2;c.beginPath();c.moveTo(-r*.4,-r*.12);c.lineTo(r*.4,-r*.12);c.stroke();}
  else{c.fillStyle='#63442d';c.strokeStyle='#deb879';c.lineWidth=1.1;c.beginPath();c.roundRect(-r,-r*.65,r*2,r*1.4,2);c.fill();c.stroke();c.fillStyle='#8b6140';c.fillRect(-r,-r*.65,r*2,r*.45);c.strokeStyle='#deb879';c.beginPath();c.moveTo(-r*.5,-r*.65);c.lineTo(-r*.5,r*.75);c.moveTo(r*.5,-r*.65);c.lineTo(r*.5,r*.75);c.moveTo(-r,-r*.18);c.lineTo(r,-r*.18);c.stroke();c.fillStyle='#f4dc94';c.fillRect(-r*.16,-r*.12,r*.32,r*.38);}
  c.restore();
 }
 headAnchor(){const [x,y,rx,ry]=this.c.faces[0];return this.point(x,y-ry*2.1);}
 cartoonStar(x,y,r,rotation,alpha=1){const c=this.ctx;c.save();c.translate(x,y);c.rotate(rotation);c.globalAlpha=alpha;c.fillStyle='#ffe28b';c.strokeStyle='#b37a37';c.lineWidth=1;c.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,rr=k%2?r*.45:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.stroke();c.restore();}
 ambient(t){
  const c=this.ctx,w=this.w,h=this.h,kind=this.c.ambient,n=this.w<600?16:27;
  if(kind==='leaves'){
   for(let i=0;i<n;i++){const p=frac(t*(.018+rnd(i,1)*.02)+rnd(i,2)),x=(rnd(i,3)+Math.sin(t*.3+i)*.07)*w,y=p*h,r=2+rnd(i,4)*5;c.save();c.translate(x,y);c.rotate(t*.5+i);c.globalAlpha=.18+Math.sin(p*Math.PI)*.3;c.fillStyle=i%3?'#c4b574':'#a4e280';c.beginPath();c.ellipse(0,0,r,r*.35,0,0,TAU);c.fill();c.restore();}
   const [x,y]=this.point(...this.c.origin);for(let j=0;j<3;j++){let p=frac(t*.13+j*.33);this.glow(x+Math.sin(t*.6+j)*w*.15,y-p*h*.55,35+p*25,'#9cdf7b',(1-p)*.17);}
  }else if(kind==='butterflies'){
   for(let i=0;i<8;i++){let x=(.10+.8*rnd(i,1)+Math.sin(t*.28+i)*.05)*w,y=(.12+.72*rnd(i,2)+Math.sin(t*.35+i*3)*.06)*h,r=6+rnd(i,3)*8,flap=.15+.85*Math.abs(Math.sin(t*6+i));c.save();c.translate(x,y);c.rotate(Math.sin(t*.7+i)*.35);c.globalAlpha=.55;for(let side of [-1,1]){c.save();c.scale(side*flap,1);let g=c.createRadialGradient(0,0,0,0,0,r*1.5);g.addColorStop(0,'#dfc5ff');g.addColorStop(.5,'#8abefa');g.addColorStop(1,'#7c66e000');c.fillStyle=g;c.beginPath();c.ellipse(r*.6,-r*.15,r*.75,r,.4,0,TAU);c.fill();c.restore();}c.restore();this.glow(x,y,18,'#a3b5ef',.08);}
   for(let i=0;i<18;i++){let p=frac(t*.025+rnd(i,8));this.star((rnd(i,7)+Math.sin(t*.4+i)*.04)*w,p*h,1+rnd(i,6)*2,'#e5cefa',.2+.25*Math.sin(p*Math.PI));}
  }else{
   const [ox,oy]=this.point(...this.c.origin);
   for(let i=0;i<n*2;i++){let p=frac(t*(.09+rnd(i,1)*.12)+rnd(i,2)),x=ox+(rnd(i,3)-.5)*w*.47+Math.sin(t+i)*p*w*.04,y=oy-p*h*.8,r=1+rnd(i,4)*2.4;this.trail([[x,y],[x-Math.sin(i)*3,y+5]],'#ffc77b',r*.65,(1-p)*.55);this.glow(x,y,r*3,'#ff9a4e',(1-p)*.45);}
  }
 }
 gambler(t,scale){const w=this.w,h=this.h,c=this.ctx,n=Math.round((w<600?38:68)*scale);
  for(let i=0;i<n;i++){const depth=.25+.75*rnd(i,2),speed=.09+depth*.1,p=frac(t*speed+rnd(i,1)),x=(rnd(i,3)+Math.sin(t*.5+i)*.04)*w,y=(-.16+p*1.40)*h,r=(4+depth*12)*Math.min(w/900,1.3),a=Math.sin(p*Math.PI)*(.28+depth*.65);this.trail([[x,y-r*4],[x,y-r]],'#f9d581',r*.24,a*.2);this.coin(x,y,r,t*(.3+rnd(i,4))+i,t*(2+rnd(i,5)*3)+i,a);if(i%8===0)this.star(x+r,y-r,r*.7,'#fff1be',a*.7);}
  const [x,y]=this.point(...this.c.origin);this.glow(x,y,Math.min(w,h)*(.28+Math.sin(t*1.6)*.02),'#ffc65c',.12);
  if(t<2.8){const p=t/2.8;for(let i=0;i<22;i++){let a=rnd(i,10)*TAU,r=p*(60+rnd(i,11)*w*.25);this.star(x+Math.cos(a)*r,y+Math.sin(a)*r*.6-p*50,3,'#ffe3a2',(1-p)*.8);}}
 }
 multibox(t,scale){
  const seq=this.config.launchSequence||[];if(!seq.length)return;const total=seq.reduce((sum,s)=>sum+s.duration,0),cycle=Math.floor(t/total),local=t%total;let elapsed=0,active=0;for(let i=0;i<seq.length;i++){if(local>=elapsed&&local<elapsed+seq[i].duration){active=i;break;}elapsed+=seq[i].duration;}
  const key=cycle*seq.length+active;if(key!==this.lastLaunchStep){this.lastLaunchStep=key;if(!this.motion.matches)this.sounds.cue('window');this.onUpdate({launchStep:active,launchWindow:cycle+2});}
  const w=this.w,h=this.h,c=this.ctx,mobile=w<600,cardW=w*(mobile?.52:.225),cardH=cardW*.50+20,gap=w*(mobile?.33:.147),focusX=w*.5;
  const slide=clamp((local-elapsed)/.45),lift=Math.sin(ease(slide)*Math.PI/2);this.launchLayout=[];
  for(let i=0;i<seq.length;i++){const x=mobile?focusX+(i-active)*gap:w*(.12+i*.152),y=h*.98-cardH*.5+(i===active?-h*.045*lift:Math.sin(t*.5+i)*2);this.launchLayout.push({i,x,y,w:cardW,h:cardH});}
  const order=this.launchLayout.filter(x=>x.i!==active).concat(this.launchLayout[active]);
  for(const item of order){const {i,x,y,w:cw,h:ch}=item,img=this.launchImages[i],selected=i===active;if(x+cw/2<0||x-cw/2>w)continue;c.save();c.translate(x,y);c.rotate((i-active)*.006);c.globalAlpha=selected?.96:.48;c.shadowColor=selected?'#83ccff66':'#000a';c.shadowBlur=selected?16:8;c.fillStyle='#101b29';c.strokeStyle=selected?'#bee8ff':'#7292ac';c.lineWidth=selected?1.5:.65;c.beginPath();c.roundRect(-cw/2,-ch/2,cw,ch,5);c.fill();c.stroke();c.shadowBlur=0;
   c.font=`${Math.max(7,Math.min(10,w*.010))}px system-ui`;c.fillStyle=selected?'#d8edff':'#9eb5c7';c.textBaseline='middle';c.fillText(`${String(i+1).padStart(2,'0')}  ${seq[i].label}`,-cw/2+8,-ch/2+10,cw-18);
   if(img?.complete&&img.naturalWidth){const maxW=cw-10,maxH=ch-26,r=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight),iw=img.naturalWidth*r,ih=img.naturalHeight*r;c.drawImage(img,-iw/2,-ch/2+22+(maxH-ih)/2,iw,ih);}
   if(selected){const p=(local-elapsed)/seq[i].duration;c.fillStyle='#9cdaff';c.fillRect(-cw/2+2,ch/2-3,(cw-4)*p,2);}c.restore();
  }
  const glowX=this.launchLayout[active].x;this.glow(glowX,h*.94,cardW*.65,'#8cc8ff',.12);
 }
 fashion(t,scale){const c=this.ctx,w=this.w,h=this.h;
  c.save();c.globalCompositeOperation='screen';for(let j=0;j<3;j++){let x=(.5+Math.sin(t*.20+j*2)*.58)*w;c.save();c.translate(x,-h*.1);c.rotate(Math.sin(t*.18+j)*.25);let g=c.createLinearGradient(-w*.10,0,w*.10,0);g.addColorStop(0,'transparent');g.addColorStop(.5,j%2?'#f0b4fa14':'#bceaff18');g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(-w*.1,0,w*.2,h*1.5);c.restore();}c.restore();
  for(let i=0;i<65*scale;i++){let a=rnd(i,1)*TAU+t*(.06+rnd(i,2)*.12),radius=.15+rnd(i,3)*.45,x=w*.5+Math.cos(a)*w*radius,y=h*.54+Math.sin(a)*h*radius,twinkle=Math.pow((Math.sin(t*(1+rnd(i,4)*2)+i)+1)/2,4),r=1.2+rnd(i,5)*5;this.star(x,y,r,['#fff0cf','#d7eeff','#f4d2ff'][i%3],twinkle*.9);if(i%5===0)this.glow(x,y,16,'#e1aeed',twinkle*.18);}
  let pts=[];for(let i=0;i<80;i++){let p=i/79,a=p*TAU*1.3+t*.35;pts.push([w*.5+Math.cos(a)*w*(.16+p*.10),h*.86-p*h*.7]);}this.trail(pts,'#f0cded',1.1,.22);
 }
 fashionDetails(t,scale){const c=this.ctx,w=this.w,h=this.h;
  c.save();const gradient=c.createLinearGradient(0,0,w,h);gradient.addColorStop(0,`hsl(${280+Math.sin(t*.3)*35} 65% 82% / .8)`);gradient.addColorStop(.5,'#e9deaf66');gradient.addColorStop(1,'#bceaffb0');c.strokeStyle=gradient;c.lineWidth=1.5;c.beginPath();c.roundRect(10,10,w-20,h-20,5);c.stroke();c.restore();
  const [hx,hy]=this.headAnchor();for(let i=0;i<9*scale;i++){const a=t*.22+i*2.4,x=w*.5+Math.cos(a)*w*(.28+.03*Math.sin(i)),y=h*.52+Math.sin(a)*h*.38;this.crystal(x,y,4+rnd(i,1)*5,t*.45+i,.45+.3*Math.sin(t+i));}
  c.save();c.translate(hx,hy);c.globalAlpha=.72;c.fillStyle='#e4c38e';c.strokeStyle='#fff1c8';c.lineWidth=.8;c.beginPath();c.moveTo(-15,6);c.lineTo(-18,-7);c.lineTo(-8,-2);c.lineTo(0,-14);c.lineTo(8,-2);c.lineTo(18,-7);c.lineTo(15,6);c.closePath();c.fill();c.stroke();c.fillStyle='#d8c0ed';c.fillRect(-13,8,26,2);c.restore();this.star(hx+24,hy-7,3,'#fff6e0',.5+.5*Math.sin(t*2));
  c.save();c.font=`${Math.max(8,Math.min(11,w*.014))}px system-ui`;c.textAlign='right';c.fillStyle='#f4dfed';c.globalAlpha=.85;c.fillText('FASHION EDITION',w-23,h-22);c.restore();
 }
 farmer(t,scale){const w=this.w,h=this.h,[ox,oy]=this.point(...this.c.origin),n=Math.round(38*scale);
  for(let i=0;i<n;i++){let p=frac(t*(.08+rnd(i,2)*.04)+rnd(i,1)),sx=(.03+rnd(i,3)*.94)*w,sy=-h*.18-rnd(i,4)*h*.25,x=sx*(1-p)+ox*p+Math.sin(p*Math.PI)*(rnd(i,5)-.5)*w*.20,y=sy*(1-p)+oy*p-Math.sin(p*Math.PI)*h*.12,r=(5+rnd(i,6)*10)*(0.6+p*.6),a=Math.sin(p*Math.PI)*.9;let pts=[];for(let j=0;j<6;j++){let q=Math.max(0,p-j*.012);pts.push([sx*(1-q)+ox*q+Math.sin(q*Math.PI)*(rnd(i,5)-.5)*w*.20,sy*(1-q)+oy*q-Math.sin(q*Math.PI)*h*.12]);}this.trail(pts,'#9dffd4',1.1,a*.42);this.resource(x,y,r,Math.sin(t+i)*.4,a,i%4);}
  this.glow(ox,oy,55+Math.sin(t*4)*7,'#9eeed1',.30);const c=this.ctx;for(let k=0;k<3;k++){let p=frac(t*.7+k/3);c.save();c.strokeStyle='#a0ffdd';c.globalAlpha=(1-p)*.28;c.lineWidth=1;c.beginPath();c.ellipse(ox,oy,15+p*75,4+p*18,0,0,TAU);c.stroke();c.restore();}
  for(let i=0;i<3;i++){let p=frac(t*.55+i/3),x=ox+w*(.12+i*.035),y=oy-p*h*.21;c.save();c.globalAlpha=Math.sin(p*Math.PI)*.9;c.fillStyle='#d0ffda';c.shadowColor='#164a38';c.shadowBlur=5;c.font=`600 ${Math.max(11,Math.min(17,w*.022))}px system-ui`;c.fillText('+'+(1+(Math.floor(t*.55)+i)%4)+' лут',x,y);c.restore();}
  this.onUpdate({loot:Math.floor(t*14)});
 }
 afk(t,scale){const c=this.ctx,w=this.w,h=this.h,[ox,oy]=this.point(...this.c.origin);
  for(let j=0;j<5;j++){let p=frac(t*.045+j*.2),r=w*(.1+p*.2);this.glow(ox+Math.sin(t*.17+j)*w*.24,oy-p*h*.55,r,'#a9b9dc',.045*scale);}
  for(let i=0;i<5;i++){let p=frac(t*.10+i*.2),x=ox+Math.sin(i*2+t*.23)*w*.13,y=oy-p*h*.9;c.save();c.translate(x,y);c.rotate(Math.sin(t*.3+i)*.15);c.globalAlpha=Math.sin(p*Math.PI)*.55*scale;c.font=`italic ${14+p*18}px Georgia`;c.fillStyle='#e0e5ff';c.fillText(i%2?'z':'Z',0,0);c.restore();}
  for(let j=0;j<3;j++){let p=frac(t*.08+j/3);c.save();c.strokeStyle='#c0cdf6';c.globalAlpha=(1-p)*.16;c.lineWidth=1;c.beginPath();c.ellipse(ox,oy-p*h*.55,w*(.06+p*.15),h*.025,Math.sin(t*.1)*.1,0,TAU);c.stroke();c.restore();}
 }
 afkDetails(t){const c=this.ctx,[x,y]=this.point(...this.c.origin);c.save();c.translate(x-this.w*.14,y-this.h*.16);c.globalAlpha=.52+.10*Math.sin(t*.8);c.font=`${Math.max(13,Math.min(20,this.w*.025))}px Georgia`;c.fillStyle='#d8dff6';c.textAlign='center';c.fillText('AFK',0,0);c.restore();}
 chatter(t,scale){const c=this.ctx,w=this.w,h=this.h,phrases=['Пати, вы где? 😅','Ещё один заход? ✨','Я всё объясню. 🙂','Подождите меня!'];
  for(let i=0;i<3;i++){let p=frac(t*.115+i/3),x=(.18+i*.28+Math.sin(t*.4+i)*.035)*w,y=(.89-p*.75)*h,a=Math.sin(p*Math.PI)*.9*scale;textBubble(c,phrases[(i+Math.floor(t*.115))%phrases.length],x,y,Math.max(10,Math.min(16,w*.018)),a);this.glow(x,y,65,'#9fe2ef',a*.08);}
  c.save();c.fillStyle='#132b37ce';c.strokeStyle='#8cc9d17a';c.lineWidth=.7;c.beginPath();c.roundRect(18,42,95,24,5);c.fill();c.stroke();c.font='9px system-ui';c.fillStyle='#d3edf2';c.fillText('●  МИРЧАТ',30,58);c.restore();
 }
 parkour(t,scale){const w=this.w,h=this.h,c=this.ctx;
  for(let j=0;j<4;j++){let p=frac(t*(.23+j*.035)+j*.24),pts=[];const f=q=>[(-.18+q*1.36)*w,(.89-Math.sin(q*Math.PI)*(.57-j*.075))*h];
   for(let k=0;k<22;k++){let q=p-k*.006;if(q>=0)pts.push(f(q));}this.trail(pts,j%2?'#dbf8ff':'#b8dcff',2.4-j*.32,.55*scale);const [x,y]=f(p);this.glow(x,y,10,'#ddf8ff',.6);this.star(x,y,3,'#eaffff',.8);
   let echo=[];for(let k=0;k<50;k++){let q=k/49;echo.push(f(q));}c.save();c.setLineDash([2,12]);this.trail(echo,'#bce8ff',.7,.10*scale);c.restore();
  }
  for(let i=0;i<23*scale;i++){let p=frac(t*.7+rnd(i,1)),x=p*w,y=rnd(i,2)*h;this.trail([[x-20,y+5],[x,y]],'#d6f2ff',.7,Math.sin(p*Math.PI)*.22);}
 }
 parkourDetails(t,scale){const c=this.ctx,w=this.w,h=this.h;
  for(let k=0;k<4;k++){const p=frac(t*(.23+k*.035)+k*.24),age=p/.20;if(age<1){const x=w*.96,y=h*.89;this.glow(x,y,45*(1-age)+12,'#cdefff',(1-age)*.42);for(let j=0;j<12*scale;j++){const a=-Math.PI*(.1+rnd(j,k+3)*.8),r=age*(15+rnd(j,k+8)*75),sx=x+Math.cos(a)*r,sy=y+Math.sin(a)*r+age*age*25;this.trail([[sx,sy],[sx-Math.cos(a)*7,sy-Math.sin(a)*7]],'#d8f4ff',1,(1-age)*.8);}}}
 }
 dizzy(t,scale){const c=this.ctx,[hx,hy]=this.headAnchor(),rx=Math.max(27,Math.min(67,this.c.faces[0][2]*this.iw*1.15)),ry=rx*.28;
  c.save();c.translate(hx,hy);c.rotate(-.14);c.strokeStyle='#fff0b1';c.globalAlpha=.55;c.lineWidth=1.8;c.beginPath();c.ellipse(0,0,rx,ry,0,0,TAU);c.stroke();c.restore();
  const stars=[];for(let i=0;i<5;i++){let a=t*1.8+i*TAU/5;stars.push({a,x:hx+Math.cos(a)*rx,y:hy+Math.sin(a)*ry-Math.cos(a)*rx*.14,depth:(Math.sin(a)+1)/2});}stars.sort((a,b)=>a.depth-b.depth);
  for(const p of stars){let trail=[];for(let j=0;j<7;j++){let a=p.a-j*.045;trail.push([hx+Math.cos(a)*rx,hy+Math.sin(a)*ry-Math.cos(a)*rx*.14]);}this.trail(trail,'#ffe8a5',1.5,.34);this.cartoonStar(p.x,p.y,5.5+p.depth*3.5,t*.8+p.a,.65+p.depth*.35);}
 }
 protect(){const c=this.ctx;c.save();c.globalCompositeOperation='destination-out';
  const ellipse=(v,strength)=>{let [x,y,rx,ry]=v,[cx,cy]=this.point(x,y);c.save();c.translate(cx,cy);c.scale(rx*this.iw,ry*this.ih);let g=c.createRadialGradient(0,0,.2,0,0,1.25);g.addColorStop(0,`rgba(0,0,0,${strength})`);g.addColorStop(.66,`rgba(0,0,0,${strength*.8})`);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(-1.3,-1.3,2.6,2.6);c.restore();};
  this.c.silhouettes.forEach(v=>ellipse(v,.76));this.c.faces.forEach(v=>ellipse(v,1));
  for(let [x1,y1,x2,y2,r] of this.c.weapons){let p=this.point(x1,y1),q=this.point(x2,y2);c.strokeStyle='rgba(0,0,0,.75)';c.lineCap='round';c.lineWidth=r*this.iw;c.beginPath();c.moveTo(...p);c.lineTo(...q);c.stroke();}c.restore();
 }
 render(){if(!this.ctx||!this.w)return;const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.w,this.h);if(!this.ready||!this.effectsEnabled)return;
  const t=this.motion.matches?1.8:this.t;this.ambient(t);const density=(this.tags.length>1?.64:1)*(this.w<600?.65:1)*this.intensity;
  for(const tag of this.tags)if(tag!=='multibox'){this[tag](t,density);if(tag==='fashion')this.fashionDetails(t,density);if(tag==='afk')this.afkDetails(t);if(tag==='parkour')this.parkourDetails(t,density);}this.protect();if(this.tags.includes('multibox'))this.multibox(t,density);this.frameCount++;
 }
 destroy(){this.destroyed=true;this.stop();this.generation++;this.image.onload=this.image.onerror=null;this.resizeObserver.disconnect();this.intersectionObserver.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);this.motion.removeEventListener('change',this.onMotion);this.sounds.destroy();this.el.remove();}
}
function wUnit(scene){return scene.w;}
function textBubble(c,text,x,y,size,alpha){c.save();c.translate(x,y);c.globalAlpha=alpha;c.font=`${size}px system-ui`;let w=c.measureText(text).width+24,h=size+21;c.fillStyle='#182b3ad9';c.strokeStyle='#bae9efb0';c.lineWidth=1;c.beginPath();c.roundRect(-w/2,-h/2,w,h,11);c.fill();c.stroke();c.fillStyle='#b9e6ed';c.beginPath();c.moveTo(-w*.25,h*.5);c.lineTo(-w*.25+8,h*.5+8);c.lineTo(-w*.25+10,h*.5);c.fill();c.fillStyle='#e0f4f8';c.textAlign='center';c.textBaseline='middle';c.fillText(text,0,0);c.restore();}
PWScene.filterNumber=0;global.PWScene=PWScene;
})(window);

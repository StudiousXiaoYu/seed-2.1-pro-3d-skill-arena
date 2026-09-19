// ============================================================
// 火柴人技能 Demo 04 · 多技能（火/雷/冰/陨星/水）
// 左键：火球按住蓄力；其余技能左键即放 · 空格+左键旋转 · 数字键/图标切换
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  MeshBasicMaterial, MeshStandardMaterial, AdditiveBlending, NormalBlending,
  DoubleSide, Group, Vector3, Color
} from 'three';
import {
  BatchedParticleRenderer, ParticleSystem, QuarksLoader, QuarksUtil,
  ConeEmitter, SphereEmitter, PointEmitter, ConstantValue, IntervalValue, ConstantColor,
  ColorOverLife, SizeOverLife, ForceOverLife, Gradient, Bezier, PiecewiseBezier
} from 'three.quarks';
import { createHeroShell } from './hero.js';
import { createEnemyShell } from './enemy.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new Color(0x06070c);
scene.fog = new THREE.Fog(0x06070c, 22, 46);
const pmrem=new THREE.PMREMGenerator(renderer); scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture; scene.environmentIntensity=0.5;

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(4.2, 4.05, 12.4);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.6, 0);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.enablePan = false; controls.minDistance = 5; controls.maxDistance = 24;
controls.minPolarAngle = 0.5; controls.maxPolarAngle = 1.52;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null };
canvas.addEventListener('contextmenu', e => e.preventDefault());

scene.add(new THREE.AmbientLight(0x6a78aa, 1.35));
scene.add(new THREE.HemisphereLight(0x9db6ee, 0x241a12, 0.85));
const moon = new THREE.DirectionalLight(0xcfe0ff, 2.2); moon.position.set(-5, 9, 6); scene.add(moon);
moon.castShadow=true; moon.shadow.mapSize.set(1024,1024);
moon.shadow.camera.near=1; moon.shadow.camera.far=24; moon.shadow.camera.left=-10; moon.shadow.camera.right=10; moon.shadow.camera.top=10; moon.shadow.camera.bottom=-10;
scene.add(moon.target);
const fxLight = new THREE.PointLight(0xffffff, 0, 26, 2); scene.add(fxLight);
const chargeLight = new THREE.PointLight(0xff8a2a, 0, 8, 2); scene.add(chargeLight);

const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new MeshStandardMaterial({ color: 0x1d2742, roughness: 0.92 }));
ground.receiveShadow=true;
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const grid = new THREE.GridHelper(40, 40, 0x2b3660, 0x161d36);
grid.position.y = 0.01; grid.material.transparent = true; grid.material.opacity = 0.3; scene.add(grid);

const batch = new BatchedParticleRenderer(); scene.add(batch);
const softTex = new THREE.TextureLoader().load('textures/particle_default.png');

function makeFlameTexture() {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'); g.clearRect(0, 0, S, S);
  g.beginPath(); g.moveTo(S*.5, S*.96);
  g.bezierCurveTo(S*.12, S*.64, S*.30, S*.30, S*.5, S*.06);
  g.bezierCurveTo(S*.72, S*.30, S*.88, S*.64, S*.5, S*.96); g.closePath();
  g.save(); g.clip();
  let grd = g.createLinearGradient(0, S*.96, 0, S*.08);
  grd.addColorStop(0,'rgba(255,255,255,.95)'); grd.addColorStop(.45,'rgba(255,255,255,.85)');
  grd.addColorStop(.8,'rgba(255,255,255,.45)'); grd.addColorStop(1,'rgba(255,255,255,.04)');
  g.fillStyle=grd; g.fillRect(0,0,S,S);
  for(let i=0;i<240;i++){ g.globalCompositeOperation='destination-out'; g.globalAlpha=Math.random()*.32;
    g.beginPath(); g.arc(Math.random()*S,Math.random()*S,2+Math.random()*9,0,Math.PI*2); g.fill(); }
  g.globalCompositeOperation='source-over'; g.globalAlpha=1;
  const core=g.createRadialGradient(S*.5,S*.64,2,S*.5,S*.62,S*.32);
  core.addColorStop(0,'rgba(255,255,255,.85)'); core.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=core; g.beginPath(); g.arc(S*.5,S*.62,S*.32,0,Math.PI*2); g.fill();
  g.restore(); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const flameTex = makeFlameTexture();

const grad = (stops, alpha) => new Gradient(stops.map(c=>[new Vector3(c[0],c[1],c[2]),c[3]]), alpha);
const gFire = () => grad([[1,.58,.14,0],[1,.42,.10,.25],[1,.30,.07,.55],[.72,.16,.03,.82],[.28,.05,.01,1]], [[0,0],[.95,.12],[.7,.6],[0,1]]);
const gEmber = () => grad([[1,.42,.10,0],[.95,.26,.05,.4],[.6,.12,.02,.8],[.25,.04,.01,1]], [[0,0],[.95,.1],[.65,.55],[0,1]]);
const gIce = () => grad([[.85,.95,1,0],[.55,.8,1,.35],[.35,.6,.95,.7],[.2,.35,.7,1]], [[0,0],[1,.15],[.85,.6],[0,1]]);
const gWater = () => grad([[.8,.92,1,0],[.45,.7,.95,.4],[.25,.45,.8,.8],[.12,.25,.55,1]], [[0,0],[1,.2],[.9,.7],[0,1]]);
const gBolt = () => grad([[1,1,1,0],[.75,.9,1,.3],[.5,.75,1,.6],[.3,.5,.9,1]], [[0,0],[1,.1],[.9,.55],[0,1]]);
const matAdd = () => new MeshBasicMaterial({ map: softTex, blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide });
const matFlame = () => new MeshBasicMaterial({ map: flameTex, blending: NormalBlending, transparent: true, depthWrite: false, side: DoubleSide, opacity: .96 });
const grow = () => new PiecewiseBezier([[new Bezier(.35,.9,1.3,1.05),0]]);
const shrink = () => new PiecewiseBezier([[new Bezier(1,.7,.3,0),0]]);

function makeSystem(cfg, behaviors = []) {
  const sys = new ParticleSystem(Object.assign({
    duration:1, looping:true, worldSpace:true,
    startColor:new ConstantColor(new THREE.Vector4(1,1,1,1)),
    shape:new PointEmitter(), material:matAdd(), maxParticle:200, renderOrder:2
  }, cfg));
  behaviors.forEach(b=>sys.addBehavior(b));
  batch.addSystem(sys); const em = sys.emitter; scene.add(em);
  em.visible=false; sys.endEmit(); return {sys,em};
}
const chargeP = makeSystem({ worldSpace:false, startLife:new IntervalValue(.22,.42), startSpeed:new IntervalValue(-2.6,-1.1),
  startSize:new IntervalValue(.14,.26), emissionOverTime:new ConstantValue(150), shape:new SphereEmitter({radius:.4}),
  maxParticle:140 }, [new ColorOverLife(gEmber()), new SizeOverLife(shrink())]);
const fireTrail = makeSystem({ startLife:new IntervalValue(.3,.55), startSpeed:new IntervalValue(1,2.4),
  startSize:new IntervalValue(.14,.26), emissionOverTime:new ConstantValue(180),
  shape:new ConeEmitter({radius:.08,angle:.3,thickness:1}), maxParticle:200 },
  [new ColorOverLife(gFire()), new SizeOverLife(grow()), new ForceOverLife(new ConstantValue(0),new ConstantValue(.8),new ConstantValue(0))]);
const fireWrap = makeSystem({ startLife:new IntervalValue(.22,.42), startSpeed:new IntervalValue(.4,.9),
  startSize:new IntervalValue(.34,.62), emissionOverTime:new ConstantValue(220),
  shape:new SphereEmitter({radius:.2}), material:matFlame(), maxParticle:200, renderOrder:3 },
  [new ColorOverLife(gEmber()), new SizeOverLife(grow()), new ForceOverLife(new ConstantValue(0),new ConstantValue(.7),new ConstantValue(0))]);

const effects=[];
function addEffect(life,update,dispose){ effects.push({age:0,life,update,dispose}); }
let shakeAmt=0;
function shake(a){ shakeAmt=Math.min(1.4,shakeAmt+a); }

// ---- 全屏元素闪光 ----
const flashEl=document.getElementById('fx-flash');
let flashColor='255,255,255', flashPower=0;
function screenFlash(hex='#ffffff',power=.7){
  const c=new Color(hex); flashColor=Math.round(c.r*255)+','+Math.round(c.g*255)+','+Math.round(c.b*255);
  flashPower=Math.min(1,flashPower+power);
}
// ---- 命中顿帧（时间缩放）----
let hitStop=0;
function freeze(t=.06){ hitStop=Math.max(hitStop,t); }
// ---- 飘字伤害（把世界点投影到屏幕）----
function popText(world,text,color='#ffd9a0',big=false,crit=false){
  const v=world.clone().project(camera);
  const x=(v.x*.5+.5)*window.innerWidth, y=(-v.y*.5+.5)*window.innerHeight;
  const el=document.createElement('div'); el.className='float-dmg'+(big?' big':'')+(crit?' crit':'');
  el.textContent=text; el.style.color=color;
  el.style.transform='translate('+x+'px,'+y+'px) translate(-50%,-50%)';
  document.body.appendChild(el);
  const drift=(Math.random()-.5)*40;
  el.animate([
    {transform:'translate('+x+'px,'+y+'px) translate(-50%,-50%) scale(.6)',opacity:0},
    {opacity:1,offset:.15},
    {transform:'translate('+(x+drift)+'px,'+(y-90)+'px) translate(-50%,-50%) scale('+(big?1.25:1.05)+')',opacity:1,offset:.35},
    {transform:'translate('+(x+drift*1.4)+'px,'+(y-170)+'px) translate(-50%,-50%) scale(1)',opacity:0}
  ],{duration:1100,easing:'cubic-bezier(.2,.7,.3,1)'}).onfinish=()=>el.remove();
}
function burst(pos,{ color=gFire, count=80, speed=[2,7], size=[.2,.5], life=[.4,.9], shape, material, force=0, max=300 }={}) {
  const sys = new ParticleSystem({
    duration:1, looping:false, worldSpace:true,
    startLife:new IntervalValue(life[0],life[1]),
    startSpeed:new IntervalValue(speed[0],speed[1]),
    startSize:new IntervalValue(size[0],size[1]),
    startColor:new ConstantColor(new THREE.Vector4(1,1,1,1)),
    emissionOverTime:new ConstantValue(0),
    emissionBursts:[{time:0,count:new ConstantValue(count),cycle:1,interval:.01,probability:1}],
    shape: shape || new SphereEmitter({radius:.15}),
    material: material || matAdd(), maxParticle:max, renderOrder:3
  });
  sys.addBehavior(new ColorOverLife(color()));
  sys.addBehavior(new SizeOverLife(grow()));
  if(force) sys.addBehavior(new ForceOverLife(new ConstantValue(0),new ConstantValue(force),new ConstantValue(0)));
  batch.addSystem(sys); scene.add(sys.emitter);
  sys.emitter.position.copy(pos); sys.restart();
  addEffect(life[1]+.4, function(dt){ return this.age < this.life; },
    ()=>{ scene.remove(sys.emitter); sys.dispose(); });
  return sys;
}

function cyl(r,len,color,rough=.7){ return new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,14), new MeshStandardMaterial({color,roughness:rough})); }
// 圆头 3D 骨骼段（胶囊）：boneLen 为枢轴间距，自动投影
function bone(r,boneLen,mat){
  const geo=new THREE.CapsuleGeometry(r,Math.max(.02,boneLen-2*r),6,14);
  const m=new THREE.Mesh(geo,mat); m.position.y=-boneLen/2; m.castShadow=true; return m;
}
function joint(r,mat){ const m=new THREE.Mesh(new THREE.SphereGeometry(r,14,12),mat); m.castShadow=true; return m; }
const hero=createHeroShell(scene,new Vector3(-4.6,0,0));
const fireball=new THREE.Mesh(new THREE.SphereGeometry(.12,20,16),
  new MeshStandardMaterial({color:0xff7a26,emissive:0xff4d0a,emissiveIntensity:.8,roughness:.55}));
fireball.visible=false; scene.add(fireball);


function cyl2(r,len,m){ const mm=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,10),m); return mm; }

// 两段式解析 IK：把“肩+肘”的手放到局部目标点（相对肩，XY 平面）
// bendSign: 肘弯曲方向（侧视火柴人取 -1 让肘向后/下）
function solveArm2D(shoulder,elbow,target,l1=.28,l2=.28,bendSign=1){
  const dx=target.x, dy=target.y;
  let d=Math.hypot(dx,dy);
  d=Math.max(.001,Math.min(d,l1+l2-.001));
  // 肩到目标的方向角（骨骼默认沿 -Y，0 角时手在正下方）
  const base=Math.atan2(dx,-dy);
  let cosA=(l1*l1+d*d-l2*l2)/(2*l1*d); cosA=Math.max(-1,Math.min(1,cosA));
  const a=Math.acos(cosA);
  let cosB=(l1*l1+l2*l2-d*d)/(2*l1*l2); cosB=Math.max(-1,Math.min(1,cosB));
  const b=Math.acos(cosB);
  // shoulder.rotation.z：-Y 为基准，向 +X 为正；肘弯角
  shoulder.rotation.z=base - bendSign*a;
  elbow.rotation.z= bendSign*(Math.PI-b);
  return d;
}
// 世界坐标 -> 肩部局部，再用 2D IK 把手放到目标
function reachArmIK(arm, worldTarget, bendSign){
  const parent=arm.shoulder.parent;
  parent.updateWorldMatrix(true,false);
  const local=worldTarget.clone(); parent.worldToLocal(local);
  local.sub(arm.shoulder.position);
  solveArm2D(arm.shoulder, arm.elbow, local, 0.32, 0.32, bendSign);
}



// 敌人箭矢
const arrows=[];
const arrowShaftMat=new THREE.MeshStandardMaterial({color:0xcdb487,roughness:.8});
const arrowHeadMat=new THREE.MeshStandardMaterial({color:0xe8e8ee,roughness:.3,metalness:.5});
function makeArrow(){
  const g=new Group();
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.6,8),arrowShaftMat);
  shaft.rotation.z=Math.PI/2; g.add(shaft);
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.05,.14,10),arrowHeadMat);
  tip.rotation.z=-Math.PI/2; tip.position.x=.34; g.add(tip);
  const f1=new THREE.Mesh(new THREE.BoxGeometry(.1,.03,.01),new THREE.MeshBasicMaterial({color:0xeeeeee}));
  f1.position.x=-.28; g.add(f1);
  return g;
}
function enemyShoot(){
  if(gameState!=='playing'||dummy.dead) return;
  const from=dummy.bowWorld(new Vector3());
  const aim=hero.root.position;
  let dx=aim.x-from.x, dz=aim.z-from.z; const d=Math.hypot(dx,dz)||1; dx/=d; dz/=d;
  const dir=Math.sign(dx)||-1;
  const a=makeArrow(); a.position.copy(from);
  a.scale.x=dir; // 箭头默认朝 +X，按方向翻转
  scene.add(a);
  // 抛物线解算：水平定速，反推竖直初速度，使箭落到主角胸口高度
  const g=6, speed=10, t=d/speed, targetY=1.5;
  const vy=(targetY-from.y + 0.5*g*t*t)/t;
  arrows.push({mesh:a,vel:new Vector3(dx*speed,vy,dz*speed),age:0,dir});
}
function updateArrows(dt){
  for(let i=arrows.length-1;i>=0;i--){ const a=arrows[i]; a.age+=dt; a.vel.y-=6*dt;
    a.mesh.position.addScaledVector(a.vel,dt); a.mesh.rotation.x+=a.vel.z*dt*a.dir;
    const hx=hero.root.position.x, hz=hero.root.position.z;
    if(Math.abs(a.mesh.position.x-hx)<.35 && Math.abs(a.mesh.position.z-hz)<.4 && a.mesh.position.y<2 && a.mesh.position.y>.4){
      burst(new Vector3(hx,1.4,hz),{color:gBolt,count:14,speed:[1.5,5],size:[.08,.2],life:[.2,.45],max:40});
      // 结算后残留的箭只播放撞击、不再造成伤害
      if(gameState==='playing'&&!dummy.dead){
        st.flinch=Math.max(st.flinch||0,.3); shake(.18);
        damageHero(ARROW_DMG);
      }
      scene.remove(a.mesh); arrows.splice(i,1); continue;
    }
    if(a.mesh.position.y<=.08 || a.age>2.2){
      burst(a.mesh.position.clone().setY(.15),{color:gEmber,count:6,speed:[.5,2],size:[.06,.14],life:[.2,.4],max:20});
      scene.remove(a.mesh); arrows.splice(i,1);
    }
  }
}

const dummy=createEnemyShell(scene,new Vector3(4.6,0,0));

// 敌人 AI：随机游走 -> 停步转身拉弓 -> 放箭
const _eTmp=new Vector3();
function updateEnemy(dt){
  const d=dummy;
  if(d.dead) return; // 死亡：倒地动画由主循环处理，AI/弓箭全停
  if(gameState!=='playing'){
    // 结算后：原地 Idle，不再推进状态机/放箭
    d.tick(dt,null,0,null,null);
    if(d.justShot>0) d.justShot-=dt;
    d.center.set(d.group.position.x,1.5,d.group.position.z);
    return;
  }
  const ai=d.ai;
  const frozen=d.frozen>0;
  if(ai.grace>0){
    if(!frozen) ai.grace-=dt;
    const faceG=new Vector3(hero.root.position.x-d.group.position.x,0,hero.root.position.z-d.group.position.z);
    d.tick(dt,null,0,faceG,hero.root.position);
    if(d.justShot>0) d.justShot-=dt;
    d.center.set(d.group.position.x,1.5,d.group.position.z);
    return;
  }
  if(!frozen) ai.t+=dt;
  let moving=false, draw=0, moveVec=null;
  const faceVec=new Vector3();
  if(!frozen){
    if(ai.state==='wander'){
      const tx=ai.target.x-d.group.position.x, tz=ai.target.z-d.group.position.z;
      const dist=Math.hypot(tx,tz);
      if(dist>0.15 && ai.t<4){
        faceVec.set(tx/dist,0,tz/dist); moveVec=faceVec.clone(); moving=true;
        d.group.position.x+=faceVec.x*1.7*dt;
        d.group.position.z+=faceVec.z*1.7*dt;
      } else { ai.state='aim'; ai.t=0; ai.draw=0; }
    } else if(ai.state==='aim'){
      faceVec.set(hero.root.position.x-d.group.position.x,0,hero.root.position.z-d.group.position.z).normalize();
      ai.draw=Math.min(1,ai.t/0.55); draw=ai.draw;
      if(ai.t>0.85){ ai.state='shoot'; ai.t=0; ai.hasShot=false; }
    } else if(ai.state==='shoot'){
      faceVec.set(hero.root.position.x-d.group.position.x,0,hero.root.position.z-d.group.position.z).normalize();
      draw=1;
      if(!ai.hasShot){ ai.hasShot=true; enemyShoot(); d.justShot=0.22; }
      if(ai.t>0.35){ ai.state='wander'; ai.t=0; ai.draw=0;
        ai.target.set(4.6+(Math.random()-.5)*4.5,0,(Math.random()-.5)*3);
        ai.target.x=THREE.MathUtils.clamp(ai.target.x,-2,8); ai.target.z=THREE.MathUtils.clamp(ai.target.z,-3.5,3.5);
      }
    }
  }
  // Soldier 骨骼动画：Idle/Walk + 朝向 + 拉弓弦
  d.tick(dt, moving?moveVec:null, draw, (faceVec.lengthSq()>1e-6?faceVec:null), hero.root.position);
  if(d.justShot>0) d.justShot-=dt;
  d.center.set(d.group.position.x,1.5,d.group.position.z);
}



const raycaster=new THREE.Raycaster(); const ndc=new THREE.Vector2(.15,.1);
const aimPlane=new THREE.Plane(new Vector3(0,1,0),0);
const aimPoint=new Vector3(4.6,1.45,0), aimGround=new Vector3(4.6,0,0);
const reticle=new THREE.Mesh(new THREE.RingGeometry(.22,.32,32),
  new MeshBasicMaterial({color:0xffd9a0,transparent:true,opacity:.95,side:DoubleSide,depthWrite:false}));
reticle.rotation.x=-Math.PI/2; reticle.position.y=.03; scene.add(reticle);
const reticleDot=new THREE.Mesh(new THREE.CircleGeometry(.05,20),
  new MeshBasicMaterial({color:0xffd9a0,transparent:true,opacity:.95,depthWrite:false}));
reticleDot.rotation.x=-Math.PI/2; reticleDot.position.y=.04; scene.add(reticleDot);
function updateAim(){
  raycaster.setFromCamera(ndc,camera); const hit=new Vector3();
  if(raycaster.ray.intersectPlane(aimPlane,hit)){ aimPoint.copy(hit); aimGround.set(hit.x,0,hit.z); }
  const locked=Math.hypot(aimGround.x-dummy.center.x,aimGround.z-dummy.center.z)<1.1;
  reticle.position.set(aimGround.x,.03,aimGround.z); reticleDot.position.set(aimGround.x,.04,aimGround.z);
  return locked;
}
canvas.addEventListener('pointermove',e=>{ const r=canvas.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1); });

let explosionPrefab=null;
function spawnExplosion(pos,scale=1.7){
  if(explosionPrefab){ const fx=explosionPrefab.clone(true);
    QuarksUtil.setAutoDestroy(fx,true); QuarksUtil.addToBatchRenderer(fx,batch);
    fx.position.copy(pos); fx.scale.setScalar(scale); scene.add(fx); QuarksUtil.play(fx); }
  fxLight.position.copy(pos); fxLight.color.setHex(0xffd9a0); fxLight.intensity=30;
  shake(.55*scale);
}
new QuarksLoader().load('ps.json',o=>{explosionPrefab=o;finishLoad();},undefined,e=>{console.error(e);finishLoad();});

function shockRing(pos,color=0xffc06a,maxScale=3){
  const mat=new MeshBasicMaterial({color,transparent:true,opacity:.95,blending:AdditiveBlending,side:DoubleSide,depthWrite:false});
  const r=new THREE.Mesh(new THREE.RingGeometry(.4,.55,48),mat);
  r.position.set(pos.x,.15,pos.z); r.rotation.x=-Math.PI/2; scene.add(r);
  addEffect(.7,function(dt){ this.age+=dt; const k=this.age/.7;
    r.scale.setScalar(.3+k*maxScale); mat.opacity=.95*(1-k); return k<1; },
    ()=>{scene.remove(r);mat.dispose();r.geometry.dispose();});
}
function beamMesh(pos,color,radius,height){
  const mat=new MeshBasicMaterial({color,transparent:true,opacity:0,blending:AdditiveBlending,depthWrite:false,side:DoubleSide});
  const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius*1.4,height,20,1,true),mat);
  m.position.set(pos.x,height/2+.2,pos.z); scene.add(m); return {m,mat};
}
function jagged(a,b,n,jitter){ const pts=[]; for(let i=0;i<=n;i++){ const t=i/n; const p=a.clone().lerp(b,t);
  if(i!==0&&i!==n){ p.x+=(Math.random()-.5)*jitter; p.y+=(Math.random()-.5)*jitter*.4; p.z+=(Math.random()-.5)*jitter; } pts.push(p);} return pts; }

// 单道分叉闪电（含核心+白芯+分叉+光柱+地面电弧）
function strikeBolt(bottom, scale=1){
  const top=new Vector3(bottom.x+(Math.random()-.5)*.6,15,bottom.z+(Math.random()-.5)*.4);
  const pts=jagged(top,bottom,9,.55*scale);
  // 地面爬行电弧
  for(let k=0;k<4;k++){
    const a=Math.random()*Math.PI*2, len=1+Math.random()*1.6;
    const g0=bottom.clone(); g0.y=.12;
    const g1=new Vector3(bottom.x+Math.cos(a)*len*.5,.1,bottom.z+Math.sin(a)*len*.5);
    const g2=new Vector3(bottom.x+Math.cos(a)*len,.08,bottom.z+Math.sin(a)*len);
    const gc=new THREE.CatmullRomCurve3([g0,g1,g2]);
    const gg=new THREE.TubeGeometry(gc,10,.025*scale,5,false);
    const gm=new MeshBasicMaterial({color:0xbfe6ff,transparent:true,opacity:.95,blending:AdditiveBlending,depthWrite:false});
    const gmsh=new THREE.Mesh(gg,gm); scene.add(gmsh);
    addEffect(.3,function(d){this.age+=d;gm.opacity=.95*(1-this.age/.3);return this.age<.3;},()=>{scene.remove(gmsh);gm.dispose();gg.dispose();});
  }
  [[.15,0x9fd0ff],[.06,0xffffff]].forEach(([radius,c],i)=>{
    const curve=new THREE.CatmullRomCurve3(pts);
    const geo=new THREE.TubeGeometry(curve,42,radius*scale,8,false);
    const mat=new MeshBasicMaterial({color:c,transparent:true,opacity:1,blending:AdditiveBlending,depthWrite:false});
    const mesh=new THREE.Mesh(geo,mat); scene.add(mesh);
    if(i===0){ for(let k=0;k<4;k++){ const bp=pts[2+Math.floor(Math.random()*5)].clone();
      const be=bp.clone(); be.x+=(Math.random()-.5)*2.6; be.y-=1+Math.random()*1.8; be.z+=(Math.random()-.5)*1.3;
      const bc=new THREE.CatmullRomCurve3(jagged(bp,be,4,.3));
      const bg=new THREE.TubeGeometry(bc,16,.035*scale,6,false);
      const bm=new MeshBasicMaterial({color:0x9fd0ff,transparent:true,opacity:.95,blending:AdditiveBlending,depthWrite:false});
      const bmsh=new THREE.Mesh(bg,bm); scene.add(bmsh);
      addEffect(.4,function(d){this.age+=d;bm.opacity=.95*(1-this.age/.4);return this.age<.4;},()=>{scene.remove(bmsh);bm.dispose();bg.dispose();});
    }}
    addEffect(.55,function(d){this.age+=d;mat.opacity=Math.max(0,1-this.age/.55);return this.age<.55;},()=>{scene.remove(mesh);mat.dispose();geo.dispose();});
  });
  burst(new Vector3(bottom.x,1.1,bottom.z),{color:gBolt,count:130,speed:[3,12],size:[.12,.36],life:[.3,.7],force:-1.5});
  // 地面冲击光圈已去除
  fxLight.position.set(bottom.x,6,bottom.z); fxLight.color.setHex(0xbfe6ff); fxLight.intensity=46;
}

function castLightning(target){
  const warnMat=new MeshBasicMaterial({color:0x9fd4ff,transparent:true,opacity:.9,side:DoubleSide,depthWrite:false,blending:AdditiveBlending});
  const warn=new THREE.Mesh(new THREE.RingGeometry(.5,.68,48),warnMat);
  warn.rotation.x=-Math.PI/2; warn.position.set(target.x,.05,target.z); scene.add(warn);
  // 伴随小雷：随机落点、随机延迟（不与主雷同时）
  const minis=[];
  for(let k=0;k<17;k++){
    const a=Math.random()*Math.PI*2, rad=.6+Math.random()*3.0;
    minis.push({t:.52+Math.random()*.92, x:target.x+Math.cos(a)*rad, z:target.z+Math.sin(a)*rad, s:.26+Math.random()*.36, done:false});
  }
  let mainDone=false;
  addEffect(1.45,function(dt){ this.age+=dt;
    if(!mainDone){ const k=Math.min(1,this.age/.5); warn.scale.setScalar(.4+k*.9); warnMat.opacity=.35+.5*Math.abs(Math.sin(this.age*22)); }
    if(this.age>=.5&&!mainDone){
      mainDone=true;
      strikeBolt(new Vector3(target.x,1.4,target.z),1.15);
      if(warn.parent){ scene.remove(warn); warnMat.dispose(); warn.geometry.dispose(); }
      screenFlash('#9fd4ff',.55); freeze(.07); shake(.9);
      if(Math.hypot(target.x-dummy.center.x,target.z-dummy.center.z)<1.2){
        damageEnemy(LIGHTNING_DMG,{color:'#bfe6ff'});
      }
    }
    // 小雷错时落下
    for(const m of minis){
      if(!m.done && this.age>=m.t){
        m.done=true;
        strikeBolt(new Vector3(m.x,1.4,m.z),m.s);
        shake(.12);
        if(Math.random()<.4) screenFlash('#9fd4ff',.09);
      }
    }
    return this.age<1.45;
  },()=>{ if(warn.parent){ scene.remove(warn); warnMat.dispose(); warn.geometry.dispose(); } });
}

function freezeDummy(t){
  dummy.frozen=t; dummy.mat.color.setHex(0x9fd0f2); dummy.mat.emissive.setHex(0x2a6fb0); dummy.mat.emissiveIntensity=.8;
}
function castIce(target){
  const onDummy=Math.hypot(target.x-dummy.center.x,target.z-dummy.center.z)<1.3;
  const N=22;
  // 落点冰霜贴片（缓慢扩散）
  const frostMat=new MeshBasicMaterial({color:0x9fe0ff,transparent:true,opacity:0,side:DoubleSide,depthWrite:false});
  const frost=new THREE.Mesh(new THREE.CircleGeometry(1,48),frostMat);
  frost.rotation.x=-Math.PI/2; frost.position.set(target.x,.06,target.z); frost.scale.setScalar(.01); scene.add(frost);
  for(let i=0;i<N;i++){
    const ang=(i/N)*Math.PI*2+Math.random()*.6;
    const rad=.1+Math.random()*1.5;
    const px=target.x+Math.cos(ang)*rad, pz=target.z+Math.sin(ang)*rad;
    const h=.2+Math.random()*.16, r=.012+Math.random()*.01;
    // 冰溜子：尖朝下的圆锥
    const mat=new MeshStandardMaterial({color:0xeafaff,emissive:0x8fd2ff,emissiveIntensity:1.3,roughness:.1,metalness:.3,transparent:true,opacity:1});
    const shard=new THREE.Mesh(new THREE.ConeGeometry(r,h,8),mat);
    shard.rotation.x=Math.PI; // 尖朝下
    shard.rotation.z=(Math.random()-.5)*.18;
    const fallDur=.42+Math.random()*.28;        // 下落节奏不变
    const startY=15+Math.random()*7;
    const landY=h/2-.05;
    shard.position.set(px,startY,pz); scene.add(shard);
    const wob=Math.random()*Math.PI*2;
    addEffect(fallDur+2.4,function(dt){ this.age+=dt;
      if(this.age<fallDur){
        const k=this.age/fallDur;
        const e=k*k; // 缓入：开始慢、越落越快
        shard.position.y=startY+(landY-startY)*e;
        shard.position.x=px;
        if(k>.85 && !this.hitFx){ this.hitFx=true;
          burst(new Vector3(px,.2,pz),{color:gIce,count:12,speed:[.8,3],size:[.06,.16],life:[.3,.7],force:2,max:40});
          fxLight.position.set(px,1.5,pz); fxLight.color.setHex(0xbfe8ff); fxLight.intensity=Math.max(fxLight.intensity,10);
        }
      } else {
        // 插在地上，轻微回弹后静止，再慢慢淡出
        const tk=(this.age-fallDur)/2.4;
        if(tk>1.4){ const f=THREE.MathUtils.clamp((tk-1.4)/1,0,1); mat.opacity=.92*(1-f); }
      }
      return this.age<fallDur+2.4;
    },()=>{scene.remove(shard);mat.dispose();shard.geometry.dispose();});
  }
  // 冰霜地面缓慢扩散（与下落同步，落地时铺满）
  addEffect(3.2,function(dt){ this.age+=dt;
    const g=1-Math.pow(1-Math.min(1,this.age/1.5),3);
    frost.scale.setScalar(.01+g*3.4); frostMat.opacity=.5*(1-Math.max(0,(this.age-2.6)/.6));
    if(this.age>1){
      // 持续少量寒气上飘
      if(Math.random()<dt*30) burst(new Vector3(target.x+(Math.random()-.5)*2.4,.2,target.z+(Math.random()-.5)*2.4),
        {color:gIce,count:1,speed:[.3,1],size:[.1,.24],life:[.8,1.5],force:1.2,max:20});
    }
    return this.age<3.2;
  },()=>{scene.remove(frost);frostMat.dispose();frost.geometry.dispose();});
  // 落地寒气中心爆（延迟到首批冰溜子落地）；重开后旧回调不再产出特效
  const castRun=runId;
  setTimeout(()=>{
    if(runId!==castRun) return;
    burst(new Vector3(target.x,.5,target.z),{color:gIce,count:90,speed:[1,5],size:[.14,.34],life:[.5,1.1],force:3.5,max:160});
    shockRing(new Vector3(target.x,0,target.z),0xbfeeff,3);
    screenFlash('#bfe8ff',.4); freeze(.06); shake(.35);
    if(gameState==='playing'&&!dummy.dead&&Math.hypot(target.x-dummy.center.x,target.z-dummy.center.z)<1.4){
      damageEnemy(ICE_DMG,{color:'#bfe8ff'});
    }
  },520);
  if(onDummy){ freezeDummy(3.4); }
}

function igniteDummy(){ burnP.em.visible=true; burnP.sys.restart(); }
function castMeteor(target){
  const grp=new Group();
  const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.5,1),new MeshStandardMaterial({color:0x422a1e,roughness:.9,emissive:0x7a2406,emissiveIntensity:.9}));
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.68,18,14),new MeshBasicMaterial({color:new Color(1.9,.85,.28),transparent:true,opacity:.8,blending:AdditiveBlending,depthWrite:false}));
  grp.add(rock,glow);
  const start=new Vector3(target.x-7,9,target.z+3);
  grp.position.copy(start); scene.add(grp);
  // 落点预警：红黑阴影圈 + 汇聚竖线
  const warnMat=new MeshBasicMaterial({color:0xff7a30,transparent:true,opacity:.85,side:DoubleSide,depthWrite:false,blending:AdditiveBlending});
  const warn=new THREE.Mesh(new THREE.RingGeometry(.7,1,48),warnMat);
  warn.rotation.x=-Math.PI/2; warn.position.set(target.x,.06,target.z); warn.scale.setScalar(.4); scene.add(warn);
  const tr=makeSystem({startLife:new IntervalValue(.35,.7),startSpeed:new IntervalValue(.5,1.6),startSize:new IntervalValue(.3,.62),
    emissionOverTime:new ConstantValue(280),shape:new SphereEmitter({radius:.3}),material:matFlame(),maxParticle:260,renderOrder:3},
    [new ColorOverLife(gEmber()),new SizeOverLife(grow())]);
  tr.em.visible=true; tr.sys.restart();
  const vel=target.clone().setY(1).sub(start).normalize().multiplyScalar(15);
  grp.add(new THREE.PointLight(0xff8a30,12,14,2));
  addEffect(3,function(dt){ this.age+=dt;
    grp.position.addScaledVector(vel,dt); rock.rotation.x+=dt*3; rock.rotation.y+=dt*2;
    tr.em.position.copy(grp.position);
    warnMat.opacity=.4+.5*Math.abs(Math.sin(this.age*20));
    warn.scale.setScalar(.4+this.age*1.6);
    if(grp.position.y<=1.1){
      const p=grp.position.clone(); p.y=1.5;
      spawnExplosion(p,3);
      burst(p,{color:gFire,count:180,speed:[3,13],size:[.2,.66],life:[.5,1.3],force:2,max:320});
      burst(new Vector3(p.x,.4,p.z),{color:gEmber,count:90,speed:[1,5],size:[.14,.34],life:[.8,1.8],force:5,max:200});
      shockRing(new Vector3(p.x,0,p.z),0xffa040,6);
      shockRing(new Vector3(p.x,0,p.z),0xffe0a0,3.4);
      // 焦痕
      const scorch=new THREE.Mesh(new THREE.CircleGeometry(2.4,40),new MeshBasicMaterial({color:0x120a06,transparent:true,opacity:.85,depthWrite:false}));
      scorch.rotation.x=-Math.PI/2; scorch.position.set(p.x,.05,p.z); scene.add(scorch);
      addEffect(6,function(d){this.age+=d; if(this.age>4.5)scorch.material.opacity=.85*(1-(this.age-4.5)/1.5); return this.age<6;},()=>{scene.remove(scorch);scorch.material.dispose();scorch.geometry.dispose();});
      if(warn.parent){ scene.remove(warn); warnMat.dispose(); warn.geometry.dispose(); }
      tr.sys.endEmit(); tr.em.visible=false;
      screenFlash('#ffb060',.8); freeze(.12); shake(1.25);
      if(gameState==='playing'&&!dummy.dead&&Math.hypot(p.x-dummy.center.x,p.z-dummy.center.z)<2.0){
        damageEnemy(METEOR_DMG,{color:'#ffd9a0',big:true,burn:3});
      }
      return false;
    }
    return true;
  },()=>{ scene.remove(grp); rock.geometry.dispose(); glow.geometry.dispose();
    if(warn.parent){ scene.remove(warn); warnMat.dispose(); warn.geometry.dispose(); }
    tr.sys.endEmit(); tr.em.visible=false;
    setTimeout(()=>{scene.remove(tr.em);tr.sys.dispose();},900); });
}

function castWater(target){
  const grp=new Group();
  const mat=new MeshStandardMaterial({color:0x7fd0ff,roughness:.12,metalness:.25,transparent:true,opacity:.92,emissive:0x2a8fd6,emissiveIntensity:1.1});
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.46,22,18),mat); grp.add(ball);
  const from=new Vector3(); hero.armFront.hand.getWorldPosition(from);
  grp.position.copy(from); scene.add(grp);
  const tr=makeSystem({startLife:new IntervalValue(.25,.45),startSpeed:new IntervalValue(.4,1.2),startSize:new IntervalValue(.2,.42),
    emissionOverTime:new ConstantValue(210),shape:new SphereEmitter({radius:.22}),maxParticle:220},
    [new ColorOverLife(gWater()),new SizeOverLife(grow())]);
  tr.em.visible=true; tr.sys.restart();
  const horiz=target.clone().setY(1.2).sub(from); horiz.y=0; const dist=horiz.length(); horiz.normalize();
  const flight=.85; const vx=horiz.multiplyScalar(dist/flight); let vy=6.5;
  const track=st.locked; // 锁定施放时追踪移动中的敌人
  st.fling=.42;
  addEffect(2,function(dt){ this.age+=dt; vy-=14*dt;
    if(track&&gameState==='playing'&&!dummy.dead){
      const rem=Math.max(.05,flight-this.age);
      vx.set(dummy.center.x-grp.position.x,0,dummy.center.z-grp.position.z).divideScalar(rem);
    }
    grp.position.addScaledVector(vx,dt); grp.position.y+=vy*dt;
    tr.em.position.copy(grp.position);
    if(grp.position.y<=1.2||this.age>flight){
      const p=grp.position.clone(); p.y=1.2;
      burst(p,{color:gWater,count:180,speed:[2,9],size:[.24,.62],life:[.5,1.0],force:4,max:320});
      burst(new Vector3(p.x,.2,p.z),{color:gWater,count:70,speed:[1,4],size:[.16,.4],life:[.4,.8],force:2,max:140});
      shockRing(new Vector3(p.x,0,p.z),0x8fd8ff,3.4);
      shockRing(new Vector3(p.x,0,p.z),0xcfeeff,2);
      fxLight.position.copy(p); fxLight.color.setHex(0x6fc4ff); fxLight.intensity=20;
      tr.sys.endEmit(); tr.em.visible=false;
      screenFlash('#8fd8ff',.4); freeze(.06); shake(.4);
      if(gameState==='playing'&&!dummy.dead&&Math.hypot(p.x-dummy.center.x,p.z-dummy.center.z)<1.4){
        damageEnemy(WATER_DMG,{color:'#cfeeff'});
      }
      return false;
    }
    return true;
  },()=>{scene.remove(grp);ball.geometry.dispose();mat.dispose();
    tr.sys.endEmit();tr.em.visible=false;
    setTimeout(()=>{scene.remove(tr.em);tr.sys.dispose();},700);});
}

const burnP=makeSystem({startLife:new IntervalValue(.5,.9),startSpeed:new IntervalValue(.4,1.2),startSize:new IntervalValue(.28,.55),
  emissionOverTime:new ConstantValue(90),shape:new ConeEmitter({radius:.18,angle:.4,thickness:1}),maxParticle:160},
  [new ColorOverLife(gFire()),new SizeOverLife(grow()),new ForceOverLife(new ConstantValue(0),new ConstantValue(2),new ConstantValue(0))]);
burnP.em.position.set(4.6,1.1,0); burnP.em.rotation.x=-Math.PI/2; burnP.em.visible=false; burnP.sys.endEmit();

const SKILLS=[
  {id:'fire',name:'火球',icon:'🔥',cd:0.9,color:'#ff9a3c',desc:'按住左键蓄力，松手射出；锁定敌人时追踪，满蓄暴击并点燃'},
  {id:'bolt',name:'天雷',icon:'⚡',cd:2.6,color:'#9fd4ff',desc:'瞄准点落下主雷，并错峰劈下 17 道小雷'},
  {id:'ice',name:'冰刺',icon:'❄️',cd:2.2,color:'#8fd0ff',desc:'22 根冰锥坠下，命中冻结敌人行动'},
  {id:'meteor',name:'陨星',icon:'☄️',cd:4.2,color:'#ffb05a',desc:'召唤陨星砸向落点，大范围爆炸并点燃'},
  {id:'water',name:'水弹',icon:'💧',cd:1.8,color:'#6fc4ff',desc:'抛物线高速水弹，出手快、落点激起大水花'}
];

// ===== 战斗数值 / 胜负状态 =====
const HERO_MAX=100, ENEMY_MAX=220;
const ARROW_DMG=12;
const FIRE_DMG_BASE=22, FIRE_DMG_CHARGE=40, FIRE_CRIT_MULT=1.6;
const LIGHTNING_DMG=40, ICE_DMG=18, METEOR_DMG=55, WATER_DMG=26, BURN_TICK=3;
let gameState='playing'; // playing | won | lost
let heroHp=HERO_MAX, enemyHp=ENEMY_MAX;
let runId=0, deathT=0, endTimer=0, burnAcc=0;
const _flashColor=new Color(0xff5533);

// ===== HUD =====
const heroHpFill=document.getElementById('hero-hp-fill'), heroHpNum=document.getElementById('hero-hp-num');
const enemyHud=document.getElementById('enemy-hud'), enemyHpFill=document.getElementById('enemy-hp-fill'),
  enemyHpNum=document.getElementById('enemy-hp-num'), enemyStatus=document.getElementById('enemy-status');
const skillDescEl=document.getElementById('skill-desc');
const overlayEl=document.getElementById('overlay'), endTitleEl=document.getElementById('end-title'),
  endTextEl=document.getElementById('end-text'), restartBtn=document.getElementById('restart-btn');
const _hudProj=new Vector3();
function updateHud(){
  heroHpFill.style.width=(heroHp/HERO_MAX*100)+'%';
  heroHpNum.textContent=Math.ceil(heroHp)+' / '+HERO_MAX;
  heroHpFill.parentElement.classList.toggle('low',heroHp<=HERO_MAX*0.35);
  enemyHpFill.style.width=(enemyHp/ENEMY_MAX*100)+'%';
  enemyHpNum.textContent=Math.ceil(enemyHp)+' / '+ENEMY_MAX;
  let stTxt='';
  if(dummy.frozen>0) stTxt='❄️ 冻结中';
  else if(dummy.burnUntil>performance.now()/1000) stTxt='🔥 燃烧中';
  enemyStatus.textContent=stTxt;
  enemyHud.classList.toggle('dead',enemyHp<=0);
}
// 敌人血条跟随其头顶（世界坐标投影）
function positionEnemyHud(){
  if(enemyHp<=0){ enemyHud.style.opacity=0; return; }
  _hudProj.set(dummy.center.x,2.45,dummy.center.z).project(camera);
  if(_hudProj.z>1){ enemyHud.style.opacity=0; return; }
  enemyHud.style.opacity=1;
  enemyHud.style.transform='translate('+((_hudProj.x*.5+.5)*window.innerWidth)+'px,'+((-_hudProj.y*.5+.5)*window.innerHeight)+'px) translate(-50%,-100%)';
}

function damageEnemy(amount,{color='#ffd9a0',burn=0,big=false,crit=false}={}){
  if(gameState!=='playing'||dummy.dead) return;
  amount=Math.max(1,Math.round(amount));
  enemyHp=Math.max(0,enemyHp-amount);
  popText(dummy.center.clone().setY(2.55),'-'+amount,color,big,crit);
  dummy.hitFlash=0.18;
  if(burn>0){
    const until=performance.now()/1000+burn;
    if(until>dummy.burnUntil){ dummy.burnUntil=until; igniteDummy(); }
  }
  updateHud();
  if(enemyHp<=0) killEnemy();
}
function damageHero(amount){
  if(gameState!=='playing') return;
  amount=Math.max(1,Math.round(amount));
  heroHp=Math.max(0,heroHp-amount);
  popText(new Vector3(hero.root.position.x,1.9,hero.root.position.z),'-'+amount,'#ff8a7a');
  screenFlash('#ff2a2a',.45);
  updateHud();
  if(heroHp<=0) killHero();
}
function killEnemy(){
  enemyHp=0; dummy.dead=true; dummy.ai.state='dead';
  dummy.burnUntil=0; burnP.sys.endEmit(); burnP.em.visible=false;
  dummy.frozen=0; dummy.hitFlash=0;
  dummy.mat.emissive.setHex(0x000000); dummy.mat.emissiveIntensity=0;
  dummy.group.traverse(o=>{ if(o.isSkinnedMesh&&o.material){
    const arr=Array.isArray(o.material)?o.material:[o.material];
    for(const m of arr){ if(m.emissive){ m.emissive.setHex(0x000000); m.emissiveIntensity=0; } }
  }});
  dummy.playDeath();
  deathT=0; endGame('won'); updateHud();
}
function killHero(){
  heroHp=0;
  if(st.mode==='charging'){ chargeP.sys.endEmit(); chargeP.em.visible=false; buttons[0].classList.remove('charging'); }
  st.mode='idle';
  for(const k in keys) keys[k]=false;
  hero.playDeath();
  deathT=0; endGame('lost'); updateHud();
}
function endGame(result){
  gameState=result;
  clearTimeout(endTimer);
  endTimer=setTimeout(()=>showOverlay(result),800); // 先演倒地，再弹结算
}
function showOverlay(result){
  endTitleEl.textContent=result==='won'?'胜 利':'阵 亡';
  endTitleEl.className=result;
  endTextEl.textContent=result==='won'
    ? '敌方弓手被击倒。按 R 或点击按钮再战一场。'
    : '你被敌箭击中。按 R 或点击按钮重新开始。';
  overlayEl.classList.add('show');
}
function hideOverlay(){ overlayEl.classList.remove('show'); }
function restart(){
  runId++;
  clearTimeout(endTimer); hideOverlay();
  gameState='playing'; heroHp=HERO_MAX; enemyHp=ENEMY_MAX; deathT=0; burnAcc=0;
  // 输入 / 施法状态
  for(const k in keys) keys[k]=false;
  spaceDown=false; gesture=false; controls.mouseButtons.LEFT=null;
  st.mode='idle'; st.charge=0; st.fling=0; st.flinch=0; st.locked=false;
  buttons[0].classList.remove('charging');
  chargeP.sys.endEmit(); chargeP.em.visible=false;
  // 玩家火球投射物与拖尾
  proj.active=false; fireball.visible=false;
  fireTrail.sys.endEmit(); fireTrail.em.visible=false;
  fireWrap.sys.endEmit(); fireWrap.em.visible=false;
  // 敌人箭矢
  for(const a of arrows) scene.remove(a.mesh);
  arrows.length=0;
  // 临时特效（闪电/冰锥/预警圈/焦痕/冲击波…）
  for(const e of effects){ try{ e.dispose&&e.dispose(); }catch(_){} }
  effects.length=0;
  burnP.sys.endEmit(); burnP.em.visible=false;
  // DOM 飘字 / 技能名
  document.querySelectorAll('.float-dmg').forEach(el=>el.remove());
  castName.classList.remove('show');
  // 角色与材质复位
  hero.reset(); dummy.reset();
  // 瞄准点、准星、镜头
  aimPoint.set(4.6,1.45,0); aimGround.set(4.6,0,0); ndc.set(.15,.1);
  updateAim();
  camera.position.set(4.2,4.05,12.4); controls.target.set(0,1.6,0);
  prevHeroPos.set(hero.root.position.x,0,hero.root.position.z);
  // 冷却遮罩 / 灯光 / 闪屏
  for(let i=0;i<SKILLS.length;i++){ cdLeft[i]=0; buttons[i].classList.remove('cooling'); }
  fxLight.intensity=0; chargeLight.intensity=0; flashPower=0; flashEl.style.opacity=0;
  updateHud();
}

let active=0; const cdLeft=SKILLS.map(()=>0);
const bar=document.getElementById('skillbar');
const castName=document.createElement('div'); castName.id='cast-name'; document.body.appendChild(castName);
const buttons=SKILLS.map((sk,i)=>{
  const b=document.createElement('button'); b.className='skill';
  b.innerHTML=`<span class="icon">${sk.icon}</span><span class="name">${sk.name}</span><span class="key">${i+1}</span><span class="cd-mask"></span>`;
  b.addEventListener('click',e=>{ e.stopPropagation(); if(gameState==='playing') select(i); b.blur(); });
  bar.appendChild(b); return b;
});
function select(i){ active=i;
  buttons.forEach((b,k)=>b.classList.toggle('equipped',k===i));
  const col=parseInt(SKILLS[i].color.slice(1),16);
  reticle.material.color.setHex(col); reticleDot.material.color.setHex(col);
  skillDescEl.innerHTML='<span style="color:'+SKILLS[i].color+'">'+SKILLS[i].icon+' '+SKILLS[i].name+'</span> · '+SKILLS[i].desc;
}
function flashCastName(name,color){ castName.textContent=name; castName.style.color=color;
  castName.classList.add('show'); clearTimeout(flashCastName._t); flashCastName._t=setTimeout(()=>castName.classList.remove('show'),650); }
restartBtn.addEventListener('click',e=>{ e.stopPropagation(); restart(); restartBtn.blur(); });
select(0);

const FULL=.95, MIN=.12;
const st={mode:'idle',t:0,charge:0,fling:0,locked:false,flinch:0};
const proj={active:false,pos:new Vector3(),prev:new Vector3(),vel:new Vector3(),power:0,life:0,homing:false};
const Z=new Vector3(0,0,1), backDir=new Vector3(), handWorld=new Vector3();

function startFire(){ if(gameState!=='playing')return; if(st.mode!=='idle'&&st.mode!=='lunge')return; st.mode='charging';st.charge=0;
  chargeP.em.visible=true;chargeP.sys.restart();buttons[0].classList.add('charging'); }
function releaseFire(){ if(st.mode!=='charging')return; const p=st.charge;
  chargeP.sys.endEmit();chargeP.em.visible=false;buttons[0].classList.remove('charging');
  st.mode='idle'; if(p<MIN)return; fireFireball(p); }
function fireFireball(p){
  hero.armFront.hand.getWorldPosition(handWorld);
  const tgt=st.locked?dummy.center:new Vector3(aimPoint.x,1.5,aimPoint.z);
  const dir=tgt.clone().sub(handWorld);dir.y=0;
  if(dir.lengthSq()<1e-4)dir.set(1,0,0); dir.normalize();
  proj.active=true;proj.power=p;proj.life=0;proj.homing=st.locked;proj.prev.copy(handWorld);
  proj.pos.copy(handWorld).addScaledVector(dir,.3);proj.vel.copy(dir).multiplyScalar(8+11*p);
  fireball.visible=true;fireball.position.copy(proj.pos);fireball.scale.setScalar(.42+p*.3);
  fireTrail.em.visible=true;fireTrail.sys.restart();fireWrap.em.visible=true;fireWrap.sys.restart();
  st.fling=.3;
}
function detonateFire(hit){
  const crit=proj.power>0.9;
  spawnExplosion(proj.pos.clone().setY(1.5),(crit?1.9:1.2)+proj.power*.7);
  fireTrail.sys.endEmit();fireTrail.em.visible=false;fireWrap.sys.endEmit();fireWrap.em.visible=false;
  fireball.visible=false;proj.active=false;
  screenFlash('#ffb060',crit?0.75:0.45); freeze(crit?0.1:0.06); shake(crit?1:0.55);
  if(hit){
    const dmg=Math.round(FIRE_DMG_BASE+FIRE_DMG_CHARGE*proj.power)*(crit?FIRE_CRIT_MULT:1);
    damageEnemy(dmg,{color:crit?'#fff0b0':'#ffd9a0',big:crit,burn:2.6,crit});
  } }
function segDist(a,b,p){ const abx=b.x-a.x,aby=b.y-a.y,abz=b.z-a.z; const l=abx*abx+aby*aby+abz*abz||1e-6;
  let t=((p.x-a.x)*abx+(p.y-a.y)*aby+(p.z-a.z)*abz)/l; t=Math.max(0,Math.min(1,t));
  return Math.hypot(p.x-(a.x+abx*t),p.y-(a.y+aby*t),p.z-(a.z+abz*t)); }

function castActive(){
  if(gameState!=='playing') return;
  const sk=SKILLS[active];
  if(active===0){ startFire(); return; }
  const tgt=st.locked?dummy.center.clone():new Vector3(aimPoint.x,1.45,aimPoint.z);
  flashCastName(sk.name,sk.color);
  if(active===1)castLightning(tgt);
  else if(active===2)castIce(tgt);
  else if(active===3)castMeteor(tgt);
  else if(active===4)castWater(tgt);
  st.fling=.3;
}

let spaceDown=false,gesture=false;
const keys={w:false,a:false,s:false,d:false,shift:false};
window.addEventListener('keydown',e=>{
  if(e.key>='1'&&e.key<='5'){ if(gameState==='playing') select(+e.key-1); return; }
  if((e.key==='r'||e.key==='R')&&gameState!=='playing'){ restart(); return; }
  if(e.code==='Space'){ e.preventDefault(); if(!spaceDown&&gameState==='playing'){spaceDown=true;controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;} }
  if(e.code==='ShiftLeft'||e.code==='ShiftRight') keys.shift=true;
  if(gameState!=='playing') return;
  const k=(e.code||'').replace('Key','').toLowerCase();
  if(k in keys && k!=='shift'){ keys[k]=(e.code==='KeyW'||e.code==='KeyA'||e.code==='KeyS'||e.code==='KeyD'); }
});
window.addEventListener('keyup',e=>{
  if(e.code==='Space'){spaceDown=false;controls.mouseButtons.LEFT=null;}
  if(e.code==='ShiftLeft'||e.code==='ShiftRight') keys.shift=false;
  if(e.code.startsWith('Key')){ const k=e.code.slice(3).toLowerCase(); if(k in keys) keys[k]=false; }
});
canvas.addEventListener('pointerdown',e=>{ if(e.button!==0)return;
  if(spaceDown||gameState!=='playing'){gesture=false;return;} gesture=true; castActive(); });
window.addEventListener('pointerup',e=>{ if(e.button!==0)return; if(gesture){gesture=false;if(active===0)releaseFire();} });

const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),.42,.34,.9);
composer.addPass(bloom); composer.addPass(new OutputPass());
let loaded=false; function finishLoad(){if(!loaded){loaded=true;document.getElementById('loading').classList.add('hide');}}
setTimeout(finishLoad,2500);

let dt=0; const damp=(a,b,k)=>a+(b-a)*Math.min(1,k*dt);
function poseArm(a,sz,ez){a.shoulder.rotation.z=damp(a.shoulder.rotation.z,sz,14);a.elbow.rotation.z=damp(a.elbow.rotation.z,ez,14);}

// ---- 移动输入（相对镜头朝向）----
const moveTmp=new THREE.Vector3(), camForward=new THREE.Vector3(), camRight=new THREE.Vector3();
let walkPhase=Math.random()*6, faceDir=1, moveAmtRaw=0;
function readMove(){
  camForward.set(camera.position.x-controls.target.x,0,camera.position.z-controls.target.z).normalize().negate();
  camRight.set(-camForward.z,0,camForward.x);
  moveTmp.set(0,0,0);
  if(keys.w)moveTmp.add(camForward);
  if(keys.s)moveTmp.sub(camForward);
  if(keys.d)moveTmp.add(camRight);
  if(keys.a)moveTmp.sub(camRight);
  moveAmtRaw=Math.min(1,moveTmp.length());
}
function applyMove(dt){
  if(gameState==='playing' && moveAmtRaw>0.01 && st.mode!=='charging'){
    moveTmp.normalize();
    const sp=keys.shift?6.2:3.8;
    hero.root.position.x=THREE.MathUtils.clamp(hero.root.position.x+moveTmp.x*sp*dt,-10,10);
    hero.root.position.z=THREE.MathUtils.clamp(hero.root.position.z+moveTmp.z*sp*dt,-7,7);
  }
}
let idleT=0;
function updateHero(dt){
  if(gameState!=='playing'){
    // 结算后：停止瞄准/移动/施法，蓄力残留快速消散
    st.locked=false;
    hero.chargeOrb.scale.lerp(new Vector3(.001,.001,.001),Math.min(1,dt*14));
    chargeLight.intensity*=Math.exp(-dt*10);
    return;
  }
  st.locked=updateAim();
  let c=0;
  if(st.mode==='charging')c=THREE.MathUtils.clamp(st.charge/FULL,0,1);
  if(st.flinch>0)st.flinch=Math.max(0,st.flinch-dt);
  readMove(); applyMove(dt);
  const moving=(moveAmtRaw>0.01 && st.mode!=='charging')?moveTmp.clone():null;
  // 瞄准方向：英雄 -> 鼠标落点
  const aimDir=new Vector3(aimPoint.x-hero.root.position.x,0,aimPoint.z-hero.root.position.z);
  if(aimDir.lengthSq()<1e-4) aimDir.set(1,0,0); aimDir.normalize();
  // Soldier 骨骼动画：Idle/Walk/Run + 朝向（移动时朝移动方向，否则朝鼠标）+ 受击
  hero.tick(dt, moving, { flinch: st.flinch||0, aimDir });
  if(st.fling>0)st.fling=Math.max(0,st.fling-dt);
  if(st.mode==='charging'){
    const pulse=1+Math.sin(performance.now()*.02)*.06;
    hero.chargeOrb.scale.setScalar((.001+c*.95)*pulse);
    hero.chargeOrb.material.opacity=.3+c*.6;
    hero.armFront.hand.getWorldPosition(handWorld);
    chargeLight.position.copy(handWorld);
    chargeLight.intensity=1+c*7; st.charge=Math.min(FULL,st.charge+dt);
  } else {
    hero.chargeOrb.scale.lerp(new Vector3(.001,.001,.001),Math.min(1,dt*14));
    hero.chargeOrb.material.opacity+=(0-hero.chargeOrb.material.opacity)*Math.min(1,dt*14);
    chargeLight.intensity*=Math.exp(-dt*10);
  }
}

// 镜头跟随英雄位移（delta 同步给相机与目标，保留旋转/缩放）
const prevHeroPos=new THREE.Vector3(hero.root.position.x,0,hero.root.position.z);
const heroDelta=new THREE.Vector3(), shakeOffset=new THREE.Vector3();
function cameraControls(){
  heroDelta.set(hero.root.position.x,0,hero.root.position.z).sub(prevHeroPos);
  if(heroDelta.lengthSq()>1e-9){ camera.position.add(heroDelta); controls.target.add(heroDelta); }
  prevHeroPos.set(hero.root.position.x,0,hero.root.position.z);
  if(shakeAmt>.001){
    shakeOffset.set((Math.random()-.5)*shakeAmt*.5,(Math.random()-.5)*shakeAmt*.35,(Math.random()-.5)*shakeAmt*.5);
    camera.position.add(shakeOffset); controls.target.add(shakeOffset);
    controls.update();
    camera.position.sub(shakeOffset); controls.target.sub(shakeOffset);
    shakeAmt*=Math.exp(-dt*7);
  } else controls.update();
}

const _home=new Vector3(), _homeDir=new Vector3();
function updateFireball(){
  if(!proj.active)return; proj.life+=dt;proj.prev.copy(proj.pos);
  if(proj.homing){
    _home.copy(dummy.center); _home.y=proj.pos.y;
    _homeDir.copy(_home).sub(proj.pos).normalize();
    const sp=proj.vel.length();
    proj.vel.lerp(_homeDir.multiplyScalar(sp),Math.min(1,dt*3.2)).normalize().multiplyScalar(sp);
  }
  proj.pos.addScaledVector(proj.vel,dt);
  fireball.position.copy(proj.pos);fireTrail.em.position.copy(proj.pos);fireWrap.em.position.copy(proj.pos);
  backDir.copy(proj.vel).normalize().negate();fireTrail.em.quaternion.setFromUnitVectors(Z,backDir);
  if(segDist(proj.prev,proj.pos,dummy.center)<.6){detonateFire(true);return;}
  if(proj.life>2.4||proj.pos.distanceTo(new Vector3(aimPoint.x,1.5,aimPoint.z))<.3)detonateFire(false);
}

const BASE_TARGET=new Vector3(0,1.6,0);
const clock=new THREE.Clock();
let timeScale=1, simElapsed=0;
// 单步仿真（dt 已被外层切成 <=.033 的子步，慢帧/加速时弹道与碰撞不穿透）
function simFrame(raw){
  dt=raw; const now=simElapsed;
  updateHero(dt); updateFireball(); updateEnemy(dt); updateArrows(dt);
  // 死亡倒地：绕侧向轴躺平（mixer 已停），不再攻击/移动
  if(dummy.dead){ deathT+=dt; const k=Math.min(1,deathT/0.55); dummy.group.rotation.z=-k*Math.PI/2*0.98; }
  else if(gameState==='lost'){ deathT+=dt; const k=Math.min(1,deathT/0.55); hero.root.rotation.z=k*Math.PI/2*0.98; }
  cameraControls();
  for(let i=0;i<SKILLS.length;i++){ if(cdLeft[i]>0){ cdLeft[i]=Math.max(0,cdLeft[i]-dt);
    buttons[i].querySelector('.cd-mask').style.setProperty('--p',((1-cdLeft[i]/SKILLS[i].cd)*100)+'%');
    buttons[i].classList.toggle('cooling',cdLeft[i]>0); } }
  const nowMs=performance.now()/1000;
  if(!dummy.dead){
    const burning=dummy.burnUntil>nowMs;
    if(burning) dummy.group.rotation.z=Math.sin(now*28)*.04;
    else { if(dummy.burnUntil>0){ burnP.sys.endEmit(); burnP.em.visible=false; dummy.burnUntil=0; } dummy.group.rotation.z*=.9; burnAcc=0; }
    if(dummy.frozen>0) dummy.frozen=Math.max(0,dummy.frozen-dt);
    if(dummy.hitFlash>0) dummy.hitFlash=Math.max(0,dummy.hitFlash-dt);
    // 自发光合成：冻结蓝 / 燃烧橙，受击瞬间红白闪覆盖
    if(dummy.frozen>0){ dummy.mat.emissive.setHex(0x2a6fb0); dummy.mat.emissiveIntensity=.8; }
    else if(burning){ dummy.mat.emissive.setHex(0x7a2a08); dummy.mat.emissiveIntensity=.55; }
    else { dummy.mat.emissive.setHex(0x000000); dummy.mat.emissiveIntensity=0; }
    const f=THREE.MathUtils.clamp(dummy.hitFlash/0.18,0,1);
    if(f>0){ dummy.mat.emissive.lerp(_flashColor,f); dummy.mat.emissiveIntensity=Math.max(dummy.mat.emissiveIntensity,1.25*f); }
    // 燃烧粒子跟随敌人（敌人会游走），每 0.5s 一跳持续伤害
    if(burning){
      burnP.em.position.set(dummy.center.x,1.1,dummy.center.z);
      burnAcc+=dt;
      if(burnAcc>=0.5){ burnAcc=0; damageEnemy(BURN_TICK,{color:'#ff9a4c'}); }
    }
  }
  // 敌人状态文字（冻结/燃烧），变化时才写 DOM
  const stTxt=dummy.dead?'':(dummy.frozen>0?'❄️ 冻结中':(dummy.burnUntil>nowMs?'🔥 燃烧中':''));
  if(stTxt!==enemyStatus._last){ enemyStatus._last=stTxt; enemyStatus.textContent=stTxt; }
  positionEnemyHud();

  fxLight.intensity*=Math.exp(-dt*6);
  for(let i=effects.length-1;i>=0;i--){ const e=effects[i]; if(!e.update(dt)){ e.dispose&&e.dispose(); effects.splice(i,1);} }
  if(flashPower>0.001){ flashEl.style.background='radial-gradient(circle, rgba('+flashColor+','+flashPower*.9+') 0%, rgba('+flashColor+','+flashPower*.25+') 55%, rgba('+flashColor+',0) 100%)'; flashEl.style.opacity=1; flashPower*=Math.exp(-raw*5.2); }
  else { flashEl.style.opacity=0; }
  batch.update(dt);
}
function animate(){
  requestAnimationFrame(animate);
  let raw=Math.min(clock.getDelta()*timeScale,.4);
  if(hitStop>0){ hitStop-=raw; raw*=.12; }
  const steps=Math.max(1,Math.ceil(raw/.033));
  const h=raw/steps;
  for(let i=0;i<steps;i++){ simElapsed+=h; simFrame(h); }
  composer.render();
}
animate();
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);composer.setSize(window.innerWidth,window.innerHeight);});

window.__dbg={st,proj,dummy,effects,
  get arrows(){return arrows;},
  get state(){return gameState;},
  get heroHp(){return heroHp;},
  get enemyHp(){return enemyHp;},
  heroMax:HERO_MAX, enemyMax:ENEMY_MAX,
  ready:()=>!!(hero.actor&&dummy.actorRef),
  // 验收用仿真倍率（固定子步，倍率下逻辑与正常帧率等价）
  setTimeScale(v){ timeScale=Math.max(.1,Math.min(12,Number(v)||1)); },
  get timeScale(){ return timeScale; },
  snapshot(){ return {
    state:gameState, heroHp:Math.ceil(heroHp), enemyHp:Math.ceil(enemyHp), heroMax:HERO_MAX, enemyMax:ENEMY_MAX,
    arrows:arrows.length, projActive:!!proj.active, effects:effects.length,
    frozen:dummy.frozen>0, burning:dummy.burnUntil>performance.now()/1000,
    skill:SKILLS[active].id, overlayShown:overlayEl.classList.contains('show')
  };},
  restart,
  damageEnemy:n=>damageEnemy(n),
  damageHero:n=>damageHero(n),
  killEnemy:()=>killEnemy(),
  killHero:()=>killHero(),
  enemyShootNow:()=>enemyShoot(),
  // 自动验收用：蓄力火球（默认满蓄、锁定敌人）
  castFire(p=1){ if(gameState!=='playing')return; select(0);
    st.locked=true; aimPoint.copy(dummy.center); aimGround.set(dummy.center.x,0,dummy.center.z);
    startFire(); st.charge=FULL*p; releaseFire(); },
  // 自动验收用：把落点直接放到敌人身上并施放（0=满蓄火球）
  castAtEnemy(i){
    if(gameState!=='playing')return;
    st.locked=true; aimPoint.copy(dummy.center); aimGround.set(dummy.center.x,0,dummy.center.z);
    select(i);
    if(i===0){ startFire(); st.charge=FULL; releaseFire(); } else castActive();
  },
  cast:(i)=>{ if(gameState!=='playing')return; select(i);castActive();},
  releaseFire,
  aimDummy(){const v=dummy.center.clone().project(camera);ndc.set(v.x,v.y);},
  heroPos:()=>({x:hero.root.position.x,z:hero.root.position.z}),
  bowPose(){
    const a=dummy.actorRef; if(!a) return {loaded:false};
    const wp=b=>{const v=new THREE.Vector3();b.getWorldPosition(v);return [+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(2)];};
    const bw=new THREE.Vector3(); dummy.bowWorld(bw);
    return {draw:+dummy.ai.draw.toFixed(2),state:dummy.ai.state,
      L:wp(a.arm.L.hand),R:wp(a.arm.R.hand),bow:[+bw.x.toFixed(2),+bw.y.toFixed(2),+bw.z.toFixed(2)],
      lsx:+a.arm.L.shoulder.rotation.x.toFixed(2),rsx:+a.arm.R.shoulder.rotation.x.toFixed(2)};
  },
  enemyRig(){
    const a=dummy.actorRef; if(!a) return {loaded:false};
    const g=new THREE.Group();
    const wp=(bone)=>{ const v=new THREE.Vector3(); bone.getWorldPosition(v); return [+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(2)]; };
    const wp2=b=>{ const v=new THREE.Vector3(); b.getWorldPosition(v); return [+v.x.toFixed(2),+v.y.toFixed(2),+v.z.toFixed(2)]; };
    const bow=dummy.bowWorld(new THREE.Vector3()).toArray().map(v=>+v.toFixed(2));
    return {loaded:true,groupY:+dummy.group.position.y.toFixed(2),yaw:+dummy.group.rotation.y.toFixed(2),
      L:wp2(a.handL),R:wp2(a.handR),bow};
  },
  arrowProbe(){
    if(arrows.length===0) return {n:0,hero:hero.root.position.x.toFixed(1)};
    const a=arrows[arrows.length-1];
    const hx=hero.root.position.x, hz=hero.root.position.z;
    return {n:arrows.length,x:+a.mesh.position.x.toFixed(2),y:+a.mesh.position.y.toFixed(2),z:+a.mesh.position.z.toFixed(2),
      dx:+Math.abs(a.mesh.position.x-hx).toFixed(2),dz:+Math.abs(a.mesh.position.z-hz).toFixed(2),vx:+a.vel.x.toFixed(2),vy:+a.vel.y.toFixed(2),
      hx:+hx.toFixed(1),bow:dummy.bowWorld(new Vector3()).toArray().map(v=>+v.toFixed(2))};
  },
  fireDebug(){
    const hw=new THREE.Vector3(); hero.armFront.hand.getWorldPosition(hw);
    return {hand:[+hw.x.toFixed(2),+hw.y.toFixed(2),+hw.z.toFixed(2)],
      locked:st.locked, aim:[+aimPoint.x.toFixed(2),+aimPoint.z.toFixed(2)],
      dummy:[+dummy.center.x.toFixed(2),+dummy.center.z.toFixed(2)],
      proj:proj.active?[+proj.pos.x.toFixed(2),+proj.pos.y.toFixed(2),+proj.pos.z.toFixed(2)]:null,
      homing:proj.homing, heroY:+hero.root.rotation.y.toFixed(2)};
  },
  heroAnim(){ const a=hero.actor;
    if(!a) return {loaded:false};
    return {loaded:true,cur:a.curName,envI:scene.environmentIntensity,yaw:+a.group.rotation.y.toFixed(2)};
  },
  heroBBox(){ const box=new THREE.Box3(); let skinned=0;
    hero.root.traverse(o=>{ if(o.isSkinnedMesh){skinned++; box.expandByObject(o);} });
    const c=box.getCenter(new THREE.Vector3()); const sz=box.getSize(new THREE.Vector3());
    const vis=[]; hero.root.children.forEach(ch=>vis.push(ch.type));
    return {skinned,min:[+box.min.x.toFixed(2),+box.min.y.toFixed(2),+box.min.z.toFixed(2)],max:[+box.max.x.toFixed(2),+box.max.y.toFixed(2),+box.max.z.toFixed(2)],size:[+sz.x.toFixed(2),+sz.y.toFixed(2),+sz.z.toFixed(2)],rootYaw:+hero.root.rotation.y.toFixed(2),children:vis};
  },
  poseY(){
    const d=dummy,r=d.group.userData.rig;
    const hp=new Vector3(),hf=new Vector3(),hb=new Vector3(),wp=new Vector3();
    r.head.getWorldPosition(hp); r.armFront.hand.getWorldPosition(hf); r.armBack.hand.getWorldPosition(hb); d.weapon.getWorldPosition(wp);
    return {head:+hp.y.toFixed(2),front:+hf.y.toFixed(2),back:+hb.y.toFixed(2),weapon:+wp.y.toFixed(2)};
  },
  bowMeasure(){
    const d=dummy,r=d.group.userData.rig;
    const grip=new Vector3(); d.weapon.getWorldPosition(grip);
    const sw=new Vector3(-.06-d.ai.draw*.18,0,0).applyMatrix4(d.weapon.matrixWorld);
    const hf=new Vector3(),hb=new Vector3();
    r.armFront.hand.getWorldPosition(hf); r.armBack.hand.getWorldPosition(hb);
    return {draw:+d.ai.draw.toFixed(2),state:d.ai.state,fg:+hf.distanceTo(grip).toFixed(3),bg:+hb.distanceTo(sw).toFixed(3)};
  } };

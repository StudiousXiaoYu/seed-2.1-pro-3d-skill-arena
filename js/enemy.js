// 敌人弓手：官方 Soldier 第二实例（model 只挂一次），兼容旧 dummy 接口
import * as THREE from 'three';
import { createActorContainer, populateActor } from './actors.js';

function fakePart(){ return { rotation:new THREE.Euler(), position:new THREE.Vector3(), add(){} }; }
const _wpos=new THREE.Vector3(), _hpos=new THREE.Vector3(), _heroW=new THREE.Vector3();

export function createEnemyShell(scene, startPos){
  const group=createActorContainer(scene,startPos);

  const mat=new THREE.MeshStandardMaterial({color:0xc77b4a,roughness:.8,emissive:new THREE.Color(0,0,0),emissiveIntensity:0});

  // 弓（挂左手骨）
  const weapon=new THREE.Group();
  const bowMat=new THREE.MeshStandardMaterial({color:0xd8b078,roughness:.6});
  const bow=new THREE.Mesh(new THREE.TorusGeometry(.4,.03,10,28,Math.PI*.92),bowMat);
  bow.rotation.z=-Math.PI/2-Math.PI*.46; bow.castShadow=true; weapon.add(bow);
  const stringGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.4,0),new THREE.Vector3(-.06,0,0),new THREE.Vector3(0,-.4,0)]);
  const string=new THREE.Line(stringGeo,new THREE.LineBasicMaterial({color:0xf0e6d0})); weapon.add(string);

  const armFront={shoulder:fakePart(),elbow:fakePart(),hand:fakePart()};
  const armBack ={shoulder:fakePart(),elbow:fakePart(),hand:fakePart()};
  const legFront={hip:fakePart(),knee:fakePart(),ankle:fakePart()};
  const legBack ={hip:fakePart(),knee:fakePart(),ankle:fakePart()};
  group.userData.rig={body:group,pelvis:group,chest:group,head:null,armFront,armBack,legFront,legBack};

  let actor=null;
  const center=new THREE.Vector3(startPos.x,1.5,startPos.z);

  group.add(weapon);
  populateActor(group,{ facing:new THREE.Vector3(-1,0,0), mirror:false }).then(a=>{
    actor=a;
  }).catch(err=>console.error('enemy soldier load fail',err));

  let aimYaw=Math.atan2(-1,0);
  const START=startPos?startPos.clone():new THREE.Vector3(4.6,0,0);
  return {
    group, mat, baseColor:0xc77b4a, weapon, string,
    armFront, armBack, legFront, legBack, body:group, head:null,
    center, walkPhase:0, frozen:0, burnUntil:0, justShot:0, hitFlash:0, dead:false,
    // grace：出生/重开后先原地 Idle 几秒，给玩家反应时间
    ai:{state:'wander',t:0,grace:3,target:new THREE.Vector3(startPos.x,0,startPos.z),draw:0,hasShot:false},
    // 重开：位置/AI/材质/弓弦全部复位
    reset(){
      this.dead=false; this.frozen=0; this.burnUntil=0; this.justShot=0; this.hitFlash=0;
      this.ai.state='wander'; this.ai.t=0; this.ai.draw=0; this.ai.hasShot=false; this.ai.grace=3;
      this.ai.target.copy(START);
      this.group.position.copy(START); this.group.position.y=0;
      this.group.rotation.set(0,Math.atan2(1,0),0); aimYaw=Math.atan2(1,0);
      this.center.set(START.x,1.5,START.z);
      this.mat.color.setHex(this.baseColor);
      this.mat.emissive.setHex(0x000000); this.mat.emissiveIntensity=0;
      this.group.traverse(o=>{ if(o.isSkinnedMesh&&o.material){
        const arr=Array.isArray(o.material)?o.material:[o.material];
        for(const m of arr){ if(m.emissive){ m.emissive.setHex(0x000000); m.emissiveIntensity=0; } }
      }});
      weapon.visible=false;
      this.string.geometry.setFromPoints([new THREE.Vector3(0,.4,0),new THREE.Vector3(-.06,0,0),new THREE.Vector3(0,-.4,0)]);
      if(actor){ actor.resetPose(); actor.setFacing(new THREE.Vector3(-1,0,0)); }
    },
    playDeath(){ if(actor) actor.stopAnims(); weapon.visible=false; },
    tick(dt,moveInput,draw,faceDir,heroPos){
      if(!actor) return;
      const speed=moveInput?Math.min(1,moveInput.length()):0;
      actor.update(dt,speed);
      actor.aimBow(draw); // 拉弓时双臂抬起（持弓+拉弦）
      weapon.visible=draw>0.02;
      if(actor.arm&&actor.arm.L.hand){
        // 手骨是世界坐标，weapon 挂在 group 下，必须先转到 group 局部（旧代码直接 copy 导致弓飘到 4 米外）
        actor.arm.L.hand.getWorldPosition(_hpos);
        group.worldToLocal(_hpos);
        weapon.position.copy(_hpos); weapon.position.y+=0.05;
        weapon.rotation.set(0,0,0);
      }
      if(faceDir&&faceDir.lengthSq&&faceDir.lengthSq()>1e-6){
        const want=Math.atan2(-faceDir.x,-faceDir.z);
        let d=want-aimYaw; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
        aimYaw+=d*Math.min(1,dt*8); group.rotation.y=aimYaw;
      }
      const pull=draw*.18;
      string.geometry.setFromPoints([new THREE.Vector3(0,.4,0),new THREE.Vector3(-.06+pull,0,0),new THREE.Vector3(0,-.4,0)]);
      group.traverse(o=>{ if(o.isSkinnedMesh&&o.material){
        const arr=Array.isArray(o.material)?o.material:[o.material];
        for(const m of arr){ if(m.emissive){ m.emissive.copy(mat.emissive); m.emissiveIntensity=mat.emissiveIntensity; } }
      }});
    },
    bowWorld(v){ if(actor) weapon.getWorldPosition(v); else v.copy(group.position).setY(1.5); return v; },
    get actorRef(){ return actor; }
  };
}

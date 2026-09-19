// 英雄：同步外壳 + 异步填充官方 Soldier（model 只挂一次）
import * as THREE from 'three';
import { createActorContainer, populateActor } from './actors.js';

export function createHeroShell(scene, startPos) {
  const group = createActorContainer(scene, startPos);

  function fakePart(){ return { rotation:new THREE.Euler(), position:new THREE.Vector3(), add(){} }; }
  function handOf(side){
    return {
      getWorldPosition(v){ if(actor&&actor.handR) return actor.handWorld(v,side); return v.copy(group.position).setY(1.4); },
      getWorldQuaternion(q){ const b=actor?(side==='R'?actor.handR:actor.handL):null; if(b)return b.getWorldQuaternion(q); return q.identity(); },
      add(o){ pending.push([o,side]); if(actor) actor.attachTo(o,side); }
    };
  }
  const armFront={ shoulder:fakePart(), elbow:fakePart(), hand:handOf('R') };
  const armBack ={ shoulder:fakePart(), elbow:fakePart(), hand:handOf('L') };
  const legFront={ hip:fakePart(), knee:fakePart(), ankle:fakePart() };
  const legBack ={ hip:fakePart(), knee:fakePart(), ankle:fakePart() };

  const chargeOrb=new THREE.Mesh(
    new THREE.SphereGeometry(0.16,20,16),
    new THREE.MeshBasicMaterial({color:new THREE.Color(1.15,.55,.16),transparent:true,opacity:0}));
  chargeOrb.scale.setScalar(0.001);
  const pending=[[chargeOrb,'R']];

  let actor=null, aimYaw=null, spinV=0;
  populateActor(group,{ facing:new THREE.Vector3(1,0,0), mirror:false }).then(a=>{
    actor=a; pending.forEach(([o,s])=>a.attachTo(o,s));
  }).catch(e=>console.error('soldier load fail',e));

  const _f=new THREE.Vector3();
  const START=startPos?startPos.clone():new THREE.Vector3(-4.6,0,0);
  return {
    get actor(){ return actor; },
    group, root:group, body:group, head:null,
    armFront, armBack, legFront, legBack, chargeOrb,
    // 重开：位置/朝向/蓄力姿态全部回到初始
    reset(){
      aimYaw=null; spinV=0;
      group.position.copy(START); group.position.y=0;
      group.rotation.set(0,Math.atan2(-1,0),0);
      chargeOrb.scale.setScalar(0.001); chargeOrb.material.opacity=0;
      if(actor){ actor.resetPose(); }
    },
    // 死亡倒地（绕侧轴躺平，mixer 停在最后姿态）
    playDeath(){ if(actor) actor.stopAnims(); },
    tick(dt, moveInput, opts={}){
      if(!actor) return;
      const speed=moveInput?Math.min(1,moveInput.length()):0;
      actor.update(dt,speed);
      // 移动时脸朝移动方向；静止/蓄力时才朝鼠标瞄准
      if(speed>0.02){ _f.set(moveInput.x,0,moveInput.z); if(_f.lengthSq()>1e-6) aimYaw=Math.atan2(-_f.x,-_f.z); }
      else if(opts.aimDir) aimYaw=Math.atan2(-opts.aimDir.x,-opts.aimDir.z);
      if(aimYaw!==null){ let d=aimYaw-group.rotation.y;
        while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
        group.rotation.y+=d*Math.min(1,dt*10); }
      if(opts.flinch>0) spinV=Math.max(spinV,opts.flinch);
      if(spinV>0.001){ group.rotation.z=Math.sin((spinV/0.3)*Math.PI)*0.1; spinV-=dt; }
      else group.rotation.z*=Math.exp(-dt*10);
    }
  };
}

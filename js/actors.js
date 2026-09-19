// 官方 Soldier.glb 角色容器（参考 webgl_animation_walk）：model 只挂一次，避免 reparent 破坏蒙皮绑定
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

let cache = null;
const _wp = new THREE.Vector3();
function loadGLB() {
  if (!cache) cache = new GLTFLoader().loadAsync('./models/Soldier.glb');
  return cache;
}

// 创建一个同步可用的角色组（动画/骨骼随后填充）
export function createActorContainer(scene, position) {
  const group = new THREE.Group();
  if (position) group.position.copy(position);
  scene.add(group);
  return group;
}

// 把 Soldier 蒙皮模型填充进给定 group（model 只挂这一次）
export async function populateActor(group, { facing = new THREE.Vector3(1,0,0), mirror = false, scaleTo = 1.85 } = {}) {
  const gltf = await loadGLB();
  const model = cloneSkinned(gltf.scene);
  group.add(model);
  group.updateWorldMatrix(true,true);
  // 用骨骼关节世界坐标算身高/脚底（蒙皮网格首帧包围盒会退化，不能用 setFromObject）
  let minY=Infinity,maxY=-Infinity;
  model.traverse(o=>{ if(o.isBone){ const wy=o.getWorldPosition(_wp).y; if(wy<minY)minY=wy; if(wy>maxY)maxY=wy; }});
  let height=(maxY-minY);
  if(!isFinite(height)||height<0.5||height>4) height=1.83;
  const s=scaleTo/height;
  model.scale.multiplyScalar(s);
  model.position.y -= minY*s;
  if(mirror) model.scale.x = -model.scale.x; // 缩放/贴地后再镜像
  group.updateWorldMatrix(true,true);
  group.rotation.y=Math.atan2(-facing.x,-facing.z);

  model.traverse(o => { if (o.isMesh) o.castShadow = true; });

  const mixer = new THREE.AnimationMixer(model);
  const clips = Object.fromEntries(gltf.animations.map(a => [a.name, a]));
  const make = n => clips[n] ? mixer.clipAction(clips[n]) : null;
  const actions = { Idle: make('Idle'), Walk: make('Walk'), Run: make('Run') };
  for (const k in actions) {
    if (actions[k]) { actions[k].enabled = true; actions[k].setEffectiveWeight(k === 'Idle' ? 1 : 0); actions[k].play(); }
  }

  const bones = {};
  model.traverse(o => { if (o.isBone) bones[o.name] = o; });
  const LHand = bones['mixamorigLeftHand'], RHand = bones['mixamorigRightHand'];
  const arm = {
    L: { shoulder: bones['mixamorigLeftArm'], elbow: bones['mixamorigLeftForeArm'], hand: LHand },
    R: { shoulder: bones['mixamorigRightArm'], elbow: bones['mixamorigRightForeArm'], hand: RHand }
  };

  let cur = 'Idle', moveAmt = 0;
  const _qc=new THREE.Quaternion(),_qa=new THREE.Quaternion(),_ae=new THREE.Euler();
  const fade = 0.25;
  function setAction(name) {
    if (cur === name || !actions[name]) return;
    const next = actions[name], old = actions[cur];
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    old.fadeOut(fade);
    cur = name;
  }

  const api = {
    group, model, mixer, bones, handL: LHand, handR: RHand, arm,
    get curName() { return cur; },
    update(dt, moveSpeed = 0) {
      moveAmt += (Math.min(1, moveSpeed) - moveAmt) * Math.min(1, dt * 12);
      const name = moveAmt > 0.62 ? 'Run' : moveAmt > 0.05 ? 'Walk' : 'Idle';
      setAction(name);
      mixer.update(dt);
    },
    setFacing(dir) { if (dir && dir.lengthSq && dir.lengthSq() > 1e-6) group.rotation.y = Math.atan2(-dir.x, -dir.z); },
    // 重开时把 mixer 动作恢复到初始 Idle（死亡时可能 stopAllAction 过）
    resetPose() {
      moveAmt = 0;
      for (const k in actions) {
        if (!actions[k]) continue;
        actions[k].enabled = true;
        actions[k].reset().setEffectiveWeight(k === 'Idle' ? 1 : 0).play();
      }
      cur = 'Idle';
    },
    // 死亡：停掉所有烘焙动作，交由外层播放倒地
    stopAnims() { mixer.stopAllAction(); },
    // 拉弓叠加：在 mixer.update 之后调用，weight=draw(0..1)，把双臂插值到持弓/拉弦姿态
    aimBow(weight) {
      if (weight <= 0.001) return;
      const w = Math.min(1, weight);
      const pose = {
        L: { sh: [-1.8, 0, -0.6], el: [0.6, 0, 0] },
        R: { sh: [2.1, 0, -0.4], el: [-1.6, 0, 0] }
      };
      for (const side of ['L','R']) {
        const cfg = pose[side];
        const chain = [[arm[side].shoulder, cfg.sh], [arm[side].elbow, cfg.el]];
        for (const [bone, e] of chain) {
          _ae.set(e[0], e[1], e[2]); _qa.setFromEuler(_ae);
          _qc.copy(bone.quaternion);
          bone.quaternion.slerpQuaternions(_qc, _qa, w);
        }
      }
    },
    handWorld(v, side = 'R') { const h = side === 'L' ? LHand : RHand; if (h && v) h.getWorldPosition(v); else if (v) v.copy(group.position).setY(1.4); return v; },
    attachTo(obj, side) { const h = side === 'L' ? LHand : RHand; if (h) h.attach(obj); }
  };
  return api;
}

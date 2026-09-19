// 通用火柴人骨架：肩/肘/腕 + 髋/膝/踝/脚，全部侧视（XY 平面，旋转绕 Z）
import * as THREE from 'three';

function stick(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  m.position.y = -len / 2;
  return m;
}

// mat: 单一材质（全身共用，便于染色）；position: 脚底世界坐标
export function buildStickFigure(mat, position = new THREE.Vector3()) {
  const root = new THREE.Group();
  root.position.copy(position);

  const body = new THREE.Group();   // 呼吸/起伏/前倾
  root.add(body);

  // 骨盆 + 躯干 + 头
  const pelvis = new THREE.Group(); pelvis.position.y = 1.12; body.add(pelvis);
  const torso = stick(0.085, 0.82, mat); torso.position.y = 0.41; pelvis.add(torso);
  const chest = new THREE.Group(); chest.position.y = 0.83; pelvis.add(chest); // 约 y1.95
  const neck = stick(0.06, 0.12, mat); neck.position.y = 0.0; chest.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 22, 16), mat);
  head.position.y = 0.32; chest.add(head);

  function arm(side) {
    const shoulder = new THREE.Group(); shoulder.position.set(0.0, 0.78, side * 0.1); chest.add(shoulder);
    const upper = stick(0.05, 0.28, mat); shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.28; shoulder.add(elbow);
    const fore = stick(0.044, 0.28, mat); elbow.add(fore);
    const hand = new THREE.Group(); hand.position.y = -0.28; elbow.add(hand);
    return { shoulder, elbow, hand };
  }
  const armL = arm(-1), armR = arm(1);

  function leg(side) {
    const hip = new THREE.Group(); hip.position.set(0, 0, side * 0.09); pelvis.add(hip);
    const thigh = stick(0.062, 0.52, mat); hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.52; hip.add(knee);
    const shin = stick(0.052, 0.5, mat); knee.add(shin);
    const ankle = new THREE.Group(); ankle.position.y = -0.5; knee.add(ankle);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.1), mat);
    foot.position.set(0.06, -0.02, 0); ankle.add(foot);
    return { hip, knee, ankle };
  }
  const legL = leg(-1), legR = leg(1);

  root.userData.rig = { body, pelvis, chest, head, armL, armR, legL, legR };
  return { root, mat, body, pelvis, chest, head, armL, armR, legL, legR };
}

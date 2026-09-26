// Procedural PBR humanoid driven by the shared 2D pose model.
import * as THREE from 'three';
import { PX, SKELETON, jointAngles } from './mapping.js';
import { loadPBR } from './assets.js';

const S = SKELETON;
const FRONT_Z = 0.13;
const BACK_Z = -0.13;

function physical(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.55,
    metalness: 0.0,
    envMapIntensity: 1.0,
    ...opts,
  });
}

// Tapered limb: cylinder from the pivot origin down -Y, sphere joint at the top.
function limb(parent, lengthPx, rTopPx, rBotPx, mat, castShadow = true) {
  const len = lengthPx * PX;
  const rt = rTopPx * PX, rb = rBotPx * PX;
  const geo = new THREE.CylinderGeometry(rt, rb, len, 18, 1, false);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = -len / 2;
  m.castShadow = castShadow;
  m.receiveShadow = true;
  parent.add(m);
  const joint = new THREE.Mesh(new THREE.SphereGeometry(rt, 18, 12), mat);
  joint.castShadow = castShadow;
  parent.add(joint);
  const end = new THREE.Object3D();
  end.position.y = -len;
  parent.add(end);
  return end;
}

export function createRig(character, accentHex) {
  const look = character.art.look;
  const accent = new THREE.Color(accentHex);

  const mats = {
    skin: physical(look.skin, { roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffc9a8), sheenRoughness: 0.6 }),
    top: physical(look.top, { roughness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    topLight: physical(look.topLight, { roughness: 0.6 }),
    pants: physical(look.pants, { roughness: 0.7 }),
    shoe: physical(look.shoe, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0.05 }),
    hair: physical(look.hair, { roughness: 0.35, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.35 }),
    accent: new THREE.MeshPhysicalMaterial({
      color: accent.clone().multiplyScalar(0.25),
      emissive: accent, emissiveIntensity: 1.1,
      roughness: 0.3, metalness: 0.4,
    }),
    armor: physical(0x1a1c22, { roughness: 0.22, metalness: 0.85, clearcoat: 1, clearcoatRoughness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x0d0f14, roughness: 0.05, metalness: 0.1,
      transmission: 0.35, thickness: 0.02, ior: 1.5, clearcoat: 1,
      emissive: accent, emissiveIntensity: 0.2,
    }),
  };
  const allMats = Object.values(mats);

  // scanned fabric and leather: applied asynchronously once fetched
  const fabrics = look.bareForearms
    ? { top: 'knitted_fleece', pants: 'denim_fabric_06', shoe: 'leather_white' }
    : { top: 'poly_wool_herringbone', pants: 'denim_fabric_05', shoe: 'brown_leather' };
  for (const [slot, id] of Object.entries(fabrics)) {
    loadPBR(id).then(({ map, normalMap, roughnessMap }) => {
      const rep = slot === 'shoe' ? 6 : 3.5;
      for (const t of [map, normalMap, roughnessMap]) t.repeat.set(rep, rep);
      for (const m of slot === 'top' ? [mats.top, mats.topLight] : [mats[slot]]) {
        m.map = map;
        m.normalMap = normalMap;
        m.normalScale.set(0.8, 0.8);
        m.roughnessMap = roughnessMap;
        m.color.set(look[slot === 'top' ? 'top' : slot]).lerp(new THREE.Color(0xffffff), 0.35).multiplyScalar(slot === 'shoe' ? 1.2 : 2.4);
        m.needsUpdate = true;
      }
    }).catch(() => {});
  }

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // hips
  const hips = new THREE.Group();
  hips.position.y = S.hipY * PX;
  body.add(hips);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(13 * PX, 20, 14), mats.pants);
  pelvis.scale.set(1.15, 0.8, 1);
  pelvis.castShadow = true;
  hips.add(pelvis);

  // torso pivots at the hips and leans
  const torso = new THREE.Group();
  hips.add(torso);
  const torsoLen = (S.shoulderY - S.hipY) * PX;
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(14 * PX, torsoLen * 0.7, 8, 20), mats.top);
  chest.position.y = torsoLen * 0.55;
  chest.scale.set(1.2, 1, 0.72);
  chest.castShadow = true;
  chest.receiveShadow = true;
  torso.add(chest);
  // chest plate / lapel accent
  const plate = new THREE.Mesh(new THREE.CapsuleGeometry(6.5 * PX, torsoLen * 0.5, 6, 16), mats.armor);
  plate.position.set(0, torsoLen * 0.6, 10.5 * PX);
  plate.scale.set(1.6, 1, 0.35);
  plate.castShadow = true;
  torso.add(plate);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(4 * PX, torsoLen * 0.72, 2 * PX), mats.accent);
  stripe.position.set(0, torsoLen * 0.58, 13.5 * PX);
  torso.add(stripe);

  // shoulders + neck + head
  const shoulders = new THREE.Group();
  shoulders.position.y = torsoLen;
  torso.add(shoulders);
  const yoke = new THREE.Mesh(new THREE.CapsuleGeometry(7 * PX, 24 * PX, 6, 14), mats.top);
  yoke.rotation.z = Math.PI / 2;
  yoke.rotation.x = Math.PI / 2;   // lay along z (shoulder line runs toward the camera)
  yoke.castShadow = true;
  shoulders.add(yoke);
  for (const z of [FRONT_Z, BACK_Z]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(8.5 * PX, 18, 12), mats.armor);
    pad.position.set(0, 2 * PX, z);
    pad.castShadow = true;
    shoulders.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8.5 * PX, 1.2 * PX, 8, 24), mats.accent);
    ring.position.set(0, 2 * PX, z);
    ring.rotation.x = Math.PI / 2;
    shoulders.add(ring);
  }

  const headPivot = new THREE.Group();
  headPivot.position.y = 6 * PX;
  shoulders.add(headPivot);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(5 * PX, 6 * PX, 10 * PX, 12), mats.skin);
  neck.position.y = 4 * PX;
  headPivot.add(neck);
  const headY = (S.headY - S.shoulderY - 6) * PX;
  const head = new THREE.Mesh(new THREE.SphereGeometry(12.5 * PX, 28, 20), mats.skin);
  head.position.y = headY;
  head.scale.set(0.92, 1.08, 0.95);
  head.castShadow = true;
  headPivot.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(13.2 * PX, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.42), mats.hair);
  hair.position.y = headY + 2.5 * PX;
  hair.scale.set(0.95, 1.05, 0.98);
  hair.castShadow = true;
  headPivot.add(hair);
  // visor / glasses band: glassy strip across the eyes with an emissive edge
  const visor = new THREE.Mesh(new THREE.BoxGeometry(look.glasses ? 15 * PX : 9 * PX, 3.2 * PX, 22 * PX), mats.glass);
  visor.position.set(7 * PX, headY - 1.0 * PX, 0);
  headPivot.add(visor);
  const visorEdge = new THREE.Mesh(new THREE.BoxGeometry(look.glasses ? 15.5 * PX : 9.5 * PX, 0.6 * PX, 22.5 * PX), mats.accent);
  visorEdge.position.set(7 * PX, headY - 2.8 * PX, 0);
  headPivot.add(visorEdge);
  // jaw hint
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(9 * PX, 20, 14), mats.skin);
  jaw.position.set(2 * PX, headY - 7 * PX, 0);
  jaw.scale.set(1, 0.7, 0.9);
  headPivot.add(jaw);

  // arms
  function makeArm(z, bare) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0, 0, z);
    shoulders.add(shoulder);
    const elbow = limb(shoulder, S.armUpper, 6.2, 4.8, mats.top);
    const elbowPivot = new THREE.Group();
    elbowPivot.position.copy(elbow.position);
    shoulder.add(elbowPivot);
    const wrist = limb(elbowPivot, S.armFore, 4.8, 3.6, bare ? mats.skin : mats.topLight);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(5.5 * PX, 18, 12), mats.skin);
    fist.position.copy(wrist.position).add(new THREE.Vector3(0, -2 * PX, 0));
    fist.scale.set(1, 0.9, 1.1);
    fist.castShadow = true;
    elbowPivot.add(fist);
    const knuckle = new THREE.Mesh(new THREE.TorusGeometry(5 * PX, 0.9 * PX, 8, 20), mats.accent);
    knuckle.position.copy(wrist.position);
    knuckle.rotation.x = Math.PI / 2;
    elbowPivot.add(knuckle);
    return { shoulder, elbowPivot, fist };
  }
  const frontArm = makeArm(FRONT_Z, look.bareForearms);
  const backArm = makeArm(BACK_Z, look.bareForearms);

  // legs
  function makeLeg(z) {
    const hip = new THREE.Group();
    hip.position.set(0, 0, z * 0.85);
    hips.add(hip);
    const knee = limb(hip, S.legThigh, 8.5, 6.5, mats.pants);
    const kneePivot = new THREE.Group();
    kneePivot.position.copy(knee.position);
    hip.add(kneePivot);
    const ankle = limb(kneePivot, S.legShin, 6.5, 4.2, mats.pants);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(22 * PX, 7 * PX, 10 * PX), mats.shoe);
    shoe.position.copy(ankle.position).add(new THREE.Vector3(5 * PX, -2.5 * PX, 0));
    shoe.castShadow = true;
    kneePivot.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(22.5 * PX, 1.2 * PX, 10.5 * PX), mats.accent);
    sole.position.copy(shoe.position).add(new THREE.Vector3(0, -3.2 * PX, 0));
    kneePivot.add(sole);
    return { hip, kneePivot, shoe };
  }
  const frontLeg = makeLeg(FRONT_Z);
  const backLeg = makeLeg(BACK_Z);

  const feet = { front: frontLeg.shoe, back: backLeg.shoe };
  const fists = { front: frontArm.fist, back: backArm.fist };

  let flash = 0;
  const emissiveBase = allMats.map((m) => ({ c: m.emissive.clone(), i: m.emissiveIntensity }));

  return {
    object: root,
    mats,
    feet, fists, head,

    setPose(pose, facing) {
      const j = jointAngles(pose, facing);
      body.position.y = j.bodyY;
      torso.rotation.z = j.torso;
      headPivot.rotation.z = j.head;
      frontArm.shoulder.rotation.z = j.frontArm;
      frontArm.elbowPivot.rotation.z = j.frontFore;
      backArm.shoulder.rotation.z = j.backArm;
      backArm.elbowPivot.rotation.z = j.backFore;
      frontLeg.hip.rotation.z = j.frontLeg;
      frontLeg.kneePivot.rotation.z = j.frontShin;
      backLeg.hip.rotation.z = j.backLeg;
      backLeg.kneePivot.rotation.z = j.backShin;
      // feet point toward facing
      frontLeg.shoe.scale.x = facing;
      backLeg.shoe.scale.x = facing;
      // head and torso face the opponent (slight yaw for depth)
      root.rotation.y = facing > 0 ? 0.18 : -0.18;
    },

    // 0..1 white-hot damage flash
    setFlash(v) {
      if (v === flash) return;
      flash = v;
      allMats.forEach((m, i) => {
        const b = emissiveBase[i];
        m.emissive.copy(b.c).lerp(new THREE.Color(0xffffff), v);
        m.emissiveIntensity = b.i + v * 3.5;
      });
    },
  };
}

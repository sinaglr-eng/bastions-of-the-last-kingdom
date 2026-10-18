/* Private runtime preview only. Approved V7 GLBs are read, never rewritten.
 * Coordinates below are imported-scene coordinates: +X anatomical right,
 * +Y up, -Z forward. All distances are fractions of anatomical height.
 * Arm bones are solved from their actual rest landmarks, not local Euler axes.
 */
export const BASIC_ATTACK_PROFILES = Object.freeze({
  soldier: { name: 'Soldier', intervals: [1, 1, 1, 1, 1, .7], event: .38,
    readyR: [0, .025, -.015], reachR: [-.015, .025, -.085], pitchR: [-56, -22], yawR: 0,
    readyL: [0, .012, -.008], reachL: [0, .004, -.012], chest: [-1.4, -2.2], yaw: -2.5 },
  archer: { name: 'Archer', intervals: [.25, .25, .25, .25, .25, .1], event: .42,
    readyR: null, reachR: [.028, .004, .028], pitchR: [0, 0], yawR: 0,
    readyL: [0, 0, 0], reachL: [0, 0, -.006], chest: [-.3, -.5], yaw: 0 },
  mage: { name: 'Mage', intervals: [1, 1, 1, 1, 1, 1], event: .43,
    readyR: [0, .025, -.008], reachR: [-.012, .032, -.065], pitchR: [-3, -10], yawR: -3,
    readyL: [0, .004, 0], reachL: [0, .004, 0], chest: [.6, -1.4], yaw: -1.2 },
  frostwarden: { name: 'Frost Warden', intervals: [1, 1, 1, 1, 1, .6], event: .40,
    readyR: [0, .022, -.006], reachR: [0, .015, -.073], pitchR: [-2, -9], yawR: 0,
    readyL: [0, 0, 0], reachL: [0, 0, 0], chest: [-.4, -1.6], yaw: -.7 },
  cleric: { name: 'Cleric', intervals: [1, 1, 1, 1, 1, 1], event: .46,
    readyR: [0, .018, -.004], reachR: [-.008, .04, -.046], pitchR: [0, -6], yawR: 0,
    readyL: [0, .004, 0], reachL: [0, .004, 0], chest: [.4, -.9], yaw: -.5 },
  druid: { name: 'Druid', intervals: [1, 1, 1, 1, 1, 1], event: .41,
    readyR: [.008, .02, -.008], reachR: [-.043, .02, -.076], pitchR: [-2, -11], yawR: -11,
    readyL: [0, .004, 0], reachL: [-.006, .016, -.025], chest: [.4, -1.8], yaw: -3.2 },
  runebreaker: { name: 'Engineer', intervals: [.6, .6, .6, .6, .6, .6], event: .36,
    readyR: [0, .026, -.004], reachR: [-.008, -.025, -.072], pitchR: [-2, -20], yawR: 0,
    readyL: [0, .003, 0], reachL: [0, .002, 0], chest: [.6, -2.1], yaw: -1.5 },
  stormcaller: { name: 'Stormcaller', intervals: [1.3, 1.3, 1.3, 1.3, 1.3, .6], event: .35,
    readyR: [0, .014, -.004], reachR: [-.012, .025, -.081], pitchR: [0, -8], yawR: -3,
    readyL: [0, .003, 0], reachL: [0, .009, -.018], chest: [.5, -1.6], yaw: -1.4 }
});

const REQUIRED = ['root', 'pelvis', 'spine', 'chest', 'neck', 'head',
  ...['left', 'right'].flatMap(s => ['shoulder', 'upper_arm', 'forearm', 'hand', 'thigh', 'shin', 'foot'].map(n => `${s}_${n}`))];
const ACTIVE = ['chest', 'head', 'right_upper_arm', 'right_forearm', 'right_hand', 'left_upper_arm', 'left_forearm', 'left_hand'];
export const SUPPORTED_IDS = Object.freeze(Object.keys(BASIC_ATTACK_PROFILES).flatMap(family => Array.from({ length: 6 }, (_, i) => `${family}-${i + 1}`)));
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const deg = n => n * Math.PI / 180;

/** Same family curve for ranks I–VI. No keyframes or production game events are created. */
export function createBasicMotion(THREE, scene, entry) {
  if (!THREE?.Vector3 || !scene?.traverse) throw new Error('A Three.js instance and imported GLTF scene are required.');
  const family = entry.family || String(entry.id || '').replace(/-[1-6]$/, '');
  const rank = Number(entry.rank || String(entry.id || '').match(/-([1-6])$/)?.[1] || 1);
  const profile = BASIC_ATTACK_PROFILES[family];
  if (!profile || !Number.isInteger(rank) || rank < 1 || rank > 6) throw new Error(`Unsupported basic defender: ${entry.id}`);
  const bones = new Map();
  scene.traverse(o => { if (o.isBone && REQUIRED.includes(o.name)) {
    if (bones.has(o.name) && bones.get(o.name) !== o) throw new Error(`Duplicate bone ${o.name}`);
    bones.set(o.name, o);
  }});
  const missing = REQUIRED.filter(n => !bones.has(n));
  if (missing.length) throw new Error(`Missing V7 bones: ${missing.join(', ')}`);
  scene.updateWorldMatrix(true, true);
  const sceneQ = () => scene.getWorldQuaternion(new THREE.Quaternion());
  const invSceneQ = sceneQ().invert();
  const rest = new Map([...bones].map(([n, b]) => [n, {
    position: b.position.clone(), quaternion: b.quaternion.clone(), scale: b.scale.clone(),
    point: scene.worldToLocal(b.getWorldPosition(new THREE.Vector3())),
    orientation: invSceneQ.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()))
  }]));
  const height = Number(entry.height || entry.anatomicalHeight || entry.anatomicalHeightMeters);
  if (!(height > 0 && Number.isFinite(height))) throw new Error('entry.height must be the actual anatomical height in GLB scene units.');
  const interval = profile.intervals[rank - 1];
  const world = p => scene.localToWorld(p.clone());
  const v = a => new THREE.Vector3(...a);
  const lastFrame = { phase: 0, eventPhase: profile.event, interval, reachClamps: [], mode: 'rest' };

  function restore() {
    for (const [name, b] of bones) {
      const r = rest.get(name); b.position.copy(r.position); b.quaternion.copy(r.quaternion); b.scale.copy(r.scale);
    }
    scene.updateWorldMatrix(true, true);
  }
  function worldQuaternion(bone, q) {
    const parentQ = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    bone.quaternion.copy(parentQ.invert().multiply(q)).normalize();
    bone.updateWorldMatrix(false, true);
  }
  function orient(name, pitch, yaw = 0, roll = 0) {
    const delta = new THREE.Quaternion().setFromEuler(new THREE.Euler(deg(pitch), deg(yaw), deg(roll), 'YXZ'));
    worldQuaternion(bones.get(name), sceneQ().multiply(delta).multiply(rest.get(name).orientation));
  }
  function point(name, offset) { return rest.get(name).point.clone().addScaledVector(v(offset), height); }
  function arm(side, targetLocal, handPitch, handYaw = 0) {
    const u = bones.get(`${side}_upper_arm`), f = bones.get(`${side}_forearm`), h = bones.get(`${side}_hand`);
    const S = u.getWorldPosition(new THREE.Vector3()), E = f.getWorldPosition(new THREE.Vector3()), W = h.getWorldPosition(new THREE.Vector3());
    const A = E.distanceTo(S), B = W.distanceTo(E), target = world(targetLocal);
    const direction = target.clone().sub(S); let distance = direction.length();
    if (A < 1e-8 || B < 1e-8 || distance < 1e-8) throw new Error(`Invalid ${side} arm rest chain`);
    direction.divideScalar(distance);
    const bounded = Math.max(Math.abs(A - B) + 1e-5, Math.min(A + B - 1e-5, distance));
    if (Math.abs(bounded - distance) > 1e-6) lastFrame.reachClamps.push(side);
    distance = bounded; target.copy(S).addScaledVector(direction, distance);
    // Rest elbow defines the bend plane; no assumed local bone hinge axis.
    let bend = world(rest.get(`${side}_forearm`).point).sub(S);
    bend.addScaledVector(direction, -bend.dot(direction));
    if (bend.lengthSq() < 1e-12) {
      bend = new THREE.Vector3(side === 'right' ? 1 : -1, 0, 0).applyQuaternion(sceneQ());
      bend.addScaledVector(direction, -bend.dot(direction));
    }
    bend.normalize();
    const along = (A * A - B * B + distance * distance) / (2 * distance);
    const elbow = S.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, A * A - along * along)));
    const qUpper = new THREE.Quaternion().setFromUnitVectors(E.clone().sub(S).normalize(), elbow.clone().sub(S).normalize());
    worldQuaternion(u, qUpper.multiply(u.getWorldQuaternion(new THREE.Quaternion())));
    const actualE = f.getWorldPosition(new THREE.Vector3()), actualW = h.getWorldPosition(new THREE.Vector3());
    const qFore = new THREE.Quaternion().setFromUnitVectors(actualW.sub(actualE).normalize(), target.clone().sub(actualE).normalize());
    worldQuaternion(f, qFore.multiply(f.getWorldQuaternion(new THREE.Quaternion())));
    // Hand-owned rigid equipment keeps its exact grip; wrist orientation is explicit.
    orient(`${side}_hand`, handPitch, handYaw);
  }
  function envelope(phase) {
    const e = profile.event;
    if (phase < .20) return { reach: -.18 * smooth(phase / .20), gather: smooth(phase / .20), recoil: 0 };
    if (phase < e) return { reach: lerp(-.18, 1, smooth((phase - .20) / (e - .20))), gather: 1 - smooth((phase - .20) / (e - .20)), recoil: 0 };
    if (phase < e + .10) return { reach: lerp(1, .78, smooth((phase - e) / .10)), gather: 0, recoil: Math.sin(Math.PI * (phase - e) / .10) };
    return { reach: .78 * (1 - smooth((phase - e - .10) / (1 - e - .10))), gather: 0, recoil: 0 };
  }

  function update(time, options = {}) {
    if (!Number.isFinite(time)) throw new Error('Animation time must be finite seconds.');
    restore(); lastFrame.mode = options.mode || 'attack'; lastFrame.reachClamps = [];
    if (lastFrame.mode !== 'attack') { lastFrame.phase = 0; return { ...lastFrame }; }
    const speed = Number(options.speed ?? 1);
    if (!(speed >= 0 && Number.isFinite(speed))) throw new Error('Playback speed must be finite and nonnegative.');
    const phase = options.phase === undefined ? ((time * speed / interval) % 1 + 1) % 1 : Math.max(0, Math.min(1, Number(options.phase)));
    if (!Number.isFinite(phase)) throw new Error('Animation phase must be finite.');
    lastFrame.phase = phase;
    const { reach, gather, recoil } = envelope(phase);
    orient('chest', profile.chest[0] * gather + profile.chest[1] * reach, profile.yaw * reach);
    orient('head', -.5 * gather, -.3 * profile.yaw * reach);
    let R, L;
    if (family === 'archer') {
      // Same raised firing pose for all ranks. Display-rest hand is at the waist.
      R = new THREE.Vector3(.075 * height, .61 * height, -.14 * height)
        .addScaledVector(v(profile.reachR), height * (reach + .25 * recoil));
      L = rest.get('left_hand').point.clone(); L.y = .62 * height; L.z -= .012 * height;
      L.addScaledVector(v(profile.reachL), height * reach);
    } else {
      R = point('right_hand', profile.readyR).addScaledVector(v(profile.reachR), height * reach);
      // Display wrists can already be close to full reach. A common ready-pose
      // retraction leaves elbow room for the shared forward action at every rank.
      R.addScaledVector(rest.get('right_upper_arm').point.clone().sub(rest.get('right_hand').point).normalize(), .045 * height);
      L = point('left_hand', profile.readyL).addScaledVector(v(profile.reachL), height * reach);
    }
    arm('right', R, profile.pitchR[0] + profile.pitchR[1] * reach - 1.5 * recoil, profile.yawR * reach);
    arm('left', L, family === 'archer' ? -2 * reach : 0, 0);
    scene.updateWorldMatrix(true, true);
    return { ...lastFrame, reachClamps: [...lastFrame.reachClamps] };
  }
  const channels = ACTIVE.map(bone => `${bone}: skeletal quaternion`);
  const summary = {
    id: entry.id, family, rank, name: profile.name, intervalSeconds: interval, eventPhase: profile.event,
    implemented: 'Looping time-based skeletal attack preview on the imported private GLTF scene.',
    sharedRanks: 'One normalized family trajectory and amplitudes for I–VI; actual rest geometry, arm lengths and configured interval are the only rank-dependent inputs.',
    contacts: 'Root, pelvis, legs and feet remain at exact rest. Equipment follows existing hand skin weights; no reparenting, handoff or asset write.',
    limitations: 'Preview only. No projectiles, damage, string deformation, finger articulation, cloth simulation, collision certification or production animation clips. Archer uses a raised compact firing pose; idle/reset restores approved display rest.',
    requiredBones: [...REQUIRED], animatedBones: [...ACTIVE]
  };
  return { update, reset: restore, summary, channels, duration: interval, releaseTime: interval * profile.event, status: 'prototype' };
}

export default createBasicMotion;

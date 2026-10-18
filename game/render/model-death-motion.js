/* One-shot, non-gory deaths on private runtime actor hierarchies.
 * No source geometry, shared material, navigation X/Z or rest template is edited.
 * Death begins from the current pose; it is not a ragdoll simulation.
 */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const span = (p, a, b) => smooth((p - a) / (b - a));
const ACTIVE = new WeakMap();

const DEFINITIONS = [
  ['host_01', 'Orc Skull Scavengers', 'biped', 1.10, 'Loaded stagger, then forward-side collapse; sack and cleaver stay attached.'],
  ['host_02', 'Goblin Thornstriders', 'biped', .96, 'Light leg failure and quick narrow collapse; spear remains in its grip.'],
  ['host_03', 'Ogre Gluttons', 'heavy', 1.40, 'Belly-led heavy collapse; pan and mallet remain with their hands.'],
  ['host_04', 'Orc Scrap Tinkers', 'biped', 1.20, 'Rear load checks the stagger before the whole equipped body falls.'],
  ['host_05', 'Bat Scouts', 'flight', 1.55, 'Lose lift, fold real wing hinges if present and descend with the hanging scout supported.'],
  ['host_06', 'Mossback Trolls', 'heavy', 1.48, 'Slow massive collapse; moss, stones and tool stay on the same body.'],
  ['host_07', 'Marsh Orc Hunters', 'biped', 1.08, 'Hunting stance breaks into a guarded forward-side fall.'],
  ['host_08', 'Shadowblood Trolls', 'heavy', 1.38, 'The approved solid troll collapses coherently; no invented floating limb separation.'],
  ['host_09', 'Goblin Dust Dancers', 'biped', .98, 'Brief evasive stagger ends in a compact side collapse with both daggers retained.'],
  ['host_10', 'Mogrok, the Gatebreaker', 'heavy', 1.60, 'Armored boss loses balance slowly; door shield and ram tool fall with him.'],
  ['host_11', 'Orc Hookbearers', 'biped', 1.14, 'Square guard drops into a compact collapse; hook chains stay connected.'],
  ['host_12', 'Goblin Bell Devourers', 'heavy', 1.30, 'Bell burden leads a delayed side-forward fall without detaching the bell.'],
  ['host_13', 'Red Tusk Orc Huntresses', 'biped', 1.06, 'Knees give way and the armed body falls to one side with the axe retained.'],
  ['host_14', 'Orc Mirror Shieldbearers', 'biped', 1.20, 'Guard buckles behind its shield; no new shield bash or mirror shatter.'],
  ['host_15', 'Blood Bat Riders', 'flight', 1.62, 'Loss of wing power becomes a grounded fall with rider, short legs and neck collar attached.'],
  ['host_16', 'Orc Ash Pickpockets', 'biped', 1.04, 'Short recoiling stagger becomes a compact collapse; purses and dagger remain attached.'],
  ['host_17', 'Cursed Totem Trolls', 'heavy', 1.48, 'Totem-laden body topples slowly; all three skulls remain supported.'],
  ['host_18', 'Silent Orc Executioners', 'biped', 1.12, 'Low guarded collapse preserves both actual curved blades.'],
  ['host_19', 'Bloodwolf Orc Riders', 'wolf', 1.46, 'Four-leg buckle and side fall; saddle, reins and rider remain one supported assembly.'],
  ['host_20', 'Gorvash, the Bone Patriarch', 'heavy', 1.64, 'Heavy boss collapse carries crown, throne and bone club without disassembly.'],
  ['host_21', 'Rotroot Trolls', 'heavy', 1.52, 'Dense bark-and-moss body settles as a single fallen mass; no foliage explosion.'],
  ['host_22', 'Iron Ram Ogres', 'heavy', 1.42, 'Rigid armored body drops and topples; ram horns and hammer remain intact.'],
  ['host_23', 'Shard-Soul Orc Warlocks', 'biped', 1.24, 'Grounded caster collapse; floating masks do not make the whole body a flying unit.'],
  ['host_24', 'Riveted Goblin Mutants', 'mechanical', 1.42, 'Real frame hinges slacken where present; the intact machine drops with pilot enclosed.'],
  ['host_25', 'Iron Bat Orc Riders', 'flight', 1.72, 'Armored loss of lift; rider, crossbow grips and neck collar remain with the mount.'],
  ['host_26', 'Orc Spell Eaters', 'heavy', 1.24, 'Stocky guarded collapse retains collar blocks and spiked hammer.'],
  ['host_27', 'Spectral Bat Riders', 'spectral-flight', 1.72, 'Skeletal mount falls with rider attached, then dims into a persistent translucent residue.'],
  ['host_28', 'Goblin Scrapwings', 'mechanical-flight', 1.58, 'Mechanical lift fails; real hinges fold if present and the cockpit descends intact.'],
  ['host_29', 'Prismatic Bat Tricksters', 'flight', 1.58, 'Uneven loss of lift becomes a grounded bat-and-rider collapse; no duplicate body is spawned.'],
  ['host_30', 'Zaruun, Lord of Storm Wings', 'flight', 1.90, 'Large wing failure and heavy grounded descent preserve rider and load-bearing tack.'],
  ['host_31', 'Orc Dual-Seal Inquisitors', 'biped', 1.18, 'Two-seal caster staggers and falls without changing either held seal or weapon.'],
  ['host_32', 'Soul-Drinker Trolls', 'heavy', 1.50, 'Tall burdened troll collapses slowly; soul vessels remain attached.'],
  ['host_33', 'Orc Wraiths of the Shattered World', 'spectral', 1.52, 'Ground spectral figure collapses and dims; approved voids remain literal and no gore appears.'],
  ['host_34', 'Goblin Gallows Fliers', 'flight', 1.66, 'Lift fails while the suspended gallows and rider stay in their authored assembly.'],
  ['host_35', 'Eclipse Bat Guard', 'flight', 1.70, 'Defensive bat loses lift and settles with armor, rider and collar intact.'],
  ['host_36', 'Orc Oathbreakers', 'biped', 1.22, 'Armored oathbreaker buckles into a shield-side collapse.'],
  ['host_37', 'Riftwolf Orc Riders', 'wolf', 1.50, 'Wolf forequarters and hindquarters buckle before a side fall; rider stays seated.'],
  ['host_38', 'Black Marsh Knifemen', 'biped', 1.10, 'Compact knife-bearing collapse; no spectral substitution of the base appearance.'],
  ['host_39', 'Thunder Manta Orc Riders', 'manta', 1.78, 'Fin power decays; the broad armored center descends nearly flat with rider supported.'],
  ['host_40', 'Vorlak, the Hollow Sky King', 'flight', 1.94, 'Large hollow sky mount loses lift and grounds as one coherent boss assembly.'],
  ['host_41', 'Orc Crystal Phalanx', 'biped', 1.26, 'Crystal guard buckles and falls behind its intact equipment.'],
  ['host_42', 'Fire Bat Orc Lancers', 'flight', 1.66, 'Wing power stops and the lancer descends with lance, knees and neck support retained.'],
  ['host_43', 'Ogres of the Imprisoned Souls', 'heavy', 1.58, 'Heavy ogre drops with soul prison and weapon still attached; no new soul projectile.'],
  ['host_44', 'Orc Ash Executioners', 'biped', 1.16, 'Armed forward-side collapse keeps the approved execution weapon in the grip.'],
  ['host_45', 'Flying Drummers of the Black Horde', 'flight', 1.74, 'Transport bat loses lift; two drummers, four arms and drum stay in the same assembly.'],
  ['host_46', 'Ogre Revenants in Hollow Armor', 'hollow-armor', 1.60, 'Rigid hollow armor drops through real hinges where present; inner emissive fire weakens, without flesh.'],
  ['host_47', 'Orc Riders of the Last Howl', 'wolf', 1.62, 'Heavy wolf buckles and rolls onto its side; banner, mask, rider and tack remain attached.'],
  ['host_48', 'Bat Thieves of Black Fire', 'flight', 1.62, 'Quick asymmetric loss of lift ends on the ground with thief and equipment supported.'],
  ['host_49', 'Troll Guardians of the Deep Maw', 'heavy', 1.72, 'Shell-backed giant topples as a massive intact body; abdominal mouth stays part of the torso.'],
  ['host_50', 'Lord Bernhard', 'flight', 2.00, 'Wyvern queen loses lift while throne, rider, sword and reins remain attached through the grounded fall.'],
  ['host_31-wraith', 'Spectral Dual-Seal Inquisitors', 'spectral', 1.56, 'Grounded spectral caster collapses and dims to a persistent residue, retaining seal ownership.'],
  ['host_35-wraith', 'Spectral Eclipse Bat Riders', 'spectral-flight', 1.80, 'Spectral bat and supported rider lose lift together, fall, then dim to a grounded residue.'],
  ['host_36-wraith', 'Spectral Oathbreakers', 'spectral', 1.58, 'Spectral armored guard collapses without shattering the shield, then dims.'],
  ['host_38-wraith', 'Blood-Leech Trolls', 'heavy', 1.64, 'Solid pale troll collapses with both red blood-leech sacs attached; the historical variant suffix does not imply vapor or opacity loss.' ]
];

export const ENEMY_DEATH_PROFILES = Object.freeze(Object.fromEntries(DEFINITIONS.map(([id, name, kind, duration, description], index) => {
  const flying = ['flight', 'spectral-flight', 'mechanical-flight', 'manta'].includes(kind);
  const side = index % 2 ? -1 : 1;
  const wolf = kind === 'wolf', spectral = kind.startsWith('spectral'), mechanical = kind.includes('mechanical') || kind === 'hollow-armor';
  return [id, Object.freeze({ id, name, kind, duration, flying, spectral, mechanical, description,
    pitch: kind === 'manta' ? .16 : wolf ? .14 : mechanical ? 1.20 : 1.45,
    roll: side * (kind === 'manta' ? .12 : wolf ? 1.46 : flying ? .30 : .20),
    yaw: side * (wolf ? .06 : .08), side,
    finalOpacity: spectral ? .22 : 1,
    kneeAngle: wolf ? .58 : mechanical ? .32 : .48,
    wingFold: mechanical ? .32 : .48
  })];
})));
export const SUPPORTED_ENEMY_DEATH_IDS = Object.freeze(Object.keys(ENEMY_DEATH_PROFILES));

/** Resolve spawn IDs, asset keys and actual sourceFile names, never numeric instance IDs. */
export function resolveEnemyDeathId(enemyOrEntry = {}, figure = null, options = {}) {
  const e = typeof enemyOrEntry === 'string' ? { id: enemyOrEntry } : enemyOrEntry || {};
  const candidates = [options.assetId, e.visualAsset, figure?.userData?.assetKey, e.assetId, e.assetKey,
    e.sourceFile, figure?.userData?.sourceFile, figure?.userData?.body?.userData?.sourceFile, e.type, e.id];
  if (figure?.traverse) figure.traverse(n => { if (n.userData?.sourceFile) candidates.push(n.userData.sourceFile); });
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const match = candidate.match(/(?:^|[^a-z0-9])host[_-](\d{1,2})([-_]wraith)?(?=$|[^a-z0-9])/i);
    if (!match) continue;
    const id = `host_${match[1].padStart(2, '0')}${match[2] ? '-wraith' : ''}`;
    if (ENEMY_DEATH_PROFILES[id]) return id;
  }
  return null;
}

/** Capture CURRENT pose once. update is monotonic; sample is separate preview seeking. */
export function createEnemyDeathMotion(THREE, figure, enemyOrEntry = {}, options = {}) {
  if (!THREE?.Group || !figure?.traverse) throw new Error('Death motion requires Three.js and a private actor instance.');
  if (!options.preview && ACTIVE.has(figure)) return ACTIVE.get(figure);
  const id = resolveEnemyDeathId(enemyOrEntry, figure, options), profile = ENEMY_DEATH_PROFILES[id];
  if (!profile) throw new Error('No recognized enemy death profile.');
  const body = figure.userData.body || figure;
  if (body !== figure) { let parent = body; while (parent && parent !== figure) parent = parent.parent; if (!parent) throw new Error('Death body must belong to this actor.'); }
  figure.updateWorldMatrix(true, true);
  const ground = Number.isFinite(options.groundHeight) ? options.groundHeight : Number.isFinite(figure.userData.groundY) ? figure.userData.groundY : 0;
  const clearance = Number.isFinite(options.clearance) ? Math.max(0, options.clearance) : .015;
  const clouds = [], meshes = [];
  const excludedIndicators = new Set(['bar', 'aura', 'shards'].map(k => figure.userData[k]).filter(Boolean));
  body.traverse(mesh => {
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
    let visible = true; for (let n = mesh; n; n = n.parent) { if (!n.visible || excludedIndicators.has(n)) visible = false; if (n === body) break; }
    if (!visible) return;
    const attr = mesh.geometry.attributes.position, scratch = new THREE.Vector3();
    const dynamic = !!mesh.isSkinnedMesh || !!mesh.morphTargetInfluences?.some(x => x !== 0);
    // Death retains the current pose. Capture eight local support-box corners
    // per mesh rather than allocating/copying every vertex of large V6 actors.
    // This conservative support bound prevents penetration while keeping death
    // sampling independent of source triangle count and retaining exact assets.
    const localBox=new THREE.Box3();
    if(dynamic){mesh.skeleton?.update();for(let i=0;i<attr.count;i++)localBox.expandByPoint(mesh.getVertexPosition(i,scratch));}
    else {if(mesh.geometry.userData.motionOwned||!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();localBox.copy(mesh.geometry.boundingBox);}
    const xyz=new Float64Array(24);let index=0;
    for(const x of [localBox.min.x,localBox.max.x])for(const y of [localBox.min.y,localBox.max.y])for(const z of [localBox.min.z,localBox.max.z]){xyz[index++]=x;xyz[index++]=y;xyz[index++]=z;}
    clouds.push({ mesh, xyz, dynamic:false, count:8, renderedVertexCount:attr.count }); meshes.push(mesh);
  });
  if (!clouds.length) throw new Error('Death motion requires actual mesh vertices.');
  const scratch = new THREE.Vector3();
  function bounds(full = false) {
    figure.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    for (const cloud of clouds) {
      const { mesh, xyz, count, dynamic } = cloud, m = mesh.matrixWorld.elements;
      if (dynamic) mesh.skeleton?.update();
      for (let i = 0; i < count; i++) {
        if (dynamic) { mesh.getVertexPosition(i, scratch); } else scratch.fromArray(xyz, i * 3);
        if (full) box.expandByPoint(scratch.applyMatrix4(mesh.matrixWorld));
        else box.min.y = Math.min(box.min.y, m[1] * scratch.x + m[5] * scratch.y + m[9] * scratch.z + m[13]);
      }
    }
    return box;
  }
  const initialBounds = bounds(true), height = initialBounds.max.y - initialBounds.min.y;
  if (!(height > 1e-8 && Number.isFinite(height))) throw new Error('Death body has invalid transformed height.');
  const roots = body === figure ? [...figure.children] : [body];
  const originals = roots.map(node => ({ node, parent: node.parent, index: node.parent.children.indexOf(node),
    position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone(), matrix: node.matrix.clone(), matrixAutoUpdate: node.matrixAutoUpdate }));
  const parent = body === figure ? figure : body.parent, pivot = new THREE.Group(); pivot.name = `Runtime one-shot death ${id}`;
  const center = initialBounds.getCenter(new THREE.Vector3()); center.y = initialBounds.min.y + height * .38;
  pivot.position.copy(parent.worldToLocal(center)); parent.add(pivot); pivot.updateWorldMatrix(true, false);
  // Insert a pure translation under the same parent. This preserves every
  // current child rotation/scale, including nonuniform actor scaling.
  for (const { node } of originals) {
    node.removeFromParent(); pivot.add(node); node.position.sub(pivot.position);
    if (!node.matrixAutoUpdate) node.matrix.elements[12] -= pivot.position.x, node.matrix.elements[13] -= pivot.position.y, node.matrix.elements[14] -= pivot.position.z;
  }
  const pivotStart = pivot.position.clone(), pivotQ = pivot.quaternion.clone();
  figure.updateWorldMatrix(true, true);
  const hinges = [];
  pivot.traverse(node => {
    let angle = 0, axis = 'x';
    if (/^shin_(?:L|R|FL|FR|BL|BR)$/.test(node.name)) angle = profile.kneeAngle;
    else if (/^upper_leg_(?:L|R|FL|FR|BL|BR)$/.test(node.name)) angle = -.18;
    else if (/^(?:wing_[LR]|(?:left|right)_wing_pivot)$/.test(node.name)) { axis = 'z'; angle = /(?:_L|left_)/.test(node.name) ? -profile.wingFold : profile.wingFold; }
    else if (/^(?:torso_pivot|head_pivot)$/.test(node.name)) angle = node.name === 'head_pivot' ? .12 : .08;
    if (angle && !node.isMesh) hinges.push({ node, quaternion: node.quaternion.clone(), axis, angle });
  });
  const indicators = ['bar', 'aura', 'shards'].map(k => figure.userData[k]).filter(Boolean).map(node => ({ node, visible: node.visible }));
  for (const item of indicators) item.node.visible = false;
  const materialRecords = [], ownedMaterials = new Set(), materialCopies = new Map();
  if (profile.spectral || profile.kind === 'hollow-armor') for (const mesh of meshes) {
    const original = mesh.material;
    const copy = material => {
      if (!materialCopies.has(material)) {
        const clone = material.clone(); materialCopies.set(material, { clone, opacity: material.opacity ?? 1, emissive: material.emissiveIntensity ?? 1,
          transparent: material.transparent, depthWrite: material.depthWrite, alphaTest: material.alphaTest }); ownedMaterials.add(clone);
      }
      return materialCopies.get(material).clone;
    };
    mesh.material = Array.isArray(original) ? original.map(copy) : copy(original); materialRecords.push({ mesh, original });
  }
  let elapsed = 0, finished = false, cancelled = false, disposed = false, lastSample = { phase: 0, supportMinY: initialBounds.min.y };
  const parentQuaternion = new THREE.Quaternion(), actorQuaternion = new THREE.Quaternion(), q = new THREE.Quaternion();
  const worldPosition = new THREE.Vector3(), axisX = new THREE.Vector3(1, 0, 0), axisZ = new THREE.Vector3(0, 0, 1);
  function pose(seconds) {
    if (cancelled || disposed) return lastSample;
    const p = clamp(seconds / profile.duration), fall = span(p, .12, .86), buckle = span(p, .06, .48);
    pivot.position.copy(pivotStart); pivot.quaternion.copy(pivotQ);
    for (const h of hinges) h.node.quaternion.copy(h.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(h.axis === 'x' ? axisX : axisZ, h.angle * buckle));
    const stagger = Math.sin(Math.PI * clamp(p / .23)) * (p < .23 ? .055 : 0) * profile.side;
    const bank = profile.flying ? Math.sin(Math.PI * p) * .12 * profile.side : 0;
    q.setFromEuler(new THREE.Euler(profile.pitch * fall, profile.yaw * fall, profile.roll * fall + stagger + bank, 'YXZ'));
    figure.getWorldQuaternion(actorQuaternion); parent.getWorldQuaternion(parentQuaternion);
    pivot.quaternion.copy(parentQuaternion).invert().multiply(actorQuaternion).multiply(q).multiply(actorQuaternion.clone().invert()).multiply(parentQuaternion);
    figure.updateWorldMatrix(true, true);
    if (p > 0) {
      const measured = bounds().min.y;
      const descent = profile.flying ? span(p, .12, .90) ** 1.35 : span(p, .06, .90);
      const desired = initialBounds.min.y * (1 - descent) + (ground + clearance) * descent;
      pivot.getWorldPosition(worldPosition); worldPosition.y += desired - measured;
      pivot.position.copy(parent.worldToLocal(worldPosition)); figure.updateWorldMatrix(true, true);
    }
    for (const { clone, opacity, emissive, transparent, depthWrite, alphaTest } of materialCopies.values()) {
      const dim = span(p, .36, 1);
      if (profile.spectral) { clone.opacity = opacity * (1 - dim * (1 - profile.finalOpacity)); clone.transparent = dim > 0 || transparent; clone.depthWrite = dim > 0 ? false : depthWrite; clone.alphaTest = dim > 0 ? 0 : alphaTest; }
      if (clone.emissive) clone.emissiveIntensity = emissive * (1 - dim * (profile.spectral ? .80 : .92));
    }
    lastSample = { phase: p, supportMinY: p === 0 ? initialBounds.min.y : bounds().min.y, groundHeight: ground, contactClearance: clearance };
    return { ...lastSample };
  }
  function reset() {
    if (cancelled || disposed) return;
    for (const h of hinges) h.node.quaternion.copy(h.quaternion);
    for (const record of originals) {
      const { node, parent: originalParent } = record; node.removeFromParent(); originalParent.add(node);
      node.position.copy(record.position); node.quaternion.copy(record.quaternion); node.scale.copy(record.scale); node.matrix.copy(record.matrix); node.matrixAutoUpdate = record.matrixAutoUpdate;
      const current = originalParent.children.indexOf(node); originalParent.children.splice(current, 1); originalParent.children.splice(record.index, 0, node);
    }
    pivot.removeFromParent();
    for (const { mesh, original } of materialRecords) mesh.material = original;
    for (const item of indicators) item.node.visible = item.visible;
    for (const material of ownedMaterials) material.dispose(); ownedMaterials.clear();
    finished = true; cancelled = true; lastSample = { phase: 0, supportMinY: initialBounds.min.y, cancelled: true }; figure.updateWorldMatrix(true, true);
  }
  const channels = ['Current-pose coherent body stagger and collapse', 'World-vertical descent from actual posed vertex bounds; navigation X/Z unchanged',
    ...hinges.map(h => `${h.node.name}: captured-pose ${h.axis}-hinge buckle/fold`),
    ...(profile.spectral ? ['Private material opacity and emissive dissipation to persistent grounded residue'] : profile.kind === 'hollow-armor' ? ['Private inner emissive fire decay; solid armor retained'] : [])];
  const handle = {
    id, profile, duration: profile.duration, status: 'prototype', channels,
    summary: { implemented: profile.description, contacts: 'Entire actor assembly and held equipment remain connected. Terrain support uses conservative captured per-mesh support-box corners, current joint transforms, scale and yaw.',
      limitations: 'Deterministic authored fall, not physics ragdoll. Knee/wing folding exists only on real semantic hinges; fused anatomy falls coherently without invented disconnected limbs. No gore, weapon release or source-asset edits.',
      capturedCurrentPose: true, sourceGeometryChanged: false, actualHingeChannels: hinges.map(h => h.node.name), renderedVertexCount: clouds.reduce((n, c) => n + c.renderedVertexCount, 0), supportPointCount:clouds.length*8 },
    get finished() { return finished; }, get disposed() { return disposed; }, get elapsed() { return elapsed; }, get lastSample() { return { ...lastSample }; },
    update(seconds) {
      if (!Number.isFinite(seconds)) throw new Error('Death time must be finite elapsed seconds.');
      if (finished || disposed) return { ...lastSample };
      elapsed = Math.min(profile.duration, Math.max(elapsed, seconds, 0)); const result = pose(elapsed); if (elapsed >= profile.duration) finished = true; return result;
    },
    sample(seconds) {
      if (!Number.isFinite(seconds)) throw new Error('Death sample time must be finite.');
      return pose(Math.max(0, seconds)); // Preview seeking never rearms the monotonic game clock.
    },
    reset,
    dispose() { if (disposed) return; reset(); disposed = true; }
  };
  if (!options.preview) ACTIVE.set(figure, handle);
  return handle;
}

export default createEnemyDeathMotion;

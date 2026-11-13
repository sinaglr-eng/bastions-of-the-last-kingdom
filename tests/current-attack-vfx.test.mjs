import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {loadCurrentDatasets} from '../tools/current-datasets.mjs';
import {Game} from '../game/core/game.js';
import {readTowerStats} from '../game/core/math.js';
import {CombatEffects,attackVisualKind,attackVisualStyle,attackVisualColor} from '../game/render/combat-effects.js';
import {factionWeaponVisual} from '../game/render/faction-attack-visuals.js';
import {CombatPathBatch,electricRadius,electricPulse} from '../game/render/combat-path-batch.js';

const datasets=loadCurrentDatasets(),rows=[];
const packet=(family,stats,id=1)=>({id,source:{id:100+id,family,tier:1,x:0,z:0},start:{x:0,z:0},target:{id:200+id,x:6,z:4},stats,progress:.5,duration:.4});
const finite=root=>root.traverse(object=>{for(const value of [...object.position.toArray(),...object.scale.toArray(),...object.quaternion.toArray()])assert.ok(Number.isFinite(value),object.name);if(object.geometry?.attributes.position)for(const value of object.geometry.attributes.position.array)assert.ok(Number.isFinite(value),object.name);if(object.isInstancedMesh)for(const value of object.instanceMatrix.array)assert.ok(Number.isFinite(value),object.name);});
const signature=root=>{const values=[];root.traverse(object=>{if(object.isInstancedMesh)values.push([...object.instanceMatrix.array],object.material.opacity);if(object.geometry?.attributes.position)values.push([...object.geometry.attributes.position.array]);});return values;};

test('all 258 active native profiles preserve authored weapon mechanisms, damage metadata and overflow styles',()=>{
  const allowed={
    'bow-shot':['arrow','venomArrow'],'spear-thrust':['thrust','stormSpear'],'sword-slash':['melee'],'dual-blade':['melee'],
    'hammer-slam':['hammer','runic'],'axe-cleave':['axe'],'pick-strike':['pick'],'rifle-shot':['bullet'],'gatling-shot':['bulletRapid'],
    'mortar-shot':['shell'],'cannon-shot':['cannon'],'grenade-throw':['grenade'],'drum-strike':['drum'],'mech-punch':['hammer'],
    'ent-slam':['treeSlam'],'spider-strike':['web','claw'],'dragon-breath':['flame'],'flamethrower-channel':['flame'],'forge-channel':['forge','flame'],
    'beak-strike':['claw','lightning'],'ballista-shot':['siege'],'catapult-shot':['siege'],'aura-channel':['flame'],
    'staff-cast':['arcane','holy','frost','roots','moon','runic','lightning'],'hand-cast':['roots','moon','lightning']
  };
  for(const [factionId,data]of Object.entries(datasets))for(const asset of data.defenderAssets){
    const source={id:1,family:asset.family,tier:asset.tier,x:0,z:0,state:'active'},stats=readTowerStats(source,data),before=structuredClone(stats),style=attackVisualStyle(source.family,stats),authored=factionWeaponVisual(source.family),native=asset.attack;
    assert.equal(authored.motion,native.motionKind,asset.family);assert.ok(authored.weapon===native.weaponGroup||asset.family==='ladyclaire'&&factionId==='crown'&&native.weaponGroup==='staff','Claire keeps the shared crozier/staff identity');
    assert.ok(allowed[native.motionKind]?.includes(style.kind),`${factionId}/${asset.family}/${asset.tier}: ${native.motionKind} -> ${style.kind}`);assert.equal(style.damageType,stats.type);
    const scene=new THREE.Scene(),fx=new CombatEffects(scene,{getStats:()=>stats,getSimulationTime:()=>1,maxDetailed:4}),overflow=new CombatEffects(new THREE.Scene(),{getStats:()=>stats,getSimulationTime:()=>1,maxDetailed:0});
    const shot={...packet(source.family,stats),source},original=structuredClone(shot);
    if(stats.damage>0){
      const detailed=fx.shot(shot);assert.ok(detailed);assert.equal(detailed.kind,style.kind);fx.syncProjectiles([shot],1);overflow.syncProjectiles([shot],1);
      assert.equal(overflow.paths.records.length,1);assert.equal(overflow.paths.records[0].kind,style.kind);assert.deepEqual(overflow.paths.records[0].style,style);assert.equal(overflow.paths.records[0].color,attackVisualColor(source.family,style.kind,stats));
      finite(scene);finite(overflow.scene);assert.deepEqual(shot,original,'VFX cannot alter actual progress, targets, numbers or timing');
    }else if(stats.continuousAttack){
      const event={source,target:shot.target,stats};fx.event('aura-attack',event);overflow.event('aura-attack',event);fx.syncProjectiles([],1);overflow.syncProjectiles([],1);assert.ok(fx.channels.size);assert.equal(overflow.paths.records[0]?.kind,'flame');finite(scene);finite(overflow.scene);
    }else if(stats.burnAura){
      const event={source,target:shot.target,stats};fx.event('aura-attack',event);overflow.event('aura-attack',event);fx.syncProjectiles([],1);overflow.syncProjectiles([],1);assert.equal(fx.channels.size,0,'aura-only profiles cannot invent a targeted flame stream');assert.equal(overflow.paths.records.length,0);assert.equal(fx.projectiles.size,0);finite(scene);
    }
    assert.deepEqual(stats,before);rows.push({factionId,unitId:asset.family,tier:asset.tier,name:data.towers[asset.family].name,model:asset.packedFile||asset.file,modelSha256:asset.sha256,motion:native.motionKind,weapon:native.weaponGroup,kind:style.kind,damageType:stats.type,element:style.element,mode:stats.continuousAttack?'continuous':stats.damage>0?'discrete':'aura-only',detailedAndOverflow:'passed'});fx.dispose();overflow.dispose();assert.equal(scene.children.length,0);
  }
  assert.equal(rows.length,258);assert.deepEqual(Object.fromEntries(Object.keys(datasets).map(id=>[id,rows.filter(r=>r.factionId===id).length])),{crown:86,forge:86,grove:86});
});

test('physical arrows, magical arrows, melee hammers and cannon keep separate shape and damage facts',()=>{
  const actual=(factionId,family)=>readTowerStats({family,tier:1},datasets[factionId]);
  for(const family of ['stormcitadel','royalarsenal']){const stats=actual('crown',family),style=attackVisualStyle(family,stats),fx=new CombatEffects(new THREE.Scene(),{getStats:()=>stats}),shot=packet(family,stats);assert.equal(style.kind,'arrow');assert.equal(style.damageType,'magical');assert.equal(style.element,'lightning');assert.ok(fx.shot(shot).object.getObjectByName('Arrow shaft'));assert.ok(fx.projectiles.get(1).object.getObjectByName('Weapon-bound electric arrowhead'));fx.dispose();}
  assert.equal(attackVisualStyle('el_grove_archer',actual('grove','el_grove_archer')).element,'physical');
  for(const family of ['winterhold','dawnspire','kingdomprotector'])assert.equal(attackVisualKind(family,actual('crown',family)),'hammer');
  for(const family of ['griffinbomber','mechanicalgolem'])assert.equal(attackVisualKind(family,actual('crown',family)),'cannon');
  assert.equal(attackVisualStyle('rimewatch',actual('crown','rimewatch')).kind,'melee');assert.equal(attackVisualStyle('rimewatch',actual('crown','rimewatch')).element,'frost');
});

test('electricity has a thick white core, wider corona, real forks and a single bounded release pulse',()=>{
  const camera=new THREE.PerspectiveCamera(38,1,.1,210);camera.position.set(7,53,41);
  let time=1;const stats=readTowerStats({family:'stormcaller',tier:1},datasets.crown),fx=new CombatEffects(new THREE.Scene(),{getStats:()=>stats,camera:()=>camera,getViewport:()=>({height:720}),getSimulationTime:()=>time}),shot=packet('stormcaller',stats);
  const record=fx.shot(shot),root=record.object;assert.equal(root.userData.electric,true);assert.equal(root.children.length,2);
  const [corona,core]=root.children;assert.equal(core.count,15);assert.equal(corona.count,15);assert.equal(core.material.color.getHexString(),'f4fdff');assert.equal(core.material.toneMapped,false);assert.equal(corona.material.depthWrite,false);
  const a=new THREE.Matrix4(),b=new THREE.Matrix4();core.getMatrixAt(0,a);corona.getMatrixAt(0,b);assert.ok(new THREE.Vector3().setFromMatrixScale(b).x>new THREE.Vector3().setFromMatrixScale(a).x*4);
  const frozen=signature(root);fx.syncProjectiles([shot],200);assert.deepEqual(signature(root),frozen,'paused simulation clock freezes geometry and intensity');
  assert.ok(electricRadius(new THREE.Vector3(),new THREE.Vector3(6,1,4),camera,720)>.03,'overview width is measured in screen pixels');
  const pulses=Array.from({length:101},(_,i)=>electricPulse(i/100));assert.ok(pulses.every((v,i)=>v>=.62&&v<=1&&(i===0||v<=pulses[i-1])),'one monotone pulse cannot become a repeating strobe');assert.equal(electricPulse(0,false),electricPulse(.9,false));
  time+=.1;fx.syncProjectiles([shot],200);assert.notDeepEqual(signature(root),frozen);fx.dispose();
});

test('reduced motion freezes detailed and overflow electrical geometry while retaining a readable signal',()=>{
  const stats=readTowerStats({family:'el_spark_adept',tier:1},datasets.grove),shots=[packet('el_spark_adept',stats,1),packet('el_spark_adept',stats,2)],fx=new CombatEffects(new THREE.Scene(),{getStats:()=>stats,maxProjectiles:1,reducedMotion:true});
  fx.syncProjectiles(shots,0);const detailed=signature(fx.projectiles.get(1).object),overflow=signature(fx.paths.object);fx.syncProjectiles(shots,999);assert.deepEqual(signature(fx.projectiles.get(1).object),detailed);assert.deepEqual(signature(fx.paths.object),overflow);assert.ok(fx.paths.batches.get('core').object.count>0);fx.dispose();
});

test('overview arrows and bullets grow only across their shaft while actual travel and packet timing stay exact',()=>{
  const camera=new THREE.PerspectiveCamera(38,1,.1,210);camera.position.set(7,53,41);
  for(const [faction,family]of [['crown','archer'],['crown','stormcitadel'],['forge','dw_musketeer']]){
    const stats=readTowerStats({family,tier:1},datasets[faction]),shot=packet(family,stats),before=structuredClone(shot),plain=new CombatEffects(new THREE.Scene(),{getStats:()=>stats}),overview=new CombatEffects(new THREE.Scene(),{getStats:()=>stats,camera:()=>camera,getViewport:()=>({height:720})});
    const a=plain.shot(shot).object,b=overview.shot(shot).object;assert.deepEqual(b.position.toArray(),a.position.toArray());assert.deepEqual(b.quaternion.toArray(),a.quaternion.toArray());assert.equal(b.scale.z,a.scale.z,'projectile length is unchanged');assert.ok(b.scale.x>a.scale.x&&b.scale.x<=3.2);assert.deepEqual(shot,before);plain.dispose();overview.dispose();
  }
});

test('busy-wave batches retain typed shapes at bounded draw counts and dispose shared geometry once',()=>{
  const scene=new THREE.Scene(),batch=new CombatPathBatch(scene,{capacity:512}),from=new THREE.Vector3(),to=new THREE.Vector3(4,1,3),kinds=['arrow','bullet','grenade','cannon','moon','melee','lightning','flame'];
  const packets=Array.from({length:600},(_,i)=>({from,to,kind:kinds[i%kinds.length],seed:i,clock:1,motion:false,color:'#a5dcff'}));batch.sync(packets);assert.equal(batch.records.length,512);assert.ok(batch.batches.size<=5);assert.ok(batch.batches.get('core').object.count>64*15+64,'flame overflow has separated hot tongues, not one solid beam');assert.ok(batch.batches.get('heads').object.count>0);assert.ok(batch.batches.get('bodies').object.count>0);finite(scene);
  const old=[...batch.batches.values()].map(r=>r.object);batch.sync(packets);assert.deepEqual([...batch.batches.values()].map(r=>r.object),old,'stable volleys reuse GPU instance buffers');
  const counts=new Map();for(const geometry of batch.geometries.values()){counts.set(geometry,0);geometry.addEventListener('dispose',()=>counts.set(geometry,counts.get(geometry)+1));}batch.dispose();batch.dispose();assert.ok([...counts.values()].every(n=>n===1));assert.equal(scene.children.length,0);
});

test('native weapon contact waits for actual arrival progress and keeps the victim altitude',()=>{
  const stats=readTowerStats({family:'dw_deepdelve',tier:1},datasets.forge),s=packet('dw_deepdelve',stats);s.target.flying=true;s.progress=.20;
  const fx=new CombatEffects(new THREE.Scene(),{getStats:()=>stats,targetHeight:()=>3.4}),before=structuredClone(s),record=fx.shot(s);
  assert.equal(record.object.visible,false,'no distant hammer contact during projectile preparation/travel');
  s.progress=.9;fx.syncProjectiles([s],1);assert.equal(record.object.visible,true);assert.equal(record.object.position.y,3.4,'flying contact is not forced onto the floor');assert.ok(record.object.getObjectByName('Blunt compression rim'));assert.equal(record.object.getObjectByName('Hammer impact stone fragment'),undefined);
  const expected={...before,progress:.9};assert.deepEqual(s,expected);fx.dispose();
});

test('continuous native flames use procedural materials, two real nozzle lanes and stop on missing simulation coverage',()=>{
  let clock=1;const stats=readTowerStats({family:'dw_flamewarden',tier:1},datasets.forge),source={id:1,family:'dw_flamewarden',state:'active',x:0,z:0},target={id:2,x:4,z:0,flying:true},anchors=[];
  const fx=new CombatEffects(new THREE.Scene(),{getStats:()=>stats,getSimulationTime:()=>clock,getMuzzle:(_s,out,options)=>{anchors.push(options);return out.set(0,1,options.lane?-.16:.16);}}),payload={source,target,stats},before=structuredClone(payload);
  fx.event('aura-attack',payload);fx.syncProjectiles([],1);assert.equal(fx.channels.size,1);const plume=fx.effects.find(e=>e.breath).object;assert.equal(plume.children.length,2);assert.ok(anchors.some(a=>a.lane===0)&&anchors.some(a=>a.lane===1));
  for(const stream of plume.children){assert.ok(stream.children[0].material.isShaderMaterial);assert.ok(stream.children[1].material.isShaderMaterial);assert.match(stream.children[0].material.fragmentShader,/noise/);assert.equal(stream.children[0].material.depthWrite,false);assert.equal(stream.userData.coneAngleDegrees,stats.continuousAttack.angleDegrees);}
  const paused=signature(plume);fx.syncProjectiles([],999);fx.update(0,999);assert.deepEqual(signature(plume),paused,'simulation clock owns pause, not caller wall time');
  clock+=.02;fx.syncProjectiles([],999);assert.equal(fx.channels.size,0);assert.equal(fx.effects.filter(e=>e.breath).length,0,'a missing native channel step stops immediately');assert.deepEqual(payload,before);fx.dispose();
});

test('weapon-consistent Ricochet retains emitted endpoints and firearm/fist identity in detail and overflow',()=>{
  for(const [family,kind]of [['dw_longrifle','bullet'],['dw_deepdelve','hammer']]){
    const stats=readTowerStats({family,tier:1},datasets.forge);assert.ok(stats.abilities.some(a=>a.familyId==='ricochet'));
    const source={id:1,family,x:0,z:0},from={id:2,x:3,z:1},to={id:3,x:5,z:2},payload={source,from,to,effect:stats.projectileEffect,visible:true},before=structuredClone(payload);
    const detailed=new CombatEffects(new THREE.Scene(),{getStats:()=>stats}),overflow=new CombatEffects(new THREE.Scene(),{getStats:()=>stats,maxDetailed:0});detailed.event('chain',payload);overflow.event('chain',payload);overflow.syncProjectiles([],0);
    assert.equal(detailed.effects[0].object.userData.ricochetKind,kind);assert.equal(detailed.effects[0].object.userData.electric,undefined);assert.deepEqual(detailed.effects[0].object.position.toArray(),[5,1,2],'secondary arrival is immediate, not delayed by a decorative flight');assert.equal(overflow.paths.records[0].kind,kind);assert.equal(overflow.paths.records[0].ricochet,true);assert.deepEqual(payload,before);
    to.hidden=true;detailed.isVisible=e=>!e.hidden;overflow.isVisible=e=>!e.hidden;detailed.update(0,0);overflow.syncProjectiles([],0);assert.equal(detailed.effects.length,0);assert.equal(overflow.paths.records.length,0);detailed.dispose();overflow.dispose();
  }
});

test('Fire Splash uses the actual source radius and emitted visible victims without creating Burn',()=>{
  const stats=readTowerStats({family:'elvenking',tier:1},datasets.crown);assert.ok(stats.burnedRadius>0);
  const source={id:1,family:'elvenking',x:0,z:0},target={id:2,x:4,z:3,statuses:{}},other={id:3,x:4.5,z:3,statuses:{}},hidden={id:4,x:4.4,z:3,statuses:{},hidden:true},payload={source,target,victims:[target,other,hidden],radius:999,amount:10,type:'physical',visible:true},before=structuredClone(payload);
  const fx=new CombatEffects(new THREE.Scene(),{getStats:()=>stats,isVisible:e=>!e.hidden});fx.event('burn-proc',payload);const eruption=fx.effects.find(e=>e.object.name==='Confirmed Fire Splash eruption');assert.ok(eruption);assert.equal(eruption.object.userData.fireSplashRadius,stats.burnedRadius);assert.deepEqual(eruption.object.userData.actualVictimIds,[2,3]);assert.equal(eruption.object.children.length,6);finite(fx.scene);assert.deepEqual(payload,before,'presentation cannot add a Burn timer or alter victims/radius/damage');
  target.hidden=true;fx.update(.02,.02);assert.equal(fx.effects.some(e=>e.object.name==='Confirmed Fire Splash eruption'),false);other.dead=true;fx.update(.02,.04);assert.equal(fx.effects.length,0,'dead/hidden victims cannot leave position-revealing residuals');fx.dispose();
  const missing=new CombatEffects(new THREE.Scene(),{getStats:()=>({})});missing.event('burn-proc',{...payload,target:{id:2,x:4,z:3},victims:[other]});assert.equal(missing.effects.length,0,'packet radius is not a fallback for missing authoritative source stats');missing.dispose();
});

test('actual lethal-primary Fire Splash preserves live-victim feedback, a fixed impact centre and bounded overflow',()=>{
  const data=datasets.crown,game=new Game(data,{seed:7}),source={id:1,family:'elvenking',tier:1,state:'active',x:10,z:10,kills:0,cooldown:999},stats=readTowerStats(source,data);game.towers=[source];game.rng=()=>0;
  const primary=game.combat.spawn('grunt'),adjacent=game.combat.spawn('grunt');
  for(const [enemy,x,hp]of [[primary,11,1],[adjacent,11.1,1e9]])Object.assign(enemy,{x,z:10,hp,maxHp:hp,speed:0,armor:0,resists:{},shields:0,evasion:0,physicalImmune:false,magicImmune:false});
  let actual;game.on((type,payload)=>{if(type==='burn-proc')actual=payload;});game.combat.impact({source,target:primary,stats});
  assert.equal(primary.dead,true);assert.ok(actual&&actual.victims.includes(adjacent)&&!adjacent.dead,'the real core emits a live secondary victim after killing the primary');
  const before=structuredClone(actual),fx=new CombatEffects(new THREE.Scene(),{getStats:()=>stats,isVisible:e=>!e.hidden}),overflow=new CombatEffects(new THREE.Scene(),{getStats:()=>stats,isVisible:e=>!e.hidden,maxDetailed:0});
  fx.event('burn-proc',actual);overflow.event('burn-proc',actual);assert.deepEqual(actual,before,'VFX cannot mutate the real emitted packet');const eruption=fx.effects.find(e=>e.object.name==='Confirmed Fire Splash eruption');assert.ok(eruption);assert.deepEqual(eruption.object.userData.actualVictimIds,[adjacent.id]);const fixed=eruption.object.position.clone(),shader=eruption.object.children[0].children[0].material,startOpacity=shader.opacity;
  primary.x+=100;fx.update(.12,.12);assert.deepEqual(eruption.object.position.toArray(),fixed.toArray(),'the known impact never follows a moving corpse');assert.ok(shader.opacity<startOpacity);assert.equal(shader.uniforms.opacity.value,shader.opacity,'procedural shader lobes fade with the same lifetime as ordinary meshes');
  overflow.syncProjectiles([],0);assert.equal(overflow.effects.length,0);assert.equal(overflow.fireSplashPaths.length,1);assert.equal(overflow.paths.records[0].kind,'fire-splash');assert.equal(overflow.paths.records[0].radius,stats.burnedRadius);assert.equal(overflow.paths.records[0].victims.length,1);finite(overflow.scene);
  // Repeated same-frame emissions coalesce; arbitrary bursts remain hard-bounded.
  for(let i=0;i<100;i++)overflow.event('burn-proc',actual);assert.equal(overflow.fireSplashPaths.length,1);
  primary.hidden=true;fx.update(.01,.13);overflow.syncProjectiles([],0);assert.equal(fx.effects.some(e=>e.object.name==='Confirmed Fire Splash eruption'),false);assert.equal(overflow.paths.records.length,0,'concealed primary cannot reveal a residual impact position');adjacent.dead=true;fx.update(.01,.14);assert.equal(fx.effects.length,0);fx.dispose();overflow.dispose();
});

test('overflow distinguishes unfused catapult stone, heavy ballista bolt, open crescent, rune, silk and flame tongues',()=>{
  const batch=new CombatPathBatch(new THREE.Scene(),{capacity:64}),from=new THREE.Vector3(),to=new THREE.Vector3(3,1,2),packets=[{kind:'siege',subtype:'catapult-stone'},{kind:'siege'},{kind:'moon'},{kind:'runic'},{kind:'web'},{kind:'flame'}].map(p=>({...p,from,to,motion:false,color:'#bda2ff',progress:.9}));batch.sync(packets);assert.equal(batch.records.length,6);assert.equal(batch.batches.get('heads').object.count,1,'only the ballista receives an ammunition point');assert.ok(batch.batches.get('shafts').object.count>20,'lunar/rune/silk shapes retain open component geometry');assert.ok(batch.batches.get('corona').object.count>8,'flame retains broken tongues');finite(batch.scene);batch.dispose();
});

if(process.env.BASTIONS_ATTACK_VFX_PROOF)process.on('beforeExit',()=>{const output=path.resolve(process.env.BASTIONS_ATTACK_VFX_PROOF);fs.mkdirSync(path.dirname(output),{recursive:true});const pins=['game/render/combat-effects.js','game/render/combat-path-batch.js','game/render/faction-attack-visuals.js','data/faction-attack-visuals.json','data/factions-v060.json'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));fs.writeFileSync(output,JSON.stringify({revision:'native-weapon-attack-vfx-current',scope:'All 258 current native V3 profiles from loadCurrentDatasets; older geometric V7/V8 fallback manifests are not the active model source.',totalProfiles:rows.length,factions:{crown:86,forge:86,grove:86},checks:['Authored model motion and weapon metadata','Independent allowed mechanism groups','Actual damage class separate from presentation element','Finite detailed and forced overflow geometry','Combat packets and stats unchanged','Bounded screen-width electric core/corona/forks with one release pulse','Paused and reduced-motion invariance','Bounded typed batches and resource disposal'],limitations:['Automated geometry/source checks do not replace browser shaded-pixel review.','Claire is one shared identity: Human source uses staff; Dwarf/Elf source uses the equivalent crozier.'],pins,profiles:rows},null,2)+'\n');});


import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Game} from '../game/core/game.js';
import {supportBonuses,towerStats} from '../game/core/math.js';
import {SupportEffects,SUPPORT_EFFECT_STYLES,ENEMY_EFFECT_STYLES,towerSupportState,supportLegend,supportSourceAreas,enemyStatusState,supportTintKey} from '../game/render/support-effects.js';
import {castleWallModel,WALL_DECK_HEIGHT} from '../game/render/walls.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const unit=(family,id=1,tier=1,x=10,z=10)=>({id,family,tier,state:'active',x,z,kills:0,cooldown:999});
const allUnits=()=>Object.entries(data.towers).flatMap(([family,s],i)=>(s.advanced?[1]:[1,2,3,4,5,6]).map(tier=>unit(family,i*10+tier,tier)));
const styleKeys=Object.keys(SUPPORT_EFFECT_STYLES);
function arena(){const g=new Game(data,{seed:7});g.phase='combat';g.combat.spawnQueue=[{time:9999,type:'grunt'}];return g;}
function foe(g,x=11,z=10){const e=g.combat.spawn('grunt');Object.assign(e,{x,z,hp:1e9,maxHp:1e9,speed:0});return e;}

test('all 87 actual defender variants display exactly the numerical supportBonuses result without changing source data',()=>{
  const before=JSON.stringify(data),towers=allUnits();assert.equal(towers.length,87);
  const found=new Set();
  for(const tower of towers){
    const state=towerSupportState(tower,towers,data);
    assert.deepEqual(state.bonuses,supportBonuses(tower,towers,data),`${tower.family} ${tower.tier}`);
    for(const effect of state.effects){found.add(effect.key);assert.ok(effect.sourceIds.length>0);assert.ok(effect.sources.every(s=>data.towers[s.family]));assert.ok(effect.label.length>0&&effect.glyph);}
  }
  assert.deepEqual([...found].sort(),['controlResistance','damage','haste','range','trueStrike'].sort());assert.equal(JSON.stringify(data),before);
});

test('strongest winners, identical ties and independent haste groups are explicit, including the actual self-support rule',()=>{
  const archer=unit('archer'),monk=unit('monk',2),priest=unit('sunward',3),cleric=unit('cleric',4,4),lowRank=unit('cleric',5,1),duplicate=unit('cleric',6,4);
  const towers=[archer,monk,priest,cleric,lowRank,duplicate],state=towerSupportState(archer,towers,data),haste=state.byKey.haste;
  assert.equal(state.bonuses.haste,2.3);assert.equal(state.bonuses.damage,1.5);assert.equal(state.bonuses.controlResistance,1);
  assert.deepEqual(haste.groups.map(g=>[g.key,g.amount]).sort(),[['opal-1',.2],['opal-4',.5],['opal-5',.6]]);
  assert.ok([2,3,4,5,6].every(id=>haste.sourceIds.includes(id)),'Different Cleric ranks have independent groups, including lower ranks');
  const scenario={...data,towers:{...data.towers,weakMonk:{...data.towers.monk,aura:{range:5,hasteGroups:{'opal-4':.3,'opal-5':.4},damageBonus:.2,controlResistance:.5}}}},weakMonk=unit('weakMonk',7);
  const winners=towerSupportState(archer,[...towers,weakMonk],scenario);assert.deepEqual(winners.bonuses,supportBonuses(archer,[...towers,weakMonk],scenario));assert.ok(winners.effects.every(e=>!e.sourceIds.includes(7)),'Weaker values in the same group are not reported as contributors');
  const self=towerSupportState(priest,[priest],data);assert.deepEqual(self.bonuses,supportBonuses(priest,[priest],data));assert.equal(self.bonuses.haste,1.6);assert.deepEqual(self.byKey.haste.sourceIds,[3]);
});

test('exact aura boundary counts; drafts, ruins, consumed sources and out-of-range sources stop immediately even before combat',()=>{
  const target=unit('archer'),source=unit('sunward',2,1,15);const towers=[target,source];
  assert.equal(towerSupportState(target,towers,data).bonuses.haste,1.6);
  source.x+=.001;assert.equal(towerSupportState(target,towers,data).effects.length,0);source.x=15;
  for(const state of ['draft','ruin']){source.state=state;assert.equal(towerSupportState(target,towers,data).effects.length,0);assert.equal(towerSupportState(source,towers,data).active,false);}
  source.state='active';assert.equal(supportLegend(target,towers,data).length,2);towers.pop();assert.equal(supportLegend(target,towers,data).length,0);
});

test('enemy dread, periodic disarm and stacking scorched barricades match the actual combat clock and resistance',()=>{
  const g=arena(),target=unit('archer'),e=foe(g),ruinA={...unit('soldier',2),state:'ruin',weakened:2},ruinB={...unit('soldier',3),state:'ruin',weakened:2};
  e.untouchable=.4;g.towers=[target,ruinA,ruinB];target.cooldown=10;g.tick(.1);
  const state=towerSupportState(target,g.towers,data,{combat:g.combat,phase:g.phase});
  assert.equal(state.byKey.dread.value,.4);assert.ok(Math.abs(state.byKey.weakened.value-(1-.85**2))<1e-10);assert.ok(Math.abs((10-target.cooldown)/.1-(1-state.byKey.dread.value)*(1-state.byKey.weakened.value))<1e-9);
  e.disarm=true;g.combat.elapsed=.23;g.tick(.01);assert.equal(target.disarmed,true);assert.equal(towerSupportState(target,g.towers,data,{combat:g.combat}).byKey.disarm.value,true);
  const paladin=unit('kingdomprotector',4);g.towers.push(paladin);g.tick(.01);const protectedState=towerSupportState(target,g.towers,data,{combat:g.combat});assert.equal(target.disarmed,false);assert.equal(protectedState.byKey.disarm,undefined);assert.equal(protectedState.byKey.dread,undefined);assert.equal(protectedState.byKey.controlResistance.value,1);
  const preview=towerSupportState(target,g.towers,data,{combat:g.combat,phase:'construction'});assert.equal(preview.byKey.weakened,undefined);
  paladin.state='ruin';e.x=14;e.disarm=false;assert.equal(towerSupportState(target,g.towers,data,{combat:g.combat}).byKey.dread,undefined,'Dread uses strict <4 distance');
});

test('selected source radii use each real rule: support, burn enhanced range, frost, armor aura, detection and reactive frost',()=>{
  for(const tower of allUnits())for(const area of supportSourceAreas(tower,data,{towers:[tower]})){assert.ok(Number.isFinite(area.radius)&&area.radius>0);assert.ok(area.keys.length&&area.label&&area.glyph);}
  const druid=unit('eldergrove',2),fire=unit('worldfire');assert.equal(supportSourceAreas(fire,data,{towers:[fire,druid]}).find(a=>a.key==='burn').radius,towerStats(fire,data).range+3);
  const bomber=unit('royalmarshal');assert.equal(supportSourceAreas(bomber,data).find(a=>a.key==='armor').radius,4);
  assert.equal(supportSourceAreas(unit('cleric'),data).find(a=>a.key==='detection').radius,6);
  assert.equal(supportSourceAreas(unit('archangel'),data).find(a=>a.key==='reaction').radius,6);
  assert.equal(supportSourceAreas({...bomber,state:'draft'},data).length,0);
});

test('all persistent enemy statuses and effective debuff auras have distinct glyphs; immunity and boss slowing match core',()=>{
  const g=arena(),e=foe(g),mechanical=unit('mechanicalgolem'),winter=unit('winterhold',2);g.towers=[mechanical,winter];g.tick(.01);
  let effects=enemyStatusState(e,g.towers,data);assert.equal(effects.find(s=>s.key==='armor').value,e.armorShred);assert.equal(effects.find(s=>s.key==='slow').value,.75);
  e.magicImmune=true;effects=enemyStatusState(e,g.towers,data);assert.equal(effects.find(s=>s.key==='slow'),undefined);assert.equal(effects.find(s=>s.key==='armor').value,30,'Mechanical Golem aura pierces magic immunity');
  e.magicImmune=false;e.boss=true;effects=enemyStatusState(e,g.towers,data);assert.equal(effects.find(s=>s.key==='slow').value,.375);
  e.statuses={slow:{amount:.2,time:3},gazeSlow:{amount:.8,time:3},shred:{amount:40,time:3},shredMagic:{amount:.3,time:3},freeze:{time:2},petrify:{time:2},poison:{time:3,dps:20},burn:{time:3,dps:10},bleed:{time:3,dps:5},healBlock:{time:2}};
  effects=enemyStatusState(e,g.towers,data);assert.deepEqual(effects.map(s=>s.key).sort(),Object.keys(ENEMY_EFFECT_STYLES).sort());assert.equal(effects.find(s=>s.key==='slow').value,.4);assert.equal(effects.find(s=>s.key==='armor').value,40);
  e.dead=true;assert.deepEqual(enemyStatusState(e,g.towers,data),[]);
});

test('owned instanced overlays have bounded counts, visible independent glyph geometry, no picking and no hidden-enemy leaks',()=>{
  const scene=new THREE.Scene(),fx=new SupportEffects(scene,{baseHeight:1,position:(x,y,z)=>new THREE.Vector3(x-18,y,z-18),isVisible:e=>!e.cloaked,maxTowers:4,maxEnemies:3}),target=unit('archer'),support=unit('monk',2),nature=unit('mothernature',3);
  const towers=[target,support,nature,...Array.from({length:10},(_,i)=>unit('archer',20+i))],enemies=Array.from({length:12},(_,i)=>({id:i,x:10,z:10,statuses:{poison:{time:2,dps:5}},dead:false,cloaked:i===0}));
  fx.sync(towers,data,{selected:support,combat:{enemies,elapsed:0},phase:'combat'});assert.equal(fx.batches.size,20);assert.equal(fx.group.children.length,22);
  assert.equal(fx.batches.get('haste').count,4);assert.equal(fx.batches.get('enemy:poison').count,3);assert.equal(fx.enemyStates.has(0),false);assert.ok(fx.radius.visible);assert.equal(fx.tint.count,4);
  const signatures=new Set();for(const key of styleKeys){const mesh=fx.batches.get(key);signatures.add(Array.from(mesh.geometry.attributes.position.array).join(','));assert.equal(mesh.geometry.userData.glyph,SUPPORT_EFFECT_STYLES[key].glyph);assert.ok(mesh.geometry.userData.glyphVertexStart>0);}
  assert.equal(signatures.size,9,'Shapes differ as well as colors');
  fx.group.traverse(o=>{assert.equal(o.raycast(),undefined);assert.ok(!o.isLight);if(o.geometry)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));if(o.material)assert.equal(o.material.depthWrite,false);});
  const position=fx.radius.geometry.attributes.position;fx.sync(towers,data,{selected:nature});assert.equal(fx.radius.geometry.attributes.position,position,'Selected radius buffer is reused');
  support.state='ruin';nature.state='draft';fx.sync(towers,data);assert.ok([...fx.batches.values()].every(m=>m.count===0));assert.equal(fx.radius.visible,false);assert.equal(fx.tint.count,0);fx.dispose();
});

test('actual periodic disarm has one hovering broken sword and matching bounded red aura only while combat blocks attacks',()=>{
  const g=arena(),target=unit('archer'),enemy=foe(g),fx=new SupportEffects(new THREE.Scene(),{pedestalHeight:.8});g.towers=[target];enemy.disarm=true;enemy.cloaked=true;
  const orbit=fx.batches.get('disarm:orbit'),aura=fx.batches.get('disarm:aura'),matrix=new THREE.Matrix4();
  const sample=elapsed=>{g.combat.elapsed=elapsed;g.combat.update(0);fx.sync(g.towers,data,{combat:g.combat,phase:g.phase,time:elapsed});};
  try{
    sample(.23);assert.equal(target.disarmed,true);assert.equal(orbit.count,1);assert.equal(aura.count,1);
    assert.equal(orbit.geometry.userData.glyph,'brokenSword');assert.equal(orbit.material.color.getHex(),new THREE.Color(SUPPORT_EFFECT_STYLES.disarm.color).getHex());
    orbit.getMatrixAt(0,matrix);const first=matrix.clone(),centre=new THREE.Vector3().setFromMatrixPosition(matrix);
    assert.ok(centre.y>fx.pedestalHeight+.85&&centre.y<fx.pedestalHeight+1);
    assert.ok(Math.abs(Math.hypot(centre.x-target.x,centre.z-target.z)-.65)<1e-5);
    orbit.geometry.computeBoundingBox();assert.ok(orbit.geometry.boundingBox.getSize(new THREE.Vector3()).y>.5,'The hovering marker is a physical sword silhouette');
    assert.ok(aura.geometry.parameters.outerRadius<.8,'Aura stays local to its affected defender');
    fx.update(.23);orbit.getMatrixAt(0,matrix);assert.deepEqual(matrix.elements,first.elements,'Paused simulation keeps the complete orbit still');
    fx.update(.45);orbit.getMatrixAt(0,matrix);assert.notDeepEqual(matrix.elements,first.elements);
    fx.update(1,{reducedMotion:true});const still=Array.from(orbit.instanceMatrix.array);fx.update(100,{reducedMotion:true});assert.deepEqual(Array.from(orbit.instanceMatrix.array),still);
    sample(1.25-enemy.id*.37);assert.equal(target.disarmed,false);assert.equal(orbit.count,0);assert.equal(aura.count,0,'No lingering aura after the actual disarm window');
    sample(8.23);assert.equal(target.disarmed,true);assert.equal(orbit.count,1,'A later real window reactivates exactly once');
    g.towers.push(unit('kingdomprotector',9));sample(8.24);assert.equal(target.disarmed,false);assert.equal(orbit.count,0);assert.equal(aura.count,0);
    g.towers.pop();enemy.dead=true;sample(8.25);assert.equal(orbit.count,0);
    enemy.dead=false;g.phase='ready';sample(8.26);assert.equal(orbit.count,0);assert.equal(aura.count,0);
  }finally{fx.dispose();}
});

test('reduced motion freezes instance matrices/materials; cleanup is idempotent and never mutates defender materials',()=>{
  const scene=new THREE.Scene(),fx=new SupportEffects(scene),towers=[unit('archer'),unit('monk',2)];fx.sync(towers,data,{selected:towers[1]});
  fx.update(3,{reducedMotion:true});const snapshot=()=>[...fx.batches.values()].map(o=>({matrix:Array.from(o.instanceMatrix.array),opacity:o.material.opacity})),still=snapshot();fx.update(10000,{reducedMotion:true});assert.deepEqual(snapshot(),still);
  fx.update(NaN);for(const mesh of fx.batches.values())assert.ok(mesh.instanceMatrix.array.every(Number.isFinite));
  const resources=new Set(),counts=new Map();fx.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});for(const r of resources){counts.set(r,0);r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));}
  const cachedMaterial=new THREE.MeshStandardMaterial({color:'#3b6298'}),before=cachedMaterial.color.getHex();fx.dispose();fx.dispose();fx.sync(towers,data);fx.update(2);
  assert.equal(scene.children.length,0);assert.ok([...counts.values()].every(n=>n===1));assert.equal(cachedMaterial.color.getHex(),before);cachedMaterial.dispose();
});

test('wall-cap edge tint leaves stone paving unobstructed, uses one stable hue, and covers negative-only defenders without mutating GLB materials',async()=>{
  const bytes=readFileSync(new URL('../public/assets/models/human_cleric_t1.glb',import.meta.url)),template=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  const cached=new Set();template.traverse(o=>{if(o.material)cached.add(o.material);});
  const before=[...cached].map(m=>[m.color?.getHex(),m.opacity,m.transparent]);
  const scene=new THREE.Scene();scene.add(template.clone(true));
  const fx=new SupportEffects(scene,{baseHeight:1.4,pedestalHeight:1.2}),target=unit('archer'),support=unit('monk',2),nature=unit('mothernature',3),towers=[target,support,nature];
  const geometry=fx.tint.geometry,material=fx.tint.material;geometry.computeBoundingBox();
  const size=geometry.boundingBox.getSize(new THREE.Vector3());assert.ok(Math.abs(size.x-.97)<1e-6&&Math.abs(size.z-.97)<1e-6&&Math.abs(size.y-.12)<1e-6);
  assert.ok(material.opacity>0&&material.opacity<=.18,'The exposed edge tint remains subtle');assert.equal(material.depthWrite,false);assert.equal(material.side,THREE.FrontSide);
  fx.sync(towers,data);assert.equal(fx.tint.count,3);const matrix=new THREE.Matrix4();fx.tint.getMatrixAt(0,matrix);assert.ok(geometry.boundingBox.clone().applyMatrix4(matrix).max.y<fx.pedestalHeight,'Tint cannot occupy the fighting deck or the defender soles');
  const platform=castleWallModel(0,true);platform.position.set(target.x,fx.pedestalHeight-WALL_DECK_HEIGHT,target.z);platform.updateMatrixWorld(true);
  const tintSurface=new THREE.Mesh(geometry,material);tintSurface.matrixAutoUpdate=false;tintSurface.matrix.copy(matrix);tintSurface.updateMatrixWorld(true);
  for(const x of [-.3,0,.3])for(const z of [-.3,0,.3]){
    const hit=new THREE.Raycaster(new THREE.Vector3(target.x+x,fx.pedestalHeight+.1,target.z+z),new THREE.Vector3(0,-1,0)).intersectObjects([platform,tintSurface],true)[0];
    assert.ok(hit&&hit.object!==tintSurface&&Math.abs(hit.point.y-fx.pedestalHeight)<1e-6,'Actual level stone stays in front of the color band');
  }
  platform.traverse(node=>node.geometry?.dispose());
  const color=new THREE.Color();fx.tint.getColorAt(0,color);
  const expected=new THREE.Color(SUPPORT_EFFECT_STYLES.haste.color);assert.ok(Math.abs(color.r-expected.r)<1e-6&&Math.abs(color.g-expected.g)<1e-6&&Math.abs(color.b-expected.b)<1e-6);assert.equal(supportTintKey(fx.states.get(target.id)),'haste');assert.equal(fx.states.get(target.id).effects.length,5,'Other simultaneous glyphs stay present');
  fx.sync([target],data,{combat:{elapsed:0,enemies:[{id:1,x:11,z:10,untouchable:.4,disarm:true}]},phase:'combat'});assert.equal(fx.tint.count,1);assert.equal(supportTintKey(fx.states.get(target.id)),'dread');fx.tint.getColorAt(0,color);const danger=new THREE.Color(SUPPORT_EFFECT_STYLES.dread.color);assert.ok(Math.abs(color.r-danger.r)<1e-6&&Math.abs(color.b-danger.b)<1e-6);
  assert.equal(fx.tint.geometry,geometry);assert.equal(fx.tint.material,material);fx.dispose();assert.deepEqual([...cached].map(m=>[m.color?.getHex(),m.opacity,m.transparent]),before);
  const resources=new Set();template.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});for(const resource of resources)resource.dispose();
});

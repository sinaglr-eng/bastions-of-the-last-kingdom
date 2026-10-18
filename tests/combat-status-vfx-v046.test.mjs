import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignEnemies,campaignWaves,campaignRecipes} from '../game/core/campaign-roster.js';
import {towerStats} from '../game/core/math.js';
import {SupportEffects,enemyStatusState} from '../game/render/support-effects.js';
import {CombatStatusVfx} from '../game/render/combat-status-vfx.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url),'utf8'))]));
const data={...raw,towers:campaignTowers(raw.towers),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves),recipes:campaignRecipes(raw.recipes)};
const unit=(family,id=100,tier=1)=>({id,family,tier,state:'active',x:10,z:10,kills:0,cooldown:999});
function arena(options={}){
  const game=new Game(data,{seed:4607});game.phase='combat';game.combat.spawnQueue=[{time:99999,type:'host_01'}];
  const scene=new THREE.Scene(),visible=enemy=>game.combat.isRevealed(enemy),support=new SupportEffects(scene,{isVisible:visible});
  const fx=new CombatStatusVfx(scene,{isVisible:visible,targetHeight:enemy=>enemy.flying?2.6:.8,getTime:()=>game.combat.elapsed,...options}),events=[];
  game.on((type,payload)=>{events.push({type,payload});fx.event(type,payload);});
  const sync=extra=>{support.sync(game.towers,data,{combat:game.combat,phase:game.phase,time:game.combat.elapsed});fx.sync(game.combat.enemies,{states:support.enemyStates,time:game.combat.elapsed,...extra});};
  const foe=(extra={})=>{const enemy=game.combat.spawn('host_01');Object.assign(enemy,{x:11,z:10,hp:1e9,maxHp:1e9,speed:0,armor:0,shields:0,refraction:0,evasion:0,krakenShell:0,magicImmune:false,physicalImmune:false,cloaked:false,stealth:false,cloakDaggers:false,regen:0,recharge:0,boss:false,...extra});return enemy;};
  return {game,scene,support,fx,events,sync,foe,dispose(){fx.dispose();support.dispose();}};
}
const hit=(game,source,target,override={})=>game.combat.impact({source,target,stats:{...towerStats(source,data),...override}});
const count=(fx,kind)=>fx.batches.get(kind)?.count||0;
const positions=(fx,kind)=>{const batch=fx.batches.get(kind),matrix=new THREE.Matrix4();return Array.from({length:batch?.count||0},(_,i)=>{batch.getMatrixAt(i,matrix);return new THREE.Vector3().setFromMatrixPosition(matrix).toArray();});};
const matrices=fx=>[...fx.batches].map(([kind,batch])=>[kind,batch.count,Array.from(batch.instanceMatrix.array.slice(0,batch.count*16))]);

test('real poison applications reconcile into one bounded target cloud; expiry, cloak and actual death remove it',()=>{
  const h=arena(),{game,fx}=h,source=unit('druid');game.towers=[source];const enemy=h.foe();
  try{
    hit(game,source,enemy);h.sync();assert.equal(enemy.statuses.poison.stacks,1);assert.ok(h.support.enemyStates.get(enemy.id).some(row=>row.key==='poison'));assert.deepEqual(fx.targets.get(enemy.id),['poison']);const initial=count(fx,'poison');assert.ok(initial>=2&&initial<=4);
    hit(game,source,enemy);hit(game,source,enemy);h.sync();assert.equal(enemy.statuses.poison.stacks,3);assert.deepEqual(fx.targets.get(enemy.id),['poison']);assert.equal(count(fx,'poison'),initial,'Stacks do not allocate one cloud per source/application');
    enemy.x=0;enemy.z=0;enemy.stealth=true;game.combat.update(0);assert.equal(game.combat.isRevealed(enemy),false);h.sync();assert.equal(count(fx,'poison'),0);assert.equal(fx.targets.has(enemy.id),false);
    enemy.stealth=false;game.combat.update(0);h.sync();assert.equal(count(fx,'poison'),initial,'Still-active real infection becomes visible when the target is revealed');
    game.combat.update(5.001);h.sync();assert.equal(enemy.statuses.poison,undefined);assert.equal(count(fx,'poison'),0);
    enemy.x=11;enemy.z=10;hit(game,source,enemy);h.sync();assert.ok(count(fx,'poison')>0);game.combat.resolveDamage(enemy,enemy.hp+1,'holy',{},source);h.sync();assert.equal(enemy.dead,true);assert.equal(count(fx,'poison'),0);assert.equal(fx.targets.has(enemy.id),false);
  }finally{h.dispose();}
});

test('immune, shielded and evaded actual poison contacts never establish an infection visual',()=>{
  for(const defense of [{magicImmune:true},{shields:1},{evasion:1}]){
    const h=arena(),source=unit('druid');h.game.towers=[source];const enemy=h.foe(defense);
    try{hit(h.game,source,enemy);h.sync();assert.equal(enemy.statuses.poison,undefined);assert.equal(count(h.fx,'poison'),0);assert.equal(h.fx.targets.has(enemy.id),false);assert.ok(h.events.some(row=>row.type==='damage-trace'&&row.payload.effectiveDamage===0));}finally{h.dispose();}
  }
});

test('actual burning status stays distinct from a continuously applied fire aura and its heat victims',()=>{
  const burn=arena(),ballista=unit('fireballista');burn.game.towers=[ballista];const burned=burn.foe();
  try{hit(burn.game,ballista,burned);burn.sync();assert.ok(burned.statuses.burn.time>0);assert.ok(burn.support.enemyStates.get(burned.id).some(row=>row.key==='burn'));assert.ok(count(burn.fx,'burn')>0);assert.equal(count(burn.fx,'heat'),0);burn.game.combat.update(3.001);burn.sync();assert.equal(count(burn.fx,'burn'),0);}finally{burn.dispose();}
  const aura=arena(),dragon=unit('embercrown');aura.game.towers=[dragon];const warm=aura.foe(),immune=aura.foe({magicImmune:true});
  try{
    aura.game.combat.update(.01);const traces=aura.events.filter(row=>row.type==='damage-trace'&&row.payload.source===dragon&&row.payload.effect==='fire'&&row.payload.effectiveDamage>0&&row.payload.visible).map(row=>row.payload.enemy.id);assert.deepEqual(traces,[warm.id]);
    aura.sync({heatTargets:new Set(traces)});assert.equal(warm.statuses.burn,undefined);assert.equal(immune.statuses.burn,undefined);assert.equal(count(aura.fx,'burn'),0);assert.ok(count(aura.fx,'heat')>0);assert.deepEqual(aura.fx.targets.get(warm.id),['heat']);assert.equal(aura.fx.targets.has(immune.id),false);
    dragon.attackPaused=true;aura.events.length=0;aura.game.combat.update(.01);aura.sync({heatTargets:new Set()});assert.equal(count(aura.fx,'heat'),0);assert.equal(aura.events.some(row=>row.type==='damage-trace'),false);
  }finally{aura.dispose();}
});

test('actual slow, stun and Golem petrification have distinct priority while flying cues follow the model body',()=>{
  const h=arena(),frost=unit('frostwarden'),golem=unit('emeraldgolem',101);h.game.towers=[frost,golem];const enemy=h.foe({flying:true});
  const figure=new THREE.Group();figure.position.set(enemy.x,1.8,enemy.z);figure.scale.setScalar(.8);figure.userData.body=new THREE.Group();figure.userData.barHeight=1.6;h.scene.add(figure);const figures=new Map([[enemy.id,figure]]);
  try{
    hit(h.game,frost,enemy);h.sync({figures});assert.ok(enemy.statuses.slow.amount>0);assert.ok(count(h.fx,'slow')>0);assert.ok(positions(h.fx,'slow').every(([,y])=>y>1.8),'Flying status bands stay at body altitude');assert.equal(count(h.fx,'freeze'),0);assert.equal(count(h.fx,'petrify'),0);
    const seeded=h.game.rng;h.game.rng=()=>0;h.game.combat.applyEffects(enemy,{...towerStats(golem,data),freeze:1,freezeDuration:.2},golem);h.game.rng=seeded;h.sync({figures});assert.ok(count(h.fx,'freeze')>0);assert.equal(count(h.fx,'slow'),0);
    h.game.combat.update(.21);h.sync({figures});assert.equal(count(h.fx,'freeze'),0);assert.ok(count(h.fx,'slow')>0);
    h.game.rng=()=>0;h.game.combat.landedProcs({...towerStats(golem,data),stoneGazeChance:1},golem);h.game.rng=seeded;enemy.route=[{x:11,z:10},{x:10,z:10}];enemy.pathIndex=1;h.game.combat.updateStoneGazes(2.01);h.sync({figures});assert.ok(enemy.statuses.petrify.time>0);assert.ok(enemyStatusState(enemy,h.game.towers,data).some(row=>row.key==='petrify'));assert.equal(count(h.fx,'petrify'),1);assert.equal(count(h.fx,'slow'),0);
  }finally{figure.removeFromParent();h.dispose();}
});

test('successful primary electricity flashes locally on its actual hit frame at high speed; blocks never flash',()=>{
  const h=arena(),storm=unit('stormcaller');storm.cooldown=0;h.game.towers=[storm];const enemy=h.foe();
  try{
    h.sync();h.game.speed=5;h.game.tick(.06);h.sync();assert.equal(h.game.combat.elapsed,.3);assert.ok(h.events.some(row=>row.type==='damage-trace'&&row.payload.effectiveDamage>0));assert.equal(count(h.fx,'flash'),1,'A real electric primary survives its first .3s frame rather than expiring against last sync time');assert.equal(h.fx.pulses.get('flash:'+enemy.id).at,h.game.combat.elapsed);
    storm.cooldown=999;h.game.combat.update(.21);h.sync();assert.equal(count(h.fx,'flash'),0);
  }finally{h.dispose();}
  for(const defense of [{magicImmune:true},{shields:1},{evasion:1},{krakenShell:1e6}]){
    const blocked=arena(),source=unit('stormcaller');blocked.game.towers=[source];const target=blocked.foe(defense);
    try{hit(blocked.game,source,target);blocked.sync();assert.equal(count(blocked.fx,'flash'),0);assert.equal(blocked.fx.pulses.size,0);}finally{blocked.dispose();}
  }
});

test('actual positive healing pulses distinguish regeneration/recharge and respect full health, block and simultaneous damage',()=>{
  for(const scenario of [
    {regen:.2,hp:50,expected:true,cause:'regeneration'},
    {regen:.2,hp:100,expected:false},
    {regen:.2,hp:50,block:true,expected:false},
    {recharge:.5,rechargeClock:.1,hp:50,expected:true,cause:'recharge'},
    {recharge:.5,rechargeClock:.1,hp:50,block:true,expected:false},
    {regen:.2,hp:50,poison:true,expected:true,cause:'regeneration'},
  ]){
    const h=arena(),source=unit('druid');h.game.towers=[source];const enemy=h.foe({maxHp:100,...scenario});
    try{
      if(scenario.block)h.game.combat.applyEffects(enemy,{healingBlockDuration:1},source);
      if(scenario.poison)hit(h.game,source,enemy,{damage:1,poisonDps:30});
      const before=enemy.hp;h.game.combat.update(.1);h.sync();const heals=h.events.filter(row=>row.type==='enemy-heal');assert.equal(heals.length>0,scenario.expected);assert.equal(count(h.fx,'heal')>0,scenario.expected);
      assert.ok(heals.every(row=>row.payload.amount>0));if(scenario.expected){assert.ok(heals.some(row=>row.payload.cause===scenario.cause));assert.equal(h.fx.pulses.get('heal:'+enemy.id).color,scenario.cause==='recharge'?'#63e7d4':'#a5e9a5');}
      if(scenario.poison)assert.ok(enemy.hp<before,'The positive healing event survives a net-negative HP frame');
    }finally{h.dispose();}
  }
});

test('global pause, speed and reduced motion use one combat clock without changing status durations',()=>{
  const h=arena({reducedMotion:true}),source=unit('druid');h.game.towers=[source];const enemy=h.foe();
  try{
    hit(h.game,source,enemy);h.sync();const still=matrices(h.fx);h.game.speed=3;h.game.tick(.02);h.sync();assert.equal(h.game.combat.elapsed,.06);assert.equal(enemy.statuses.poison.time,4.94);assert.deepEqual(matrices(h.fx),still,'Reduced motion removes repeated status drift without stopping real expiry');
    h.game.paused=true;const clock=h.game.combat.elapsed,status=structuredClone(enemy.statuses),paused=matrices(h.fx);h.game.tick(.5,10);h.sync();assert.equal(h.game.combat.elapsed,clock);assert.deepEqual(enemy.statuses,status);assert.deepEqual(matrices(h.fx),paused);
    h.game.paused=false;h.game.tick(5/3);h.sync();assert.equal(enemy.statuses.poison,undefined);assert.equal(count(h.fx,'poison'),0);
  }finally{h.dispose();}
});

test('actual successful volleys coalesce by target and respect the pulse cap, leaks and ended-run cleanup',()=>{
  const h=arena({maxInstances:3}),source=unit('stormcaller');h.game.towers=[source];const enemy=h.foe();
  try{
    for(let i=0;i<4;i++)h.game.combat.resolveDamage(enemy,1,'magical',{effect:'lightning'},source);
    h.sync();assert.equal(h.fx.pulses.size,1);assert.equal(count(h.fx,'flash'),1);
    for(let i=0;i<8;i++)h.game.combat.resolveDamage(h.foe(),1,'magical',{effect:'lightning'},source);
    h.sync();assert.equal(h.fx.pulses.size,3);assert.equal(count(h.fx,'flash'),3);assert.ok(h.fx.count<=3);
    const leaking=[...h.fx.pulses.values()][0].enemy;leaking.route=[{x:leaking.x,z:leaking.z}];leaking.pathIndex=1;h.game.combat.update(0);h.sync();assert.equal(leaking.dead,true);assert.ok(h.events.some(row=>row.type==='leak'&&row.payload.enemy===leaking));assert.ok([...h.fx.pulses.values()].every(row=>row.enemy!==leaking));
    h.game.end(false);assert.equal(h.fx.pulses.size,0);assert.equal(h.fx.targets.size,0);assert.equal(h.fx.count,0);assert.ok([...h.fx.batches.values()].every(batch=>!batch.visible&&batch.count===0));
  }finally{h.dispose();}
});

test('visual reconciliation is bounded, read only, RNG-independent and disposes only its separately owned resources',()=>{
  const h=arena({maxInstances:5}),source=unit('druid');h.game.towers=[source];for(let i=0;i<12;i++)hit(h.game,source,h.foe({x:11+i*.01}));
  const modelGeometry=new THREE.BoxGeometry(1,1,1),modelMaterial=new THREE.MeshStandardMaterial({color:'#456789'}),model=new THREE.Mesh(modelGeometry,modelMaterial);h.scene.add(model);let originalDisposals=0;modelGeometry.addEventListener('dispose',()=>originalDisposals++);modelMaterial.addEventListener('dispose',()=>originalDisposals++);
  try{
    const snapshot=()=>structuredClone({data:h.game.data,towers:h.game.towers,enemies:h.game.combat.enemies,projectiles:h.game.combat.projectiles,elapsed:h.game.combat.elapsed,lives:h.game.lives,kills:h.game.kills,gold:h.game.economy.gold}),before=snapshot(),seeded=h.game.rng;h.game.rng=()=>{throw Error('Presentation consumed Game.rng');};h.sync();assert.deepEqual(snapshot(),before);assert.ok(h.fx.count<=5);assert.ok([...h.fx.batches.values()].reduce((sum,batch)=>sum+batch.count,0)<=5);assert.ok([...h.fx.batches.values()].every(batch=>batch.material.depthWrite===false&&batch.raycast()===undefined));assert.ok(h.scene.children.every(object=>!object.isLight));
    const resources=new Set([...h.fx.batches.values()].flatMap(batch=>[batch,batch.geometry,batch.material])),disposed=new Map([...resources].map(resource=>[resource,0]));for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));h.fx.dispose();h.fx.dispose();assert.ok([...disposed.values()].every(value=>value===1));assert.equal(h.fx.batches.size,0);assert.equal(h.fx.pulses.size,0);assert.equal(h.fx.targets.size,0);assert.equal(originalDisposals,0);assert.ok(h.scene.children.includes(model));h.fx.sync(h.game.combat.enemies,{states:h.support.enemyStates,time:100});assert.equal(h.fx.count,0);h.game.rng=seeded;
  }finally{h.dispose();model.removeFromParent();modelGeometry.dispose();modelMaterial.dispose();}
});

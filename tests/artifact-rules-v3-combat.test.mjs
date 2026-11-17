import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {equipArtifactSet} from '../game/core/artifacts.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {artifactPrimaryContact,artifactDamageMultiplier,refreshArtifactTimedStatuses,updateArtifactDots} from '../game/core/artifact-combat.js';
import {applyCanonicalControlContact,fr002Impact,updateFr002Tower} from '../game/core/fr002-combat.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
const set=id=>equipArtifactSet({},id);
function scene(equipment={},version='fr011-v3',faction='crown'){
 const data=currentFactionData(faction),game=new Game(data,{seed:42,artifactEquipment:equipment,artifactVersion:version});
 game.place(18,18);const tower=game.towers[0];tower.state='active';tower.attackPaused=true;game.phase='combat';
 const combat=game.combat;combat.spawnQueue=[{time:1e9}];
 const enemy=combat.spawn('host_01');Object.assign(enemy,{x:19,z:18,hp:1e6,maxHp:1e6,speed:0,armor:0,physicalImmune:false,magicImmune:false});
 return {game,combat,tower,enemy,data};
}
const primaryStats={fr002:true,damage:100,type:'physical',range:10,abilities:[],projectileEffect:'arrow',projectileSpeed:10};
function primary(h,enemy=h.enemy,firstPrimary=true){
 fr002Impact(h.combat,{source:h.tower,target:enemy,stats:primaryStats,firstPrimary,releaseCount:1,directTargets:[enemy]});
}

test('V3 Mirror follows actual Slow Aura, Sky Hunt and War Horn, not a Root/Stun marker',()=>{
 const h=scene({offhand:'WC-04'});h.tower.family='winterhold';h.tower.attackPaused=false;
 near(artifactDamageMultiplier(h.game,h.enemy),1.05);
 h.enemy.physicalImmune=true;near(artifactDamageMultiplier(h.game,h.enemy),1);
 h.tower.attackPaused=true;h.enemy.physicalImmune=false;
 h.enemy.statuses.root={time:2};h.enemy.statuses.stun={time:2};near(artifactDamageMultiplier(h.game,h.enemy),1);
 h.game.general.loadout={'war-horn':1};h.game.commandPoints.value=3;assert.ok(h.game.general.activate('war-horn'));near(artifactDamageMultiplier(h.game,h.enemy),1.05);
 h.game.general.active={};h.enemy.statuses.freeze={time:.5};near(artifactDamageMultiplier(h.game,h.enemy),1.05);
 const sky=scene({offhand:'WC-04'},'fr011-v3','forge');sky.tower.family='dw_griffinhandler';sky.tower.attackPaused=false;
 sky.enemy.flying=true;near(artifactDamageMultiplier(sky.game,sky.enemy),1.05);
 sky.enemy.flying=false;near(artifactDamageMultiplier(sky.game,sky.enemy),1);
 const old=scene({offhand:'WC-04'},'fr011-v2');old.tower.family='winterhold';old.tower.attackPaused=false;old.game.general.loadout={'war-horn':1};old.game.commandPoints.value=3;assert.ok(old.game.general.activate('war-horn'));
 near(artifactDamageMultiplier(old.game,old.enemy),1);
});

test('V3 native poison enables Blightweave antiheal and a stronger native reduction still wins',()=>{
 for(const [version,reduction,expected]of [['fr011-v3',0,70],['fr011-v2',0,75],['fr011-v3',.5,62.5]]){
  const h=scene({chest:'VC-05'},version);Object.assign(h.enemy,{hp:50,maxHp:100,regen:.25});
  h.enemy.statuses.poison={time:2,dps:0,source:h.tower};if(reduction)h.enemy.statuses.regenReduction={time:2,amount:reduction};
  h.combat.update(1);near(h.enemy.hp,expected);
 }
 const immune=scene({chest:'VC-05'});Object.assign(immune.enemy,{hp:50,maxHp:100,regen:.25,magicImmune:true});
 immune.enemy.statuses.poison={time:2,dps:0,source:immune.tower};immune.combat.update(1);near(immune.enemy.hp,75);
 const expiry=scene({chest:'VC-05'});Object.assign(expiry.enemy,{hp:50,maxHp:100,regen:.25});
 expiry.enemy.statuses.poison={time:2,dps:0,source:expiry.tower};expiry.enemy.statuses.regenReduction={time:.5,amount:.5};
 expiry.combat.update(1);near(expiry.enemy.hp,66.25,'A weaker artifact antiheal cannot lend its duration to stronger native antiheal.');
});

test('V3 a weaker Slow cannot extend native Slow, including across save/restore',()=>{
 const h=scene({ring1:'WC-02'});h.combat.applyEffects(h.enemy,{slow:.8,slowDuration:1},h.tower);
 h.combat.elapsed=.5;artifactPrimaryContact(h.combat,{enemy:h.enemy,effectiveDamage:10},{},h.tower);
 near(h.enemy.statuses.slow.amount,.8);
 const snapshot=serializeRun(h.game),copy=restoreRun(h.data,JSON.parse(JSON.stringify(snapshot)));
 assert.deepEqual(serializeRun(copy),snapshot);
 for(const game of [h.game,copy]){
  game.combat.elapsed=1.1;const enemy=game.combat.enemies[0];refreshArtifactTimedStatuses(game.combat,enemy);
  near(enemy.statuses.slow.amount,.08);near(enemy.statuses.slow.time,1.4);
  game.combat.elapsed=2.5;refreshArtifactTimedStatuses(game.combat,enemy);assert.equal(enemy.statuses.slow,undefined);
 }
});

test('V3 keeps independent strengths from the same source and independent armor expiries',()=>{
 const h=scene({gloves:'N-09'});
 h.combat.applyEffects(h.enemy,{slow:.8,slowDuration:1,shred:45,shredDuration:1},h.tower);
 h.combat.elapsed=.5;h.combat.applyEffects(h.enemy,{slow:.2,slowDuration:3,shred:5,shredDuration:3},h.tower);
 artifactPrimaryContact(h.combat,{enemy:h.enemy,effectiveDamage:10},{},h.tower);
 near(h.enemy.statuses.slow.amount,.8);h.combat.prepareArmor(h.enemy);near(h.enemy.armorShred,45);
 h.combat.elapsed=1.1;refreshArtifactTimedStatuses(h.combat,h.enemy);h.combat.prepareArmor(h.enemy);
 near(h.enemy.statuses.slow.amount,.2);near(h.enemy.armorShred,5);
 h.combat.elapsed=3.5;refreshArtifactTimedStatuses(h.combat,h.enemy);h.combat.prepareArmor(h.enemy);
 assert.equal(h.enemy.statuses.slow,undefined);near(h.enemy.armorShred,0);
});

test('V3 artifact Freeze preserves the native control channel and longer native Freeze takes precedence',()=>{
 const h=scene({weapon:'WC-06'});h.game.artifactState.randomState=1;h.combat.elapsed=1;primary(h);
 near(h.enemy.statuses.freeze.time,.6);assert.equal(h.enemy.statuses.freeze._artifactFreeze,true);
 near(h.enemy.artifactFreezeReady,7);assert.equal(h.enemy.factionControlRecovery,undefined);
 applyCanonicalControlContact(h.combat,h.tower,h.enemy,{abilities:[{familyId:'freeze',chancePercent:100,duration:2}]});
 near(h.enemy.statuses.freeze.time,2);assert.equal(h.enemy.statuses.freeze._artifactFreeze,undefined);near(h.enemy.factionControlRecovery,5);
 const after=scene({weapon:'WC-06'});after.game.artifactState.randomState=1;after.combat.elapsed=1;primary(after);
 delete after.enemy.statuses.freeze;after.combat.elapsed=1.7;
 applyCanonicalControlContact(after.combat,after.tower,after.enemy,{abilities:[{familyId:'freeze',chancePercent:100,duration:2}]});
 near(after.enemy.statuses.freeze.time,2);
});

test('V3 artifact Freeze retains its target cooldown and never shortens a stronger active control',()=>{
 const h=scene({weapon:'WC-06'});h.game.artifactState.randomState=1;h.combat.elapsed=1;primary(h);
 applyCanonicalControlContact(h.combat,h.tower,h.enemy,{abilities:[{familyId:'freeze',chancePercent:100,duration:.2}]});
 near(h.enemy.statuses.freeze.time,.6);
 delete h.enemy.statuses.freeze;h.enemy.factionControlRecovery=0;h.combat.elapsed=2;h.game.artifactState.randomState=1;primary(h);
 assert.equal(h.enemy.statuses.freeze,undefined);near(h.enemy.artifactFreezeReady,7);
 h.combat.elapsed=7;h.enemy.statuses.stun={time:2};h.game.artifactState.randomState=1;primary(h);
 assert.equal(h.enemy.statuses.freeze,undefined);
 const old=scene({weapon:'WC-06'},'fr011-v2');old.game.artifactState.randomState=1;old.combat.elapsed=1;primary(old);
 near(old.enemy.factionControlRecovery,3.6);delete old.enemy.statuses.freeze;old.combat.elapsed=1.7;
 applyCanonicalControlContact(old.combat,old.tower,old.enemy,{abilities:[{familyId:'freeze',chancePercent:100,duration:2}]});
 assert.equal(old.enemy.statuses.freeze,undefined);
});

test('V3 Royal Architect spends its heal only on the first useful boss death',()=>{
 for(const version of ['fr011-v3','fr011-v2']){
  const h=scene(set('royal-architect'),version);h.enemy.boss=true;h.combat.resolveDamage(h.enemy,1e9,'holy',{},h.tower);
  assert.equal(h.game.artifactState.reinforced,version==='fr011-v2');
  h.game.lives-=2;const second=h.combat.spawn('host_10');h.combat.resolveDamage(second,1e9,'holy',{},h.tower);
  assert.equal(h.game.lives,h.game.maxLives-(version==='fr011-v2'?2:0));assert.equal(h.game.artifactState.reinforced,true);
  h.game.lives-=6;const before=h.game.lives,third=h.combat.spawn('host_10');h.combat.resolveDamage(third,1e9,'holy',{},h.tower);assert.equal(h.game.lives,before);
 }
});

test('V3 artifact procs use only the principal cone/multishot target, preserving v2 contacts',()=>{
 for(const version of ['fr011-v3','fr011-v2']){
  const h=scene({weapon:'VC-06'},version),other=h.combat.spawn('host_01');Object.assign(other,{x:20,z:18,hp:1e6,maxHp:1e6,speed:0,armor:0});
  updateFr002Tower(h.combat,h.tower,{...primaryStats,damage:0,continuousAttack:{dps:60,damageType:'magical',angleDegrees:90,targeting:'ground-and-air'}},.1,1);
  assert.ok(h.enemy.artifactDots?.poison?.size);assert.equal(!!other.artifactDots?.poison?.size,version==='fr011-v2');
  const volley=scene({weapon:'VC-06'},version),secondary=volley.combat.spawn('host_01');Object.assign(secondary,{x:20,z:18,hp:1e6,maxHp:1e6,armor:0});
  primary(volley);primary(volley,secondary,false);assert.ok(volley.enemy.artifactDots?.poison?.size);assert.equal(!!secondary.artifactDots?.poison?.size,version==='fr011-v2');
 }
});

test('V3 artifact DOT preserves finite post-defense ownership, Dread and no recursive budget',()=>{
 const h=scene(set('venom-covenant'));h.enemy.armor=30;h.enemy.untouchable=.75;
 const hit=h.combat.resolveDamage(h.enemy,100,'physical',{directHit:true},h.tower);artifactPrimaryContact(h.combat,hit,{},h.tower);
 const budget=hit.effectiveDamage*.2,before=h.enemy.hp;near(h.enemy.artifactDots.poison.get(h.tower.id).pending,budget);near(h.tower.dread.until,3);
 h.combat.elapsed=1;updateArtifactDots(h.combat,h.enemy);
 near(before-h.enemy.hp,budget/3*.5);near(h.tower.dread.until,4);near(h.enemy.artifactDots.poison.get(h.tower.id).pending,budget*2/3);
 assert.equal(h.enemy.artifactDots.poison.size,1);
});

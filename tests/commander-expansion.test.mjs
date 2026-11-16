import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTIFACT_CATALOG as C,ARTIFACTS,artifactBonuses,equipArtifactSet,normalizeArtifactPity,rollArtifactChest,artifactModifierText} from '../game/core/artifacts.js';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {combatTowerStats,damageDefenseBreakdown} from '../game/core/math.js';
import {artifactPrimaryContact,artifactDamageMultiplier} from '../game/core/artifact-combat.js';
import {CommanderVault} from '../ui/commander-vault.js';
import {generalView,achievementsView} from '../ui/war-table-view.js';
const d=currentFactionData('crown'),gear=id=>equipArtifactSet({},id),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('Artifact rarity separates three starter, six advanced and two master sets',()=>{
 assert.equal(C.sets.length,11);assert.equal(C.artifacts.length,84);
 for(const s of C.sets){const pieces=C.artifacts.filter(a=>a.setId===s.id);assert.equal(pieces.length,s.pieceCount);assert.equal(new Set(Object.values(gear(s.id))).size,s.pieceCount);const allowed=s.rarity==='rare'?['common','uncommon','rare']:s.rarity==='epic'?['rare','epic','legendary']:['epic','legendary'];assert.ok(pieces.every(a=>allowed.includes(a.rarity)),s.id);}
 assert.equal(C.sets.filter(s=>s.rarity==='rare').length,3);assert.equal(C.sets.filter(s=>s.rarity==='epic').length,6);assert.equal(C.sets.filter(s=>s.rarity==='legendary').length,2);
 const e=equipArtifactSet({ring1:'N-03',ring2:'N-05'},'celestial');assert.equal(Object.keys(e).length,10);assert.deepEqual(new Set([e.ring1,e.ring2]),new Set(['CE-09','CE-10']));
 assert.deepEqual(equipArtifactSet(e,'celestial'),e);
});
test('Full set flat reach and starting resources match requested totals',()=>{
 for(const [id,tiles]of [['stormwing-vanguard',5],['winter-court',6],['ashen-dragon',3],['celestial',6],['scouts-trail',2]]){const effects=artifactBonuses(gear(id)).effects;near(effects.rangeTiles,tiles);assert.ok(!effects.range);}
 assert.equal(artifactBonuses(gear('royal-architect')).effects.gold,600);near(artifactBonuses(gear('celestial')).effects.damage,.4);near(artifactBonuses(gear('celestial')).effects.speed,.35);
 const mixed=artifactBonuses({...gear('winter-court'),gloves:'N-04',feet:'SC-04'});assert.equal(mixed.effects.rangeTiles,7.75);
});
test('Tradeoff equipment changes actual damage, attack speed and flat reach',()=>{
 const normal=new Game(d,{seed:3}),heavy=new Game(d,{seed:3,artifactEquipment:{weapon:'N-13'}}),lens=new Game(d,{seed:3,artifactEquipment:{head:'N-15'}});
 for(const g of [normal,heavy,lens]){g.place(18,18);g.towers[0].state='active';}
 const [a,b,c]=[normal,heavy,lens].map(g=>combatTowerStats(g.towers[0],g.towers,g.data));near(b.bonuses.haste/a.bonuses.haste,.92);near(c.stats.range-a.stats.range,2);near(artifactDamageMultiplier(heavy,{statuses:{}}),1.12);
 for(const id of ['N-13','N-14','N-15','N-16','N-17','N-18']){const values=Object.values(ARTIFACTS[id].modifiers);assert.ok(values.some(v=>v>0)&&values.some(v=>v<0));assert.match(artifactModifierText(ARTIFACTS[id].modifiers).join(' '),/−/);}
});
test('Legacy saved defenses retain percentage reach and old resources across replay',()=>{
 for(const id of ['royal-architect','winter-court','stormwing-vanguard']){const g=new Game(d,{seed:3,artifactEquipment:gear(id),artifactVersion:'fr011-v1'});g.place(18,18);g.towers[0].state='active';const snapshot=serializeRun(g),h=restoreRun(d,JSON.parse(JSON.stringify(snapshot)));assert.equal(h.artifactVersion,'fr011-v1');assert.deepEqual(serializeRun(h),snapshot);assert.deepEqual(combatTowerStats(h.towers[0],h.towers,d),combatTowerStats(g.towers[0],g.towers,d));if(id==='royal-architect')assert.equal(h.economy.gold,315);if(id==='winter-court')near(h.artifactState.effects.range,.12);assert.ok(!h.artifactState.effects.rangeTiles);}
 assert.throws(()=>new Game(d,{artifactEquipment:gear('celestial'),artifactVersion:'fr011-v1'}),/not available/);
});
test('Necromancer reduces damage immunity without bypassing status immunity',()=>{
 const g=new Game(d,{seed:4,artifactEquipment:gear('necromancer')});g.place(18,18);const t=g.towers[0];t.state='active';g.phase='combat';const e=g.combat.spawn('host_01');Object.assign(e,{hp:10000,maxHp:10000,physicalImmune:true,magicImmune:true,armor:0,immunities:['slow','freeze','poison','burn']});
 const effects=g.artifactState.effects;assert.equal(effects.shred,8);near(effects.slow,.25);near(effects.immunityReduction,.3);
 for(const type of ['physical','magical'])near(damageDefenseBreakdown(100,type,e,{},d.balance,null,effects.immunityReduction).afterArmor,30);
 near(damageDefenseBreakdown(100,'holy',e,{},d.balance,null,.3).afterArmor,100);
 e.statuses.breachPhysical={time:1,multiplier:.6};near(damageDefenseBreakdown(100,'physical',e,{},d.balance,null,.3).afterArmor,60);
 delete e.statuses.breachPhysical;artifactPrimaryContact(g.combat,{enemy:e,effectiveDamage:10},{},t);assert.equal(e.statuses.slow,undefined);assert.equal(e.statuses.freeze,undefined);assert.equal(e.statuses.artifactShred.amount,8);
});
test('Chest pity migrates changed tiers only and guarantees Rare in three, Epic in seven draws',()=>{
 const migrated=normalizeArtifactPity({1:4,2:4,3:9,4:2,5:1});assert.equal(migrated[1],4);assert.equal(migrated[4],2);assert.equal(migrated[5],1);assert.equal(migrated[2],0);assert.equal(migrated[3],0);assert.deepEqual(normalizeArtifactPity(migrated),migrated);
 const ranks=C.rarities.map(r=>r.id);for(const[tier,every,minimum]of [[2,3,'rare'],[3,7,'epic']]){let a={owned:[],pity:{_rules:C.pityRulesVersion},dust:0},miss=0;for(let seed=0;seed<500;seed++){a=rollArtifactChest(a,tier,seed);const good=ranks.indexOf(ARTIFACTS[a.items[0].id].rarity)>=ranks.indexOf(minimum);miss=good?0:miss+1;assert.ok(miss<every);}}
});
test('Armory uses a coherent portrait for every complete set and retains mixed-item overlays',()=>{
 const player={online:true,profile:{artifacts:{owned:C.artifacts.map(a=>a.id),equipment:{},counts:[],chests:[],presets:[],pity:{},dust:1000,highestTier:5}}},v=new CommanderVault({player,render:()=>{},status:()=>{}});
 for(const s of C.sets){player.profile.artifacts.equipment=gear(s.id);const html=v.equipment();assert.ok(html.includes(s.commanderArt));assert.doesNotMatch(html,/class="body-equipment/);assert.match(html,/Commander Equipment/);assert.doesNotMatch(html,/Three equipment presets|◇/);}
 player.profile.artifacts.equipment={head:'N-15'};assert.match(v.equipment(),/body-equipment body-head/);
 const sets=v.sets();assert.match(sets,/Complete army effects/);assert.match(sets,/10 pieces/);assert.match(sets,/600 starting gold/);v.setRarity='rare';assert.doesNotMatch(v.sets(),/id="vault-set-celestial"/);
});
test('Commander prioritizes available purchases, displays exact level locks and album has no next-medal strip',()=>{
 const html=generalView({xpTotal:0,balance:100,skills:{},equipped:[]});const cards=[...html.matchAll(/<article class="war-skill [\s\S]*?<\/article>/g)].map(m=>m[0]);const firstLocked=cards.findIndex(c=>c.includes('is-level-locked'));assert.ok(firstLocked>0);assert.ok(cards.slice(firstLocked).every(c=>c.includes('is-level-locked')));assert.match(html,/Unlock at Level 5/);assert.doesNotMatch(cards.join(''),/>Rank locked</);assert.doesNotMatch(achievementsView({online:true,profile:{grants:[],eligible:[]}}),/YOUR NEXT MEDAL/);
});

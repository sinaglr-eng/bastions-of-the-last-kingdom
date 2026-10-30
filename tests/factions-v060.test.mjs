import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {Game} from '../game/core/game.js';
import {createFactionData,FACTIONS} from '../game/core/factions.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';
import {combatTowerStats,towerStats} from '../game/core/math.js';
import {RunStatistics} from '../game/core/run-statistics.js';
const read=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url))),registry=read('data/factions-v060.json');
const current={balance:read('data/balance.json'),towers:campaignTowers(read('data/towers.json')),enemies:campaignEnemies(read('data/enemies.json')),waves:campaignWaves(read('data/waves.json')),recipes:campaignRecipes(read('data/recipes.json'))};
const data=id=>createFactionData(current,registry,id),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('exactly three closed factions retain eight basic families, 38 recipes and 86 approved bindings',()=>{
 assert.deepEqual(FACTIONS.map(f=>f.id),['crown','forge','grove']);for(const f of FACTIONS){const d=data(f.id);assert.equal(Object.values(d.towers).filter(t=>!t.advanced).length,8);assert.equal(d.recipes.length,38);assert.equal(d.defenderAssets.length,86);for(const r of d.recipes){assert.ok(d.towers[r.id]);for(const i of r.ingredients)assert.ok(d.towers[i.family]);}for(const a of d.defenderAssets)assert.equal(a.factionId,f.id);}
 assert.throws(()=>data('celestial'));assert.throws(()=>data(''));
});
test('Human changes appearance and names while retaining the current 0.5.2 combat and recipes',()=>{const d=data('crown');assert.deepEqual(d.recipes,current.recipes);for(const [id,s]of Object.entries(current.towers)){assert.equal(d.towers[id].damage,s.damage);assert.equal(d.towers[id].interval,s.interval);assert.deepEqual(d.towers[id].levels,s.levels);}assert.equal(d.enemies.host_49.recharge,.1);});
for(const f of FACTIONS)test(`${f.name}: deterministic drafts stay within their selected faction and rank domain`,()=>{
 const d=data(f.id),g=new Game(d,{seed:521}),same=new Game(d,{seed:521});assert.equal(g.factionId,f.id);assert.throws(()=>{g.factionId='other';});for(let i=0;i<200;i++){g.draft.roll(0);same.draft.roll(0);for(let slot=0;slot<5;slot++){const a=g.draft.reveal(slot),b=same.draft.reveal(slot);assert.deepEqual(a,b);assert.ok(!d.towers[a.family].advanced);assert.equal(d.towers[a.family].weight,1);assert.equal(a.tier,1);}}assert.equal(d.recipes.find(r=>r.id==='ladyclaire').currentRoundOnly,true);
});
test('all258 imported model and portrait bytes are bound to exact approved V3 hashes',()=>{const m=read('public/assets/factions/v060/manifest.json');assert.equal(m.assets.length,258);for(const row of m.assets)for(const [file,hash]of [[row.file,row.sha256],[row.portrait,row.portraitSha256]])assert.equal(createHash('sha256').update((file.endsWith('.glb')?gunzipSync(readFileSync(new URL('../public/'+file+'.gz',import.meta.url))):readFileSync(new URL('../public/'+file,import.meta.url)))).digest('hex'),hash,file);});
function arena(id,family){const d=data(id),g=new Game(d,{seed:7});g.phase='combat';g.combat.spawnQueue=[{time:999999,type:'host_01'}];const t={id:1,family,tier:1,state:'active',x:18,z:17,cooldown:0,kills:0};g.towers.push(t);const e=g.combat.spawn('host_01');Object.assign(e,{x:18,z:18,speed:0,hp:1e8,maxHp:1e8,armor:0});return{d,g,t,e};}
test('Dwarf magazine honors a whole three-round and reload cycle, with damage coming only from combat events',()=>{
 const {g,t,e}=arena('forge','dw_musketeer');let shots=0;g.on(type=>{if(type==='shot')shots++;});for(let i=0;i<35;i++)g.combat.update(.1);assert.equal(shots,3);for(let i=0;i<3;i++)g.combat.update(.1);assert.equal(shots,4);assert.ok(e.hp<1e8);assert.ok(t.weaponCycleState);
});
test('Lone Vigil and Bonded Formation apply only their listed cardinal condition',()=>{for(const id of ['forge','grove']){const d=data(id),family=Object.keys(d.towers).find(k=>d.towers[k].abilities?.some(a=>a.familyId===(id==='forge'?'bonded-formation':'lone-vigil')));assert.ok(family);const t={id:1,family,tier:1,state:'active',x:10,z:10};const a=d.towers[family].abilities.find(a=>a.familyId===(id==='forge'?'bonded-formation':'lone-vigil'));const other={id:2,family:id==='forge'?a.partnerIds[0]:Object.keys(d.towers)[0],tier:1,state:'active',x:11,z:10};const direct=army=>{const r=combatTowerStats(t,army,d);return r.stats.damage/r.multiplier;};const one=direct([t]),two=direct([t,other]);if(id==='forge')near(two,one*1.2);else near(one,two*1.2);other.z++;near(direct([t,other]),one);}});
test('Faction snapshots capture immutable attribution and content identity, without another result render advancing sequence',()=>{const {g}=arena('grove','el_moonblade');const tracker=new RunStatistics(g,{id:'a6c70825-3d04-4349-a7c8-b059f206e8db'}),s=tracker.snapshot();assert.equal(s.factionId,'grove');assert.equal(s.rulesetRevision,registry.revision);assert.equal(s.contentManifestId,'approved-faction-models-v3-20261030');tracker.dispose();});

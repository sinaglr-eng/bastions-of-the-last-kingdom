import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {fight,expand,diamond,datasets} from './fixtures.mjs';
import {fill,positions,cost} from './armies.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..');
const out=path.join(root,'output/implementation/fr004-current/controlled');fs.mkdirSync(out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const source=['package.json','game/release.js','game/core/game.js','game/core/grid.js','game/core/combat.js','game/core/immunity-auras.js','game/core/fr003-registry.js','game/core/fr002-combat.js','game/core/faction-combat.js','game/core/math.js','game/core/factions.js','game/core/fr002-registry.js','game/core/campaign-roster.js','data/fr004.json','game/core/fr004-registry.js','tools/current-datasets.mjs','data/fr003-approved.json','data/fr002-approved.json','data/factions-v060.json','data/maze-blueprints.json','data/towers.json','data/recipes.json','data/balance.json','data/enemies.json','data/waves.json','tools/fr003-validation/datasets.mjs'];
const hashes=()=>Object.fromEntries([...source,...['fixtures.mjs','armies.mjs','run.mjs'].map(f=>path.relative(root,path.join(here,f)))].map(f=>[f.replaceAll('\\','/'),sha(fs.readFileSync(path.join(root,f)))]));
const choices=[
 {name:'human-current',faction:'crown',army:fill('crown',expand(['monk'],['rangermentor'],['archangel'],['royalranger'],['highking',7],['thunderheart',3]))},
 {name:'dwarf-current',faction:'forge',army:fill('forge',expand(['dw_warcaller'],['dw_nullifier',2],['dw_talonlord'],['dw_steamrail',13]))},
 {name:'elf-current',faction:'grove',army:fill('grove',expand(['el_moonwell_seer'],['el_stag_oracle'],['el_drow_furnace_seer'],['el_twilight_huntress',11],['el_wisp_conductor',2]))}
];
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'0.6.7');
for(const c of choices){assert.ok(c.army);assert.equal(cost(c.faction,c.army),600);assert.ok(c.army.length<=19);for(const t of c.army){const d=datasets[c.faction].towers[t.family];assert.ok(d);assert.notEqual(d.classification?.toUpperCase(),'TOP');assert.ok(!d.secret&&t.family!=='ladyclaire');}}
const originalReference=JSON.parse(fs.readFileSync(path.join(here,'fixed-inputs.json')));
for(const c of choices){const old=originalReference.choices.find(o=>o.faction===c.faction&&o.name!=='dwarf-proposal');assert.deepEqual(c.army,old.army,'Same fixed army identities and ranks as the earlier comparison');}
const smoke=process.argv.includes('--smoke'),seeds=[910001,910019,910037],waves=[27,35,40,43,45,46,48,49,50];
const sourceHashes=hashes(),inputDigest=sha(JSON.stringify(datasets));
const manifest={status:'Current game controlled combat diagnostics; no game, gallery or approved-data edits',runtimeVersion:'0.6.7',requirement:'Implemented FR-004',frozenAt:new Date().toISOString(),sourceHashes,method:'Independent real-engine battles with complete Diamond Spiral foundations and an injected fixed army. This diagnoses combat capacity, not acquisition or campaign completion. Exactly 600 recursively expanded rank-I ingredient equivalents per faction, <=19 active core positions, MVP0, no TOP or Secret, 30 starting lives. Report enemy full clears and genuine boss deaths independently from the engine won phase. All three army identities and ranks equal the previous fixed comparison.',seeds,waves,choices,positions,diamond:{foundations:diamond.walls.length,core:diamond.core.length,routeSteps:diamond.route.length-1},smoke};
assert.deepEqual(manifest.diamond,{foundations:128,core:19,routeSteps:718});
fs.writeFileSync(path.join(out,smoke?'smoke-manifest.json':'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const rows=[],started=Date.now();
const save=()=>fs.writeFileSync(path.join(out,smoke?'smoke-results.json':'results.json'),JSON.stringify(rows,null,2)+'\n');
function run(c,seed,wave,stage,extra={}){
 const begin=Date.now(),r=fight(c.faction,c.army,{seed,wave,positions,...extra});
 Object.assign(r,{test:c.name,stage,...(extra.variant!==undefined?{variantIndex:extra.variant}:{}),wallMilliseconds:Date.now()-begin});
 rows.push(r);save();console.log(JSON.stringify({test:c.name,seed,wave,variant:extra.variant,dt:r.dt,fullClear:r.allKilled,leaks:r.leakCount,bossKills:r.bossKillCount,wallMilliseconds:r.wallMilliseconds}));
}
for(const c of choices){
 if(smoke){run(c,seeds[0],50,'smoke');continue;}
 for(const seed of seeds)for(const wave of waves)run(c,seed,wave,'scheduled-real-wave');
 for(const seed of seeds)for(const variant of [0,1,2])run(c,seed,50,'forced-final-boss-form',{variant});
 for(const wave of [35,45,50])run(c,seeds[0],wave,'half-step-check',{dt:.05});
}
assert.equal(sha(JSON.stringify(datasets)),inputDigest,'No fixture mutates the current shared data in memory');
assert.deepEqual(hashes(),sourceHashes,'No protected runtime or test source changed during the benchmarks');
const summary=choices.map(c=>{
 const same=rows.filter(r=>r.faction===c.faction),group=stage=>{const x=same.filter(r=>r.stage===stage);return {cases:x.length,fullClears:x.filter(r=>r.allKilled).length,leakCount:x.reduce((s,r)=>s+r.leakCount,0),bossKills:x.reduce((s,r)=>s+r.bossKillCount,0),bossEscapes:x.reduce((s,r)=>s+r.leaks.filter(e=>e.boss).length,0),timeouts:x.filter(r=>r.timedOut).length};};
 return {name:c.name,faction:c.faction,material:cost(c.faction,c.army),active:c.army.length,scheduled:group('scheduled-real-wave'),forcedBossForms:group('forced-final-boss-form'),halfStep:group('half-step-check'),failures:same.filter(r=>!r.allKilled).map(r=>({stage:r.stage,seed:r.seed,wave:r.wave,variant:r.variantIndex,dt:r.dt,leaks:r.leakCount,escapedHp:r.leaks.reduce((s,e)=>s+e.hp,0),bossEscapes:r.leaks.filter(e=>e.boss),remaining:r.survivors}))};
});
const result={status:'passed',runtimeVersion:'0.6.7',cases:rows.length,wallSeconds:(Date.now()-started)/1000,protectedSourcesUnchanged:true,sharedRuntimeDataUnchanged:true,summary};
fs.writeFileSync(path.join(out,smoke?'smoke-summary.json':'summary.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));

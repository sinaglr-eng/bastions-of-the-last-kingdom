import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {fight,expand,diamond,datasets} from './fixtures.mjs';
import {fill,positions,cost} from './armies.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..');
const out=path.join(root,'output/implementation/fr005-current/controlled/'+(process.env.FR005_BASELINE==='1'?'baseline':'current')+'');fs.mkdirSync(out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex');
const source=['package.json','game/release.js','game/core/game.js','game/core/grid.js','game/core/combat.js','game/core/immunity-auras.js','game/core/fr003-registry.js','game/core/fr002-combat.js','game/core/faction-combat.js','game/core/math.js','game/core/factions.js','game/core/fr002-registry.js','game/core/campaign-roster.js','data/fr004.json','game/core/fr004-registry.js','data/fr005-approved.json','game/core/fr005-registry.js','game/core/sky-hunt.js','tools/current-datasets.mjs','data/fr003-approved.json','data/fr002-approved.json','data/factions-v060.json','data/maze-blueprints.json','data/towers.json','data/recipes.json','data/balance.json','data/enemies.json','data/waves.json','tools/fr003-validation/datasets.mjs'];
const hashes=()=>Object.fromEntries([...source,...['fixtures.mjs','armies.mjs','run.mjs'].map(f=>path.relative(root,path.join(here,f)))].map(f=>[f.replaceAll('\\','/'),sha(fs.readFileSync(path.join(root,f)))]));
const originalReference=JSON.parse(fs.readFileSync(path.join(here,'fixed-inputs.json'))),cohort=process.env.FR005_BASELINE==='1'?'baseline':'current',choices=originalReference.cohorts[cohort];
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,'0.6.8');
for(const c of choices){assert.ok(c.army);assert.equal(cost(c.faction,c.army),600);assert.ok(c.army.length<=19);for(const t of c.army){const d=datasets[c.faction].towers[t.family];assert.ok(d);assert.notEqual(d.classification?.toUpperCase(),'TOP');assert.ok(!d.secret&&t.family!=='ladyclaire');}}
const smoke=process.argv.includes('--smoke'),seeds=[910001,910019,910037],waves=[27,35,40,43,45,46,48,49,50];
const sourceHashes=hashes(),inputDigest=sha(JSON.stringify(datasets));
const manifest={status:'Matched FR-005 controlled combat diagnostics',cohort,runtimeVersion:'0.6.8',requirement:'FR-005 revision 2 compared with implemented FR-004',frozenAt:new Date().toISOString(),sourceHashes,method:'Independent real-engine battles with complete Diamond Spiral foundations and an injected fixed army. This diagnoses combat capacity, not acquisition or campaign completion. Exactly 600 recursively expanded rank-I ingredient equivalents per faction, <=19 active core positions, MVP0, no TOP or Secret, 30 starting lives. Report enemy full clears and genuine boss deaths independently from the engine won phase. Principal armies and positions are matched; filler follows the exact frozen 600-material input file.',seeds,waves,choices,positions,diamond:{foundations:diamond.walls.length,core:diamond.core.length,routeSteps:diamond.route.length-1},smoke};
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
const result={status:'passed',runtimeVersion:'0.6.8',cohort,cases:rows.length,wallSeconds:(Date.now()-started)/1000,protectedSourcesUnchanged:true,sharedRuntimeDataUnchanged:true,summary};
fs.writeFileSync(path.join(out,smoke?'smoke-summary.json':'summary.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));

import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {loadDatasets,defaultPatchFiles} from './datasets.mjs';
import {Game} from '../../game/core/game.js';
import {GridManager} from '../../game/core/grid.js';
import {towerStats,combatTowerStats,distance} from '../../game/core/math.js';
import {createFactionData} from '../../game/core/factions.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../../game/core/campaign-roster.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const outputTag=process.argv.find(x=>x.startsWith('--tag='))?.split('=')[1]||'training';
if(!/^[a-z0-9-]+$/.test(outputTag))throw Error('Invalid evidence tag');
const out=resolve(root,'output/releases/v0.6.2/fr001/campaign',outputTag);
mkdirSync(out,{recursive:true});
const read=f=>JSON.parse(readFileSync(resolve(root,f),'utf8'));
const hash=f=>createHash('sha256').update(readFileSync(resolve(root,f))).digest('hex');
const files=['game/core/game.js','game/core/combat.js','game/core/faction-combat.js','game/core/factions.js','game/core/math.js','game/core/campaign-roster.js','data/factions-v060.json','data/balance.json','data/towers.json','data/recipes.json','data/enemies.json','data/waves.json'];
const sourceHashes=Object.fromEntries(files.map(f=>[f,hash(f)]));
const manifestPath=process.argv.find(x=>x.startsWith('--patch-set='))?.split('=')[1];
const patchFiles=manifestPath?read(manifestPath).files:defaultPatchFiles;
const baseline=loadDatasets(),candidate=loadDatasets({patchFiles});
assert.deepEqual(candidate.crown,baseline.crown,'Human is unchanged');
const datasets=[{id:'crown-baseline',data:baseline.crown},{id:'forge-baseline',data:baseline.forge},{id:'forge-candidate',data:candidate.forge},{id:'grove-baseline',data:baseline.grove},{id:'grove-candidate',data:candidate.grove}];
// An identical legal map is used at the same round in every run. Placement
// locations are planned without reading any faction, draw identity or RNG.
const planGrid=new GridManager(),placements=[];
for(let index=0;index<250;index++){
 const candidates=[];
 for(let z=2;z<35;z++)for(let x=2;x<35;x++)if(planGrid.type(x,z)==='buildable'){
  let score=0;
  for(const p of planGrid.route){const d2=(x-p.x)**2+(z-p.z)**2;if(d2<=25)score+=1-d2/50;}
  // Do not build an artificial pre-existing maze. Every cell is an actual
  // paid-for draw foundation, and every candidate below is checked by BFS.
  const centerDistance=(x-18)**2+(z-18)**2;
  candidates.push({x,z,score:score-centerDistance*.0001});
 }
 candidates.sort((a,b)=>b.score-a.score||a.z-b.z||a.x-b.x);
 const cell=candidates.find(p=>planGrid.canPlace(p.x,p.z).ok);
 assert.ok(cell,'At least 250 legal foundations must exist');
 assert.ok(planGrid.occupy(cell.x,cell.z,index+1).ok);placements.push({x:cell.x,z:cell.z});
}
writeFileSync(resolve(out,'placement-plan.json'),JSON.stringify({description:'250 legal recruit foundations, precomputed with the actual GridManager. Shared by all factions, seeds and recipe versions. No terrain is injected into a Game.',placements},null,2)+'\n');

function primary(s,haste=1){
 const weapon=s.weaponCycle;
 const releaseRate=weapon?weapon.magazine/((weapon.spinUpSeconds||0)+weapon.magazine*weapon.fixedInterval/haste+weapon.reload):haste/Math.max(.01,s.interval);
 let p=s.damage*releaseRate;
 if(s.continuousAttack)p=s.continuousAttack.dps;
 p*=s.multishot||1;
 for(const a of s.abilities||[]){
  if(['poison','burn'].includes(a.familyId))p+=a.dps;
  if(['cleave-magical','cleave-physical','splash'].includes(a.familyId))p+=s.damage*releaseRate*a.damagePercent/100;
  if(a.familyId==='lightning')p+=a.damage*a.targets*a.chancePercent/100*releaseRate;
  if(['spark','heat'].includes(a.familyId))p+=a.damage/Math.max(.01,a.cooldown);
  if(a.familyId==='fire-aura')p+=a.dps;
 }
 if(s.poisonDps)p+=s.poisonDps;
 if(s.burnDps)p+=s.burnDps;
 if(s.burnAura)p+=s.burnAura;
 if(s.cleave)p+=s.damage*releaseRate*s.cleave;
 return Math.max(0,p);
}

function scoreArmy(army,g){
 const profile=army.map(t=>({t,...combatTowerStats(t,army,g.data)}));
 const samples=[];
 for(let offset=0;offset<5;offset++){
  const wave=g.data.waves[Math.min(g.data.waves.length-1,g.round-1+offset)];
  for(const group of wave.groups){
   const e=g.data.enemies[group.type];
   const variants=e.variants?.length?e.variants:[e];
   for(const variant of variants)samples.push({e:{...e,...variant,...group},weight:1/(offset+1)/variants.length});
  }
 }
 const sampleWeight=samples.reduce((s,x)=>s+x.weight,0);
 const magicBreacher=profile.some(p=>p.stats.abilities?.some(a=>a.familyId==='cancel-magic-immunity'));
 const physicalBreacher=profile.some(p=>p.stats.abilities?.some(a=>a.familyId==='cancel-physical-immunity'));
 let total=0;
 for(const {t,stats:s,bonuses}of profile){
  let targetFactor=0;
  for(const {e,weight}of samples){
   let factor=e.flying&&s.groundOnly?0:1;
   if(s.type==='magical'&&e.magicImmune)factor*=magicBreacher?.25:0;
   if(s.type==='physical'&&e.physicalImmune)factor*=physicalBreacher?.25:0;
   if(e.stealth&&!army.some(other=>distance(t,other)<8&&(towerStats(other,g.data).detectionRange||towerStats(other,g.data).abilities?.some(a=>a.familyId==='visibility'))))factor*=.3;
   factor*=g.data.balance.armorConstant/(g.data.balance.armorConstant+(e.armor||0)*(1-(s.penetration||0)));
   targetFactor+=factor*weight;
  }
  targetFactor/=Math.max(.0001,sampleWeight);
  let exposure=0;
  for(const p of g.grid.route)if(distance(t,p)<=s.range)exposure++;
  const control=(s.slow||0)+(s.abilities||[]).reduce((sum,a)=>sum+(a.familyId==='slow'?a.slowPercent/100:0),0);
  const dps=primary(s,bonuses.haste||1);
  total+=dps*(.4+exposure/10)*targetFactor*(1+control*.5);
 }
 return total;
}

function bestAction(g,allowKeep=true){
 const base=g.towers.filter(t=>t.state==='active').map(t=>({...t}));
 let best=null;
 const consider=(action,army)=>{
  const value=scoreArmy(army,g);
  if(!best||value>best.value+1e-9)best={...action,value};
 };
 const fresh=g.roundCandidates.map(c=>c.tower);
 if(allowKeep)for(const t of fresh)consider({kind:'keep',anchor:t.id},[...base,{...t,state:'active'}]);
 if(allowKeep)for(const t of fresh){
  const partner=g.mergePartner(t);
  if(partner)consider({kind:'merge',anchor:t.id},[...base,{...t,tier:t.tier+1,state:'active'}]);
 }
 for(const anchor of g.towers.filter(t=>['active','draft'].includes(t.state))){
  for(const recipe of g.availableRecipes(anchor)){
   const pieces=g.recipePieces(recipe,anchor);if(!pieces)continue;
   const used=new Set(pieces.map(p=>p.id));
   const army=base.filter(t=>!used.has(t.id));
   army.push({...anchor,family:recipe.resultFamily||recipe.id,tier:1,state:'active'});
   // Retained-only crafting while the keeper decision is unresolved must
   // still be compared with keeping the best remaining current candidate.
   if(allowKeep&&!pieces.some(p=>p.state==='draft'))continue;
   consider({kind:'craft',anchor:anchor.id,recipe:recipe.id},army);
  }
 }
 if(!allowKeep&&best&&best.value<=scoreArmy(base,g)*1.01)return null;
 return best;
}

function simulate(dataset,seed){
 const started=Date.now(),g=new Game(dataset.data,{seed}),crafts=[],merges=[],keepers=[],waves=[];
 let placed=0,steps=0,lastWave=0,finiteChecks=0;
 while(!['won','lost'].includes(g.phase)&&steps<150000){
  if(g.phase==='build'){
   // All five foundations must be committed before any keeper or recipe.
   while(g.phase==='build'){
    const p=placements[placed];assert.ok(p,`Missing foundation ${placed}`);
    assert.ok(g.place(p.x,p.z),`Illegal placement ${placed}`);placed++;
   }
  }else if(g.phase==='select'){
   const action=bestAction(g,true);assert.ok(action,'The completed draft has a legal keeper');
   g.select(action.anchor);
   if(action.kind==='craft'){assert.ok(g.craft(action.recipe));crafts.push({round:g.round,id:action.recipe,name:g.data.towers[action.recipe].name});}
   else if(action.kind==='merge'){const t=g.selection;merges.push({round:g.round,family:t.family,from:t.tier});assert.ok(g.merge());}
   else{keepers.push({round:g.round,family:g.selection.family,tier:g.selection.tier});assert.ok(g.keep());}
  }else if(g.phase==='ready'){
   let guard=0,action;
   while(guard++<38&&(action=bestAction(g,false))){g.select(action.anchor);assert.ok(g.craft(action.recipe));crafts.push({round:g.round,id:action.recipe,name:g.data.towers[action.recipe].name});}
   lastWave=g.round;waves.push({round:g.round,livesBefore:g.lives,active:g.towers.filter(t=>t.state==='active').map(t=>({family:t.family,tier:t.tier,x:t.x,z:t.z}))});
   assert.ok(g.startCombat());
  }else if(g.phase==='reward')g.nextRound();
  else g.tick(.1);
  if(steps%200===0){
   assert.ok(Number.isFinite(g.lives)&&Number.isFinite(g.score));
   for(const e of g.combat.enemies)assert.ok(Number.isFinite(e.hp)&&Number.isFinite(e.x)&&Number.isFinite(e.z));
   for(const t of g.towers)assert.ok(Number.isFinite(t.tier)&&g.validFactionUnit(t));
   finiteChecks++;
  }
  steps++;
 }
 assert.ok(['won','lost'].includes(g.phase),'No campaign may timeout silently');
 return {dataset:dataset.id,factionId:g.factionId,seed,outcome:g.phase,lastWave,completed:g.phase==='won'?g.round:g.round-1,lives:g.lives,kills:g.kills,leaks:g.leaks,score:g.score,placed,crafts,merges,keepers,waves,finiteChecks,steps,wallMs:Date.now()-started};
}

const count=Number(process.argv.find(x=>x.startsWith('--seeds='))?.split('=')[1]||32);
const holdout=process.argv.includes('--holdout');
const seeds=Array.from({length:count},(_,i)=>holdout?(1900001+i*15427):([42,123,807,43877][i]??(1009+i*7919)));
const patchHashes=Object.fromEntries(patchFiles.map(p=>[p,hash(p)]));
const rows=[];
for(const seed of seeds)for(const dataset of datasets){
 const row=simulate(dataset,seed);rows.push(row);
 console.log(JSON.stringify({dataset:row.dataset,seed,completed:row.completed,crafts:row.crafts.length,ms:row.wallMs}));
}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const median=a=>{const sorted=[...a].sort((a,b)=>a-b),n=sorted.length;return n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;};
const summary=Object.fromEntries(datasets.map(({id})=>{
 const runs=rows.filter(r=>r.dataset===id),completed=runs.map(r=>r.completed);
 return [id,{runs:runs.length,wins:runs.filter(r=>r.outcome==='won').length,meanCompleted:mean(completed),medianCompleted:median(completed),minCompleted:Math.min(...completed),maxCompleted:Math.max(...completed),meanCrafts:mean(runs.map(r=>r.crafts.length)),totalCrafts:runs.reduce((s,r)=>s+r.crafts.length,0),meanKills:mean(runs.map(r=>r.kills)),championsCrafted:[...new Set(runs.flatMap(r=>r.crafts.map(c=>c.name)))].sort()}];
}));
const paired=Object.fromEntries(['forge','grove'].map(id=>{
 const pairs=seeds.map(seed=>{const a=rows.find(r=>r.dataset===id+'-baseline'&&r.seed===seed),b=rows.find(r=>r.dataset===id+'-candidate'&&r.seed===seed);return {seed,current:a.completed,approved:b.completed,delta:b.completed-a.completed,currentCrafts:a.crafts.length,approvedCrafts:b.crafts.length};});
 return [id,{pairs,meanDelta:mean(pairs.map(p=>p.delta)),improved:pairs.filter(p=>p.delta>0).length,unchanged:pairs.filter(p=>p.delta===0).length,worse:pairs.filter(p=>p.delta<0).length}];
}));
for(const file of files)assert.equal(hash(file),sourceHashes[file],'Source preservation '+file);
for(const [file,expected]of Object.entries(patchHashes))assert.equal(hash(file),expected,'Frozen parameter preservation '+file);
const result={status:'completed',date:'2026-10-30',baselineVersion:read('package.json').version,sourceHashes,patchHashes,protectedSourceFilesUnchanged:files.length,method:{policy:'Actual non-debug Game with legal placements, completed drafts, keeps, fresh merges and exact engine-authorized recipes. Same precomputed recruit foundation plan across factions. Select action maximizes a deterministic heuristic of route exposure, full unbuffed weapon cycle DPS, support, control and next five visible wave profiles. No reroll, reserve, move, downgrade or maze demolition. Baseline uses frozen 0.6.1 registry. Candidate uses actual implemented 0.6.2 registry, including 18 approved recipes and 492 numeric changes. No overlay is applied.',seeds,dt:.1,scenarios:datasets.map(d=>d.id),unforced:true},limitations:['This deterministic policy is not an optimized player and does not establish human win rates, impossibility, or equal final campaign difficulty.','The route exposure and next-wave utility estimate is a decision heuristic, not a substitute for measured damage.','Campaign RNG shares draft and combat draws; seed pairing fixes initial seed but downstream draws can diverge when combat behavior changes.','Only early and middle game actually reached by the bot is evaluated. No forced levels, guaranteed ingredients, artificial victory or injected resources were used.','No rendering, model transport, UI, touch or audio testing was performed.'],summary,paired,rows};
writeFileSync(resolve(out,'campaign-results.json'),JSON.stringify(result,null,2)+'\n');
writeFileSync(resolve(out,'summary.json'),JSON.stringify({status:result.status,method:result.method,limitations:result.limitations,sourceHashes,patchHashes,summary,paired},null,2)+'\n');
console.log(JSON.stringify({summary,paired:Object.fromEntries(Object.entries(paired).map(([id,p])=>[id,{meanDelta:p.meanDelta,improved:p.improved,unchanged:p.unchanged,worse:p.worse}]))},null,2));

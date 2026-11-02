import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Game} from '../../../game/core/game.js';
import {GridManager,CHECKPOINTS} from '../../../game/core/grid.js';
import {preparedBlueprints} from '../../../game/core/blueprints.js';
import {towerStats,combatTowerStats,distance} from '../../../game/core/math.js';
import {scaleDamageStats} from '../../../game/core/combat-rules.js';
import {mvpDamageBonus} from '../../../game/core/mvp.js';
import {factionPrimaryBonuses} from '../../../game/core/faction-combat.js';
import {loadCurrentDatasets} from '../../../tools/current-datasets.mjs';

const root=process.cwd(),base=resolve(root,'output/implementation/fr005-current/campaign');
mkdirSync(base,{recursive:true});
const hash=f=>createHash('sha256').update(readFileSync(resolve(root,f))).digest('hex');
const sourceTree=(directory)=>readdirSync(resolve(root,directory),{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceTree(directory+'/'+e.name):e.name.endsWith('.js')||e.name.endsWith('.json')?[directory+'/'+e.name]:[]);
export const sourceFiles=['package.json','game/release.js',...sourceTree('game/core'),...sourceTree('data')].sort();
export const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));
const controllerHash=hash('tools/fr005-validation/diamond/campaign.mjs');
export const datasets=loadCurrentDatasets({revision:process.env.FR005_BASELINE==='1'?'fr004':'current'});
assert.equal(JSON.parse(readFileSync(resolve(root,'package.json'))).version,'0.6.8');
for(const [faction,data] of Object.entries(datasets)){assert.equal(data.fr003,true,faction+' actual FR-003 rules');assert.equal(data.rulesetRevision,process.env.FR005_BASELINE==='1'?'fr004-r1-20261101':'fr005-r2-20261102',faction+' current ruleset');}
const key=p=>`${p.x},${p.z}`;
const diamond=preparedBlueprints(JSON.parse(readFileSync(resolve(root,'data/maze-blueprints.json'),'utf8'))).find(p=>p.id==='diamond-spiral');
assert.ok(diamond);

function makePlan(){
 const g=new GridManager(),placements=[],pending=diamond.walls.map(p=>({...p})),core=new Set(diamond.core.map(key));
 while(pending.length){
  const stillCore=pending.some(p=>core.has(key(p)));
  let chosen=null;const currentRouteKeys=new Set(g.route.map(key));
  const routeScores=new Map();
  for(const p of pending){
   if(stillCore&&!core.has(key(p)))continue;
   const q=currentRouteKeys.has(key(p))?g.canPlace(p.x,p.z):{ok:true,route:g.route};assert.ok(q.ok);
   const routeKey=JSON.stringify(q.route);let exposure=routeScores.get(routeKey);
   if(exposure===undefined){exposure=0;for(const c of diamond.core)for(const r of q.route){const d=(c.x-r.x)**2+(c.z-r.z)**2;if(d<=36)exposure+=1-d/72;}routeScores.set(routeKey,exposure);}
   const score=q.route.length*100+exposure-(p.x-18)**2*.0001-(p.z-18)**2*.0001;
   if(!chosen||score>chosen.score)chosen={...p,score};
  }
  assert.ok(g.occupy(chosen.x,chosen.z,placements.length+1).ok);
  placements.push({x:chosen.x,z:chosen.z,diamond:true,core:core.has(key(chosen)),routeSteps:g.route.length-1});
  pending.splice(pending.findIndex(p=>key(p)===key(chosen)),1);
 }
 assert.equal(g.route.length-1,718);
 const finalRoute=JSON.stringify(g.route),routeSet=new Set(g.route.map(key));
 const extras=[];
 for(let z=1;z<36;z++)for(let x=1;x<36;x++){
  if(routeSet.has(`${x},${z}`)||g.type(x,z)!=='buildable')continue;
  let exposure=0;for(const r of g.route){const d=(x-r.x)**2+(z-r.z)**2;if(d<=36)exposure+=1-d/72;}
  extras.push({x,z,score:exposure-((x-18)**2+(z-18)**2)*.005});
 }
 extras.sort((a,b)=>b.score-a.score||a.z-b.z||a.x-b.x);
 while(placements.length<250){
  let chosen=null;
  while(extras.length&&!chosen){const p=extras.shift(),q=g.canPlace(p.x,p.z);if(q.ok&&JSON.stringify(q.route)===finalRoute)chosen=p;}
  assert.ok(chosen,'250 exact-route preserving foundations');
  assert.ok(g.occupy(chosen.x,chosen.z,placements.length+1).ok);
  placements.push({x:chosen.x,z:chosen.z,diamond:false,core:false,routeSteps:g.route.length-1});
 }
 return {id:'diamond-spiral',diamondFoundations:128,coreFoundations:19,fullRouteSteps:718,policy:'Blind fixed locations; core first, then maximize ground route length and core exposure; after all 128 blueprint foundations, add legal off-route foundations preserving the exact Diamond route. Each location becomes a foundation only through Game.place before its random draw is revealed.',placements};
}
const planArg=process.argv.find(a=>a.startsWith('--plan='))?.slice(7);
const planPath=planArg?resolve(root,planArg):resolve(root,'tools/fr005-validation/diamond/placement-plan.json');
export const placementPlan=existsSync(planPath)?JSON.parse(readFileSync(planPath,'utf8')):makePlan();
if(!existsSync(planPath))writeFileSync(planPath,JSON.stringify(placementPlan,null,2)+'\n');
const placementPlanHash=createHash('sha256').update(JSON.stringify(placementPlan)).digest('hex');
const coreKeys=new Set(diamond.core.map(key));
const airRoute=[];
for(let i=1;i<CHECKPOINTS.length;i++){
 const a=CHECKPOINTS[i-1],b=CHECKPOINTS[i],n=Math.ceil(distance(a,b));
 for(let j=0;j<n;j++)airRoute.push({x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n});
}
airRoute.push({...CHECKPOINTS.at(-1)});
const snapshot=t=>({id:t.id,family:t.family,tier:t.tier,x:t.x,z:t.z,state:t.state,kills:t.kills||0,mvpLevel:t.mvpLevel||0});
const armyOf=g=>g.towers.filter(t=>t.state==='active');
const forbidden=(s,allowSecret)=>s.classification?.toUpperCase()==='TOP'||(!allowSecret&&(s.secret||s.classification?.toUpperCase()==='SECRET'));
const familyAllowed=(g,f,allowSecret)=>!!g.data.towers[f]&&!forbidden(g.data.towers[f],allowSecret);

function directPower(s,haste=1){
 const abilities=s.abilities||[],has=f=>abilities.some(a=>a.familyId===f),a=f=>abilities.filter(a=>a.familyId===f);
 const weapon=s.weaponCycle;
 const rate=weapon?weapon.magazine/((weapon.spinUpSeconds||0)+weapon.magazine*weapon.fixedInterval/haste+weapon.reload):haste/Math.max(.1,s.interval||1);
 const critical=a('critical-strike').reduce((v,q)=>Math.max(v,1+(q.chancePercent||0)/100*((q.multiplier||2)-1)),has('critical-strike')?1:1+(s.critChance||0)*((s.critMultiplier||2)-1));
 const count=s.multishot||a('multishot')[0]?.targets||1;
 let direct=(s.continuousAttack?s.continuousAttack.dps*Math.min(3,(s.continuousAttack.angleDegrees||45)/30):s.damage*rate*count)*critical;
 let extra=0,control=0,heal=0;
 for(const q of abilities){
  const f=q.familyId;
  if(f==='poison')extra+=(q.dps||0)*(q.duration||3)*rate*Math.min(2,count);
  if(f==='burn')extra+=(q.dps||0)*Math.min(3,count);
  if(['cleave-magical','cleave-physical','splash'].includes(f))extra+=s.damage*rate*(q.damagePercent||0)/100*Math.min(3,1+(q.radius||1)*.5)*critical;
  if(f==='lightning')extra+=(q.damage||0)*(q.targets||1)*(q.chancePercent||100)/100*rate;
  if(['spark','heat'].includes(f))extra+=(q.damage||0)/Math.max(.1,q.cooldown||1)*(q.targets||Math.min(3,1+(q.radius||0)*.4));
  if(f==='fire-aura')extra+=(q.dps||0)*Math.min(3,1+(q.radius||0)*.4);
  if(f==='moon-strike')extra+=(q.damage||s.damage*(q.bonusPercent||0)/100)*rate*(q.chancePercent||20)/100;
  if(f==='charged-attack')direct*=1+(q.bonusPercent||0)/100/(q.everyAttacks||5);
  if(f==='berserker'){const duty=(q.duration||3)/(q.cooldown||10);direct*=1-duty+duty*(1+(q.damageBonusPercent||0)/100)*(1+(q.attackSpeedBonusPercent||0)/100);}
  if(f==='ricochet')extra+=s.damage*rate*(q.chancePercent||20)/100*Math.min(3,q.maxBounces||q.bounces||1)*.5*critical;
  if(f==='execution')extra+=s.damage*9/(q.cooldown||15)+300;
  if(f==='slow')control=Math.max(control,(q.slowPercent||0)/100*.5);
  if(f==='slow-aura')control=Math.max(control,(q.slowPercent||0)/100);
  if(['freeze','stun'].includes(f))control+=Math.min(.4,(q.duration||0)*(q.chancePercent||0)/100*rate);
  if(f==='keep-recovery')heal=1;
 }
 if(!has('poison')&&s.poisonDps)extra+=s.poisonDps*(s.dotDuration||5)*rate;
 if(!has('burn')&&s.burnDps)extra+=s.burnDps;
 if(!has('fire-aura')&&s.burnAura)extra+=s.burnAura*2;
 if(!has('cleave-physical')&&!has('cleave-magical')&&s.cleave)extra+=s.damage*rate*s.cleave*2;
 control=Math.max(control,s.slowAura||0,(s.slow||0)*.5);
 return {direct,extra,control,heal,rate};
}

function makeEvaluator(g,policy,allowSecret){
 const exposure=new Map(),samples=[];
 for(let offset=0;offset<6;offset++){
  const wave=g.data.waves[Math.min(g.data.waves.length-1,g.round-1+offset)];
  for(const group of wave.groups){
   const e=g.data.enemies[group.type],variants=e.variants?.length?e.variants:[e];
   for(const v of variants)samples.push({e:{...e,...v,...group},weight:(group.count||1)/(offset+2)/variants.length});
  }
 }
 const totalWeight=samples.reduce((s,q)=>s+q.weight,0);
 const exp=(t,r,air=false)=>{
  const k=[t.x,t.z,Math.round(r*100),air].join(':');if(exposure.has(k))return exposure.get(k);
  let v=0;for(const p of air?airRoute:g.grid.route)if(distance(t,p)<=r)v++;
  exposure.set(k,v);return v;
 };
 const rawCache=new Map();
 const raw=(t)=>{const k=t.family+':'+t.tier;if(!rawCache.has(k))rawCache.set(k,towerStats(t,g.data));return rawCache.get(k);};
 const allowedRecipes=g.recipes.filter(r=>!r.currentRoundOnly&&familyAllowed(g,r.resultFamily||r.id,allowSecret));
 const progress=army=>{
  if(policy!=='recipe-planner')return 0;
  const counts=new Map();for(const t of army){const k=t.family+':'+t.tier;counts.set(k,(counts.get(k)||0)+1);}
  let sum=0;
  for(const r of allowedRecipes){
   const copy=new Map(counts);let n=0;
   for(const i of r.ingredients){const k=i.family+':'+i.tier;if((copy.get(k)||0)>0){n++;copy.set(k,copy.get(k)-1);}}
   if(!n||n===3)continue;
   const s=raw({family:r.resultFamily||r.id,tier:1}),p=directPower(s);
   const hypothetical=(p.direct+p.extra)*(1+Math.min(150,exp({x:18,z:18},s.range))/10);
   sum+=hypothetical*(n===2?.12:.012);
  }
  return sum;
 };
 const score=army=>{
  // Cached raw profiles avoid repeatedly rebuilding every support provider for
  // every hypothetical legal choice. This mirrors supportBonuses for utility
  // estimation only; every measured shot still runs the unmodified engine.
  const profiles=army.map(t=>{
   const haste=new Map();let damage=0,range=0,controlResistance=0,trueStrike=false;
   for(const other of army){
    const s=raw(other),d=distance(t,other);
    if(s.factionProfile){for(const a of s.abilities||[]){if(d>(a.radius||0))continue;switch(a.familyId){case'attack-speed-aura':haste.set('standard',Math.max(haste.get('standard')||0,a.bonusPercent/100));break;case'damage-aura':damage=Math.max(damage,a.bonusPercent/100);break;case'range-aura':range=Math.max(range,a.rangeBonus);break;case'protection-aura':controlResistance=Math.max(controlResistance,a.protectionPercent/100);break;case'true-strike-aura':trueStrike||=a.evasionIgnorePercent===100;break;}}continue;}
    const a=s.aura;if(!a||d>a.range)continue;
    if(a.haste){const k=a.stackKey==='otomad'?'otomad':'standard';haste.set(k,Math.max(haste.get(k)||0,a.haste));}
    for(const [k,v]of Object.entries(a.hasteGroups||{})){const group=k==='otomad'?'otomad':'standard';haste.set(group,Math.max(haste.get(group)||0,v));}
    damage=Math.max(damage,a.damageBonus||0);range=Math.max(range,a.rangeBonus||0);controlResistance=Math.max(controlResistance,a.controlResistance||0);trueStrike||=!!a.trueStrike;
   }
   const multiplier=(1+mvpDamageBonus(t))*(1+damage),bonuses={haste:1+[...haste.values()].reduce((a,b)=>a+b,0),damage:1+damage,range,controlResistance,trueStrike};
   const stats=factionPrimaryBonuses(scaleDamageStats(raw(t),multiplier),{...t,factionNow:0},army);
   if(stats.damage>0||stats.continuousAttack)stats.range+=range;
   if(stats.continuousAttack)stats.continuousAttack={...stats.continuousAttack,dps:stats.continuousAttack.dps*multiplier};
   stats.trueStrike||=trueStrike;
   return {t,stats,bonuses,multiplier};
  });
  // Utility heuristic only: estimate the fraction of an attacker's route exposure
  // that a single covering aura can breach. Actual events use the unchanged engine.
  // Keep the aura's explicit radius independent from attack range and Range Aura.
  const immunityAuras=profiles.flatMap(({t,stats})=>(stats.abilities||[]).filter(a=>['cancel-magic-immunity-aura','cancel-physical-immunity-aura'].includes(a.familyId)).map(a=>({x:t.x,z:t.z,radius:a.radius,multiplier:a.damageMultiplier,channel:a.familyId==='cancel-magic-immunity-aura'?'magical':'physical'})));
  const breach=(t,s,channel,flying)=>{
   let best=0;const route=flying?airRoute:g.grid.route,totalExposure=exp(t,s.range,flying);if(!totalExposure)return 0;
   for(const aura of immunityAuras){if(aura.channel!==channel)continue;const cacheKey=['breach',t.x,t.z,s.range,aura.x,aura.z,aura.radius,!!flying].join(':');
    let overlap=exposure.get(cacheKey);if(overlap===undefined){overlap=0;for(const point of route)if(distance(t,point)<=s.range&&distance(aura,point)<=aura.radius)overlap++;exposure.set(cacheKey,overlap);}
    best=Math.max(best,aura.multiplier*overlap/totalExposure);
   }return best;
  };
  const detection=profiles.some(p=>p.stats.detectionRange||p.stats.abilities?.some(q=>q.familyId==='visibility'));
  const shred=Math.max(0,...profiles.flatMap(p=>(p.stats.abilities||[]).filter(q=>['armor-reduction','armor-reduction-aura'].includes(q.familyId)).map(q=>q.armorReduction||0)));
  let total=0,control=0;
  for(const {t,stats:s,bonuses}of profiles){
   let factor=0;
   for(const {e,weight}of samples){
    let v=e.flying&&(s.groundOnly||s.melee)?0:1;
    if(s.type==='magical'&&e.magicImmune)v*=breach(t,s,'magical',!!e.flying);
    if(s.type==='physical'&&e.physicalImmune)v*=breach(t,s,'physical',!!e.flying);
    v*=30/(30+Math.max(0,(e.armor||0)-shred)*(1-(s.penetration||0)));
    if(e.stealth&&!detection)v*=.5;
    if(e.evasion&&!s.trueStrike)v*=1-e.evasion*(1-(s.evasionIgnore||0));
    v*=.3+exp(t,s.range,!!e.flying)/12;
    if(e.untouchable)v*=1-e.untouchable*(1-(bonuses.controlResistance||0))*.75;
    if(e.disarm)v*=.6+.4*(bonuses.controlResistance||0);
    factor+=v*weight;
   }
   factor/=Math.max(1,totalWeight);
   const p=directPower(s,bonuses.haste||1),exposureFactor=.3+exp(t,s.range)/12;
   total+=(p.direct+p.extra)*factor;
   if(p.heal&&g.lives<25)total+=Math.min(2500,(30-g.lives)*70)*exposureFactor;
   control=Math.max(control,p.control*Math.min(1,exp(t,s.range)/40));
  }
  return total*(1+control*1.4)+progress(army);
 };
 return {score,raw,progress,exp};
}

function bestAction(g,evaluate,allowSecret,withDraft=true){
 const base=armyOf(g),fresh=g.roundCandidates.map(c=>c.tower),baseScore=evaluate.score(base);
 let best=null;
 const consider=(action,army)=>{const value=evaluate.score(army);if(!best||value>best.value+1e-8)best={...action,value,delta:value-baseScore};};
 if(withDraft)for(const t of fresh){
  if(!familyAllowed(g,t.family,allowSecret))continue;
  consider({kind:'keep',anchor:t.id,used:[t.id]},[...base,{...t,state:'active'}]);
  const partner=g.mergePartner(t);
  if(partner)consider({kind:'merge',anchor:t.id,used:[t.id,partner.id]},[...base,{...t,tier:t.tier+1,state:'active',mvpLevel:Math.max(t.mvpLevel||0,partner.mvpLevel||0)}]);
 }
 for(const anchor of g.towers.filter(t=>['active','draft'].includes(t.state))){
  for(const recipe of g.availableRecipes(anchor)){
   const family=recipe.resultFamily||recipe.id;
   if(!familyAllowed(g,family,allowSecret))continue;
   const pieces=g.recipePieces(recipe,anchor);if(!pieces)continue;
   const draftUsed=pieces.some(t=>t.state==='draft');if(withDraft!==draftUsed)continue;
   const used=new Set(pieces.map(t=>t.id)),army=base.filter(t=>!used.has(t.id));
   army.push({...anchor,family,tier:1,state:'active',mvpLevel:Math.max(...pieces.map(t=>t.mvpLevel||0))});
   consider({kind:'craft',anchor:anchor.id,recipe:recipe.id,used:[...used]},army);
  }
 }
 if(!withDraft&&best&&best.delta<Math.max(1,baseScore*.005))return null;
 return best;
}

function execute(g,action,actions){
 const before={cp:g.commandPoints.value,gold:g.economy.gold,lives:g.lives};g.select(action.anchor);
 const entry={round:g.round,kind:action.kind,anchor:action.anchor,before,chosenUtility:action.value,delta:action.delta};
 if(action.kind==='craft'){
  const r=g.recipes.find(r=>r.id===action.recipe);entry.recipe=r.id;entry.result=r.resultFamily||r.id;entry.ingredients=g.recipePieces(r,g.selection).map(snapshot);assert.equal(entry.ingredients.length,3);assert.equal(new Set(entry.ingredients.map(t=>t.id)).size,3);assert.ok(g.craft(r.id));
 }else if(action.kind==='merge'){entry.ingredients=action.used.map(id=>snapshot(g.towers.find(t=>t.id===id)));assert.ok(g.merge());}
 else{entry.defender=snapshot(g.selection);assert.ok(g.keep());}
 entry.after={cp:g.commandPoints.value,gold:g.economy.gold,lives:g.lives};entry.resultDefender=snapshot(g.selection);actions.push(entry);
}

function improvePositions(g,evaluate,actions){
 let guard=0;
 while(g.commandActions.move.available&&guard++<4){
  const army=armyOf(g),baseScore=evaluate.score(army),allWalls=g.towers.filter(t=>t.state==='ruin');
  let best=null;
  for(const t of army){
   const range=evaluate.raw(t).range,walls=allWalls.map(w=>({w,score:evaluate.exp(w,range)+evaluate.exp(w,range,true)*.5})).sort((a,b)=>b.score-a.score||a.w.id-b.w.id).slice(0,8).map(q=>q.w);
   for(const w of walls){
    const v=evaluate.score(army.map(q=>q.id===t.id?{...q,x:w.x,z:w.z}:q));
    if((!best||v>best.value)&&v>baseScore+Math.max(20,baseScore*.025))best={id:t.id,wall:w.id,value:v,from:{x:t.x,z:t.z},to:{x:w.x,z:w.z}};
   }
  }
  if(!best)break;
  const cp=g.commandPoints.value;assert.ok(g.beginMove());assert.ok(g.selectMove(best.id));assert.ok(g.selectMove(best.wall));
  actions.push({round:g.round,kind:'move',...best,cpBefore:cp,cpAfter:g.commandPoints.value});
 }
}

export function simulate({faction,seed,policy='immediate',allowSecret=false,dt=.1,maxSteps=2000000,log=true}){
 const started=Date.now(),g=new Game(datasets[faction],{seed}),actions=[],waves=[],events={spawns:0,deaths:0,leaks:0,bossSpawns:0,bossDeaths:0,bossLeaks:0,waveComplete:0,recovery:0},damageByFamily={};
 let placed=0,steps=0,wave=null,finiteChecks=0;const secretEligibility=[],secretCheckedRounds=new Set();
 const assertLegal=()=>{for(const t of g.towers){assert.ok(g.validFactionUnit(t));if(t.state==='active')assert.ok(familyAllowed(g,t.family,allowSecret),`Prohibited defender ${t.family}`);}assert.equal(g.grid.occupied.size,placed);assert.equal(g.towers.length,placed);assert.ok(g.lives<=30);finiteChecks++;};
 g.on((type,payload)=>{
  if(type==='spawn'){events.spawns++;if(wave)wave.spawns++;if(payload.enemy.boss){events.bossSpawns++;if(wave)wave.bossSpawns++;}}
  if(type==='death'){events.deaths++;if(wave)wave.deaths++;if(payload.enemy.boss){events.bossDeaths++;if(wave)wave.bossDeaths++;}}
  if(type==='leak'){events.leaks++;if(wave){wave.leaks++;wave.leakedEnemies.push({type:payload.enemy.type,boss:!!payload.enemy.boss,hp:payload.enemy.hp,maxHp:payload.enemy.maxHp,leak:payload.enemy.leak});}if(payload.enemy.boss){events.bossLeaks++;if(wave)wave.bossLeaks++;}}
  if(type==='recover'){events.recovery+=payload.amount;if(wave)wave.recovery+=payload.amount;}
  if(type==='damage-trace'&&payload.effectiveDamage>0&&payload.source){const family=payload.source.family;damageByFamily[family]=(damageByFamily[family]||0)+payload.effectiveDamage;if(wave)wave.damageByFamily[family]=(wave.damageByFamily[family]||0)+payload.effectiveDamage;}
  if(type==='wave-complete'&&wave){events.waveComplete++;wave.completed=true;wave.fullClear=wave.spawns===wave.deaths;wave.livesAfter=g.lives;wave.killsAfter=g.kills;wave.leaksAfter=g.leaks;wave.simulatedSeconds=g.elapsedSeconds-wave.timeBefore;wave.cpAfter=g.commandPoints.value;wave.armyAfter=armyOf(g).map(snapshot);}
  if(type==='command-points')actions.push({round:g.round,kind:'boss-cp',...payload,balance:g.commandPoints.value});
 });
 while(!['won','lost'].includes(g.phase)&&steps<maxSteps){
  if(g.phase==='select'||g.phase==='ready'){secretCheckedRounds.add(g.round);const anchors=g.roundCandidates.map(c=>c.tower).filter(t=>g.availableRecipes(t).some(r=>r.id==='ladyclaire')).map(t=>t.id);if(anchors.length&&!secretEligibility.some(r=>r.round===g.round))secretEligibility.push({round:g.round,phase:g.phase,anchors});}
  if(g.phase==='build'){
   while(g.phase==='build'){
    const p=placementPlan.placements[placed];assert.ok(p,'Legal foundation budget');
    assert.ok(g.place(p.x,p.z),`Failed legal placement ${placed}`);placed++;
    actions.push({round:g.round,kind:'place',index:placed,defender:snapshot(g.selection),routeSteps:g.grid.route.length-1});
   }
  }else if(g.phase==='select'){
   let evaluate=makeEvaluator(g,policy,allowSecret),action=bestAction(g,evaluate,allowSecret,true);assert.ok(action);
   const activeValue=evaluate.score(armyOf(g));
   if(g.commandActions.reroll.available&&g.commandPoints.value>=3&&g.round>=5&&action.kind==='keep'&&action.delta<activeValue*.08){
    const before=g.roundCandidates.map(c=>snapshot(c.tower)),cp=g.commandPoints.value;assert.ok(g.reroll());
    actions.push({round:g.round,kind:'reroll',before,after:g.roundCandidates.map(c=>snapshot(c.tower)),cpBefore:cp,cpAfter:g.commandPoints.value});
    evaluate=makeEvaluator(g,policy,allowSecret);action=bestAction(g,evaluate,allowSecret,true);assert.ok(action);
   }
   if(policy==='recipe-planner'&&g.commandPoints.value>=2&&g.round>=4){
    const unused=g.roundCandidates.map(c=>c.tower).filter(t=>!action.used.includes(t.id));
    const candidates=unused.map(t=>({t,value:evaluate.progress([...armyOf(g),{...t,state:'active'}])-evaluate.progress(armyOf(g))})).filter(q=>q.value>Math.max(75,activeValue*.015)).sort((a,b)=>b.value-a.value||a.t.id-b.t.id);
    if(candidates.length){const t=candidates[0].t;g.select(t.id);if(g.commandActions.reserve.available){const cp=g.commandPoints.value;assert.ok(g.reserve());actions.push({round:g.round,kind:'reserve',defender:snapshot(t),cpBefore:cp,cpAfter:g.commandPoints.value});}}
   }
   execute(g,action,actions);assertLegal();
  }else if(g.phase==='ready'){
   let evaluate=makeEvaluator(g,policy,allowSecret),guard=0,action;
   while(guard++<40&&(action=bestAction(g,evaluate,allowSecret,false))){execute(g,action,actions);evaluate=makeEvaluator(g,policy,allowSecret);}
   improvePositions(g,evaluate,actions);assertLegal();
   wave={round:g.round,completed:false,spawns:0,deaths:0,leaks:0,bossSpawns:0,bossDeaths:0,bossLeaks:0,recovery:0,leakedEnemies:[],damageByFamily:{},livesBefore:g.lives,killsBefore:g.kills,leaksBefore:g.leaks,timeBefore:g.elapsedSeconds,cpBefore:g.commandPoints.value,goldBefore:g.economy.gold,mastery:g.economy.mastery,foundations:placed,diamondFoundations:Math.min(128,placed),routeSteps:g.grid.route.length-1,army:armyOf(g).map(snapshot)};waves.push(wave);assert.ok(g.startCombat());
  }else{
   g.tick(dt);
   if(steps%500===0){for(const e of g.combat.enemies)assert.ok(Number.isFinite(e.hp)&&Number.isFinite(e.x)&&Number.isFinite(e.z));assertLegal();}
  }
  steps++;
 }
 assert.ok(['won','lost'].includes(g.phase),'Campaign timeout');assertLegal();
 if(wave&&!wave.completed){wave.livesAfter=g.lives;wave.killsAfter=g.kills;wave.leaksAfter=g.leaks;wave.simulatedSeconds=g.elapsedSeconds-wave.timeBefore;wave.cpAfter=g.commandPoints.value;wave.armyAfter=armyOf(g).map(snapshot);}
 if(g.phase==='won'){assert.equal(g.round,50);assert.equal(events.waveComplete,50);}
 return {schemaVersion:1,faction,seed,policy,allowSecret,dt,controllerHash,placementPlanHash,placementPlanFile:planPath,sourceHashes,maze:'diamond-spiral',noTop:true,outcome:g.phase,completed:g.phase==='won'?g.round:g.round-1,lastWave:g.round,lives:g.lives,kills:g.kills,leaks:g.leaks,score:g.score,foundations:placed,fullDiamondReached:placed>=128,cp:g.commandPoints.value,gold:g.economy.gold,events,finalWaveFullClear:!!wave?.fullClear,finalBossKilled:g.round===50&&!!wave?.bossDeaths&&!wave?.bossLeaks,damageByFamily,crafts:actions.filter(a=>a.kind==='craft').map(a=>({round:a.round,recipe:a.recipe,result:a.result,name:g.data.towers[a.result].name})),secretCrafts:actions.filter(a=>a.kind==='craft'&&g.data.towers[a.result].secret).length,merges:actions.filter(a=>a.kind==='merge').length,moves:actions.filter(a=>a.kind==='move').length,reserves:actions.filter(a=>a.kind==='reserve').length,rerolls:actions.filter(a=>a.kind==='reroll').length,steps,finiteChecks,secretEligibility,secretCheckedRounds:[...secretCheckedRounds],rulesetRevision:g.data.rulesetRevision,wallMs:Date.now()-started,waves,actions:log?actions:undefined};
}

async function main(){
 const arg=(k,d)=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3)??d;
 const tag=arg('tag','pilot'),policies=arg('policies','immediate,recipe-planner').split(','),factions=arg('factions','crown,forge,grove').split(','),allowSecret=arg('secret','false')==='true';
 const train=[42,123,807,43877,1009,8928,16847,24766],seedArg=arg('seeds','training'),count=Number(arg('count','24'));
 const seeds=seedArg==='training'?train:seedArg==='heldout'?Array.from({length:count},(_,i)=>1900001+i*15427):seedArg.split(',').map(Number);
 const out=resolve(base,tag);mkdirSync(out,{recursive:true});
 const rows=[];
 for(const seed of seeds)for(const policy of policies)for(const faction of factions){
  const path=resolve(out,`${faction}-${policy}-${seed}.json`);
  const row=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):simulate({faction,seed,policy,allowSecret});
  assert.deepEqual(row.sourceHashes,sourceHashes,'Cached result source hashes');assert.equal(row.controllerHash,controllerHash,'Cached controller hash; use a new output tag after changing strategy');assert.equal(row.allowSecret,allowSecret,'Cached secret policy');assert.equal(row.dt,.1,'Cached timestep');
  assert.equal(row.placementPlanHash,placementPlanHash,'Cached placement plan');
  if(!existsSync(path))writeFileSync(path,JSON.stringify(row,null,2)+'\n');
  rows.push(row);console.log(JSON.stringify({faction,seed,policy,allowSecret,outcome:row.outcome,completed:row.completed,lastWave:row.lastWave,lives:row.lives,crafts:row.crafts.length,moves:row.moves,ms:row.wallMs,file:path}));
 }
 const summary=Object.fromEntries(factions.flatMap(faction=>policies.map(policy=>{const runs=rows.filter(r=>r.faction===faction&&r.policy===policy),values=runs.map(r=>r.completed);return [faction+'-'+policy,{runs:runs.length,wins:runs.filter(r=>r.outcome==='won').length,meanCompleted:values.reduce((a,b)=>a+b,0)/values.length,min:Math.min(...values),max:Math.max(...values),meanKills:runs.reduce((a,b)=>a+b.kills,0)/runs.length,meanCrafts:runs.reduce((a,b)=>a+b.crafts.length,0)/runs.length}];})));
 for(const file of sourceFiles)assert.equal(hash(file),sourceHashes[file],'Protected game source unchanged: '+file);
 const manifest={date:'2026-11-02',version:JSON.parse(readFileSync(resolve(root,'package.json'))).version,sourceHashes,method:{seeds,policies,factions,allowSecret,dt:.1,maze:placementPlan.id,normalGame:true,legalAcquisitionOnly:true,noTop:true,recipePlanner:'Same real campaign APIs and known fixed future-wave schedule; estimated next six waves as an experienced-player strategy, not limited live UI preview. Immediate optimizes current army; planner adds partial recipe progress and paid reserves. Both make conditional paid rerolls and paid moves into the Diamond core. No injected resources, army, ranks, walls, health or forced draws.'},summary,runs:rows.map(r=>({faction:r.faction,policy:r.policy,seed:r.seed,file:`${r.faction}-${r.policy}-${r.seed}.json`,outcome:r.outcome,completed:r.completed,lives:r.lives,kills:r.kills,leaks:r.leaks,crafts:r.crafts.length,secretCrafts:r.secretCrafts,wallMs:r.wallMs})),limitations:['A fixed automated strategy measures this controller, not optimal human play or an impossibility proof.','All campaign combat mechanics are measured by the actual current engine. Utility scores only guide legal player choices.','Main ordinary-only cohorts exclude Secret Lady Claire as well as TOP; any natural-secret sensitivity explicitly allows her legal recipe.','Paired initial seeds do not force equal downstream draws: combat and draft share RNG and faction combats diverge.','Diamond is constructed legally throughout the run; it is not free at wave 1. Runs that lose before 128 foundations do not reach the completed 718-step ground route.']};
 writeFileSync(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)await main();

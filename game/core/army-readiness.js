import {damageAfterDefense, combatTowerStats} from './math.js';
import {enemyRulesFor} from './enemy-rules.js';
import {damageType,effectDamageType,statusEffectAllowed,attackTargetAllowed,slowAuraApplies} from './combat-rules.js';

const DEFAULTS=Object.freeze({minStrongCoverage:.75,minGoodCoverage:.5,minFairCoverage:.25,damageWindowSeconds:5,burstHealthFraction:.2,shieldHitsPerSecond:2,minimumUsefulControl:.1,regenerationPressureMultiplier:1,areaTargetBudget:3});
export const READINESS_SCOPE='Composition only; own MVP bonuses and self support count. Allied aura overlap, placement, range coverage and maze length are not evaluated.';
const clamp=n=>Math.max(0,Math.min(1,n));
const positive=n=>Number.isFinite(n)?Math.max(0,n):0;
const magical=type=>damageType(type)==='magical';
const physical=type=>damageType(type)==='physical';
const levels=['weak','fair','good','strong'];
const averagePoisonStacks=(rate,window)=>{
  const hits=Math.max(0,Math.ceil(rate*window-1e-9)),full=Math.min(hits,Math.max(0,Math.floor((window-5)*rate)+1)),partial=hits-full;
  return (full*5+partial*window-(full+hits-1)*partial/(2*rate))/window;
};

function settings(data){
  const result={...DEFAULTS},configured=data?.balance?.wavePreview?.readiness||{};
  for(const key of Object.keys(result))if(Number.isFinite(configured[key])&&configured[key]>0)result[key]=configured[key];
  result.minFairCoverage=clamp(result.minFairCoverage);
  result.minGoodCoverage=Math.max(result.minFairCoverage,clamp(result.minGoodCoverage));
  result.minStrongCoverage=Math.max(result.minGoodCoverage,clamp(result.minStrongCoverage));
  result.areaTargetBudget=Math.max(1,Math.floor(result.areaTargetBudget));
  return result;
}

function modelsFor(towers,data){
  const result=[];
  for(const tower of towers){
    const definition=data?.towers?.[tower.family];
    if(!definition||definition.levels&&!definition.levels[tower.tier-1])continue;
    try{
      const own={...tower,x:0,z:0},{stats,bonuses:self}=combatTowerStats(own,[own],data);
      if(!Number.isFinite(stats.damage)||!Number.isFinite(stats.interval)||stats.interval<=0)continue;
      // Only guaranteed self support enters arithmetic. Allied aura overlap is
      // placement dependent and must not make a composition cache depend on Move.
      result.push({family:tower.family,stats,paused:!!tower.attackPaused,rate:self.haste/stats.interval,protection:self.controlResistance||0});
    }catch{/* Incomplete imported definitions cannot establish capability. */}
  }
  return result;
}

function rawEnemy(variant,group,rules){
  const raw=variant.enemy||{},hp=variant.maxHp??raw.maxHp??raw.hp;
  if(!Number.isFinite(hp)||hp<=0)return null;
  return {...raw,type:raw.type||group.type,maxHp:hp,hp,armor:positive(variant.armor??raw.armor),flying:!!(variant.flying??raw.flying??group.flying),boss:Object.hasOwn(raw,'boss')?!!raw.boss:!!group.boss,statuses:{},reactiveStacks:raw.reactiveArmor?rules.reactive.maxStacks:0};
}

function matches(id,variant,enemy){
  if(id==='standard')return true;
  if(Array.isArray(variant.threatIds))return variant.threatIds.includes(id);
  // Fallback is for small integrations/test fixtures without classified IDs.
  // Production classification, including relative health, belongs to the analyzer.
  const map={heavyArmor:enemy.armor>0,fast:enemy.speed>0,swarm:true,highHealth:true,regeneration:enemy.regen>0,recharge:enemy.recharge>0,magicImmune:enemy.magicImmune,physicalImmune:enemy.physicalImmune,flying:enemy.flying,shield:enemy.refraction>0,reactiveArmor:enemy.reactiveArmor>0,shell:enemy.krakenShell>0,evasion:enemy.evasion>0,stealth:enemy.stealth||enemy.cloakDaggers,blink:enemy.blink>0,buffer:enemy.type==='shaman'||enemy.hasteAura,debuffer:enemy.disarm||enemy.untouchable||enemy.type==='sapper',thief:enemy.thief>0,boss:enemy.boss};
  return !!map[id];
}

function capabilities(models,enemy,count,data,cfg){
  const R=enemyRulesFor(data),balance={armorConstant:30,...data.balance},adjusted={...enemy,armorShred:0};
  const flags={magic:false,physical:false,holy:false,shred:false,antiHeal:false,control:false,conditionalGaze:false,area:false,bypass:false,protection:false,extendedDetection:false,trueStrike:false};
  const reaches=s=>attackTargetAllowed(s,enemy);
  const defended=(amount,type,s,direct=false)=>{
    let value=damageAfterDefense(positive(amount),type,adjusted,s,balance);
    if(direct)value=Math.max(0,value-positive(enemy.krakenShell));
    if(direct&&!s.trueStrike)value*=1-clamp(positive(enemy.evasion));
    return value;
  };
  const hitAmount=s=>s.damage*(1+clamp(positive(s.critChance))*Math.max(0,(s.critMultiplier||1)-1))*(enemy.beast?(s.beastBonus||1):1)*((enemy.boss||enemy.type==='shaman')?(s.bossBonus||1):1);
  for(const {stats:s,family,paused}of models){
    flags.extendedDetection||=(family==='cleric'?R.reveal.clericRadius:positive(s.detectionRange))>R.reveal.defenderRadius;
    flags.protection||=positive(s.aura?.controlResistance)>0;
    if(!paused)adjusted.armorShred=Math.max(adjusted.armorShred,positive(s.armorShredAura));
  }
  // Armor reduction is a contact effect: damage immunity does not prevent it.
  // Shield/evasion pressure is still reflected in the nominal damage below.
  for(const {stats:s,paused}of models)if(!paused&&reaches(s))adjusted.armorShred=Math.max(adjusted.armorShred,positive(s.shred),enemy.flying?positive(s.antiAirShred):0);
  flags.shred=adjusted.armorShred>0||models.some(({stats:s,paused})=>!paused&&reaches(s)&&s.penetration>0);
  let direct=0,hits=0,aura=0,secondary=0,groupedDirect=0,groupedSecondary=0,slow=0,freeze=0,healCoverage=0,protectedDamage=0;
  const dots={burn:0,poison:0,bleed:0},areaBudget=Math.min(Math.max(1,count),cfg.areaTargetBudget);
  const tag=(type,value)=>{if(value>0){flags.magic||=magical(type);flags.physical||=physical(type);flags.holy||=damageType(type)==='holy';}};
  for(const {stats:s,rate:baseRate,protection,paused}of models){
    if(paused)continue;
    let rate=baseRate;
    const controlAllowed=statusEffectAllowed(enemy,'slow');
    if(s.burnAura){const type=effectDamageType(s,'burn'),value=defended(s.burnAura,type,s);aura+=value;tag(type,value);flags.bypass||=value>0;flags.area||=value>0&&count>1;}
    if(slowAuraApplies(s,enemy))slow=Math.max(slow,positive(s.slowAura));
    if(!reaches(s)||s.damage<=0)continue;
    const hit=hitAmount(s),value=defended(hit,s.type,s,true),landed=value>0;
    if(enemy.untouchable>0&&(landed||s.burnAura&&defended(s.burnAura,effectDamageType(s,'burn'),s)>0)){
      const penalty=clamp(enemy.untouchable)*(1-clamp(protection)),duration=R.dread.duration,interval=1/rate;
      const slowedProgress=duration*(1-penalty);
      rate=1/(interval<=slowedProgress?interval/Math.max(.0001,1-penalty):duration+interval-slowedProgress);
    }
    hits+=rate*(s.trueStrike?1:1-clamp(positive(enemy.evasion)));direct+=value*rate;protectedDamage+=value*rate*protection;
    groupedDirect+=value*rate*Math.min(Math.max(1,count),Math.max(1,s.multishot||1));
    if(landed){
      tag(s.type,value);flags.trueStrike||=!!s.trueStrike;
      if(statusEffectAllowed(enemy,'burn'))dots.burn=Math.max(dots.burn,defended(s.burnDps||s.damage*positive(s.burn),effectDamageType(s,'burn'),s));
      // A nominal hit stream builds independent 5s stacks. It does not assume
      // permanent exposure beyond this explicitly bounded damage window.
      if(statusEffectAllowed(enemy,'poison'))dots.poison+=defended(s.poisonDps||s.damage*positive(s.poison),effectDamageType(s,'poison'),s)*averagePoisonStacks(rate,cfg.damageWindowSeconds);
      dots.bleed=Math.max(dots.bleed,defended(s.damage*positive(s.bleed),effectDamageType(s,'bleed'),s));
      if(controlAllowed){
        slow=Math.max(slow,positive(s.slow),enemy.flying?positive(s.antiAirSlow):0);
        const freezeDuration=(s.freezeDuration||.8)*(enemy.boss?.5:1),freezeDuty=clamp(positive(s.freeze))*freezeDuration*rate;
        freeze=Math.max(freeze,s.stunRecovery?Math.min(freezeDuty,freezeDuration/s.stunRecovery):freezeDuty);
      }
      if(statusEffectAllowed(enemy,'healBlock')&&s.healingBlockDuration){flags.antiHeal=true;healCoverage+=rate*s.healingBlockDuration;}
      const fork=positive(s.forkedTargets)?defended(s.forkedDamage,effectDamageType(s,'lightning'),s)*(s.forkedChance||1)*rate:0;
      const burn=defended(s.damage*positive(s.burnedMultiplier),effectDamageType(s,'burn'),s)*positive(s.burnedChance)*rate;
      secondary+=fork+burn;groupedSecondary+=fork*Math.min(Math.max(1,count),s.forkedTargets||1)+burn*areaBudget;
      flags.area||=(s.multishot||1)>1;
    }
    // Golem's gaze can proc on contact even when its damage type is immune.
    flags.conditionalGaze||=positive(s.stoneGazeChance)>0&&(landed||!!s.petrifyIgnoresImmunity);
    if(count>1){
      if(s.splash){groupedDirect+=value*rate*(areaBudget-1);flags.area||=landed;}
      if(s.cleave){const type=s.cleaveType||s.type,value=defended(hit*s.cleave,type,s)*rate*(areaBudget-1);groupedSecondary+=value;tag(type,value);flags.area||=value>0;flags.bypass||=value>0;}
      if(s.chain&&(!s.chainSequential||landed)){const value=defended(s.chainDamage||s.damage*.55,s.type,s,true)*rate*(s.chainChance||1)*Math.min(count-1,s.chain);groupedDirect+=value;flags.area||=value>0;}
      // Nearby-ally-triggered frost is placement dependent, not guaranteed here.
      if(landed&&s.bouncingFrost&&s.bouncingFrostTrigger!=='nearby-ally-magic-hit'){const value=defended(s.bouncingFrostDamage||s.damage,effectDamageType(s,'frost'),s,true)*rate*(s.bouncingFrostChance||1)*s.bouncingFrost;groupedDirect+=value;flags.area||=value>0;}
    }
  }
  const appliedDot=Object.values(dots).reduce((a,b)=>a+b,0);flags.bypass||=appliedDot>0||secondary>0;
  flags.control=Math.max(slow,freeze)>=cfg.minimumUsefulControl;
  // Nominal evenly spaced hit stream: the next shield batch begins only after
  // depletion plus its delay, rather than a periodic reset of live charges.
  const attempts=Math.ceil(hits*cfg.damageWindowSeconds-1e-9),charges=Math.ceil(positive(enemy.refraction));
  const cycle=charges?charges-1+Math.max(1,Math.ceil(hits*R.refraction.period-1e-9)):1;
  const blocked=charges?Math.floor(attempts/cycle)*charges+Math.min(attempts%cycle,charges):0;
  const shieldProgress=charges&&attempts?clamp((attempts-blocked)/attempts):charges?0:1;
  const dps=(direct+secondary+appliedDot)*shieldProgress+aura;
  const grouped=(groupedDirect+groupedSecondary+appliedDot*areaBudget)*shieldProgress+aura*areaBudget;
  const capacity=dps*cfg.damageWindowSeconds/(enemy.maxHp*cfg.burstHealthFraction);
  const healing=enemy.maxHp*positive(enemy.regen)+enemy.maxHp*.5*positive(enemy.recharge)/R.recharge.period;
  const control=clamp(Math.max(slow*(enemy.boss?(balance.bossSlowMultiplier??.5):1),freeze)/Math.max(.5,cfg.minimumUsefulControl));
  return {capacity,groupCapacity:grouped*cfg.damageWindowSeconds/(enemy.maxHp*Math.max(1,count)*cfg.burstHealthFraction),healingPressure:healing?dps/(healing*cfg.regenerationPressureMultiplier):capacity,healCoverage:clamp(healCoverage/Math.max(1,count))*shieldProgress,hitPressure:hits/Math.max(cfg.shieldHitsPerSecond,positive(enemy.refraction)/cfg.damageWindowSeconds),control,protectedShare:direct?protectedDamage/direct:0,flags};
}

function scoreFor(id,m,enemy,R){
  const damage=clamp(m.capacity);
  if(id==='swarm')return clamp(m.groupCapacity);
  if(id==='fast')return Math.max(damage*.6,Math.min(m.control,damage+.25));
  if(id==='regeneration'||id==='recharge')return Math.max(Math.min(damage,clamp(m.healingPressure)),m.flags.antiHeal?Math.min(m.healCoverage,damage+.25):0);
  if(id==='shield')return Math.min(damage,Math.max(clamp(m.hitPressure),m.flags.bypass?damage:0));
  if(id==='stealth')return damage*(m.flags.extendedDetection?1:R.reveal.defenderRadius/R.reveal.clericRadius);
  if(id==='debuffer')return Math.max(damage*.5,enemy.type!=='sapper'&&m.flags.protection?Math.min(1,damage*.5+.25+m.protectedShare*.25):0);
  return damage;
}

function responseFor(id,flags){
  const mitigation=flags.shred?'Armor reduction or penetration is available; on-hit reduction requires contact and is still blocked by evasion or shields.':'All three damage classes face the forecast armor.';
  const responses={
    standard:'Nominal focused damage is compared with actual enemy health and defenses; target exposure still matters.',
    heavyArmor:mitigation,reactiveArmor:mitigation+' Maximum reactive stacks are used for this comparison.',
    highHealth:'Nominal damage is compared with actual maximum health; conditional effects and target exposure still matter.',
    magicImmune:flags.physical||flags.holy?'Physical or Holy damage is available; poison, burning and healing block remain blocked even from Holy sources.':'No applicable damage was found for at least one possible immune variant.',
    physicalImmune:flags.magic||flags.holy?'Magical or Holy damage is available; slows and freeze remain blocked even from Holy sources.':'No applicable damage was found for at least one possible immune variant.',
    flying:'Ranged attacks and applicable damage auras are counted; melee attacks are excluded. Ranger air debuffs respect normal defenses.',
    fast:flags.control?'Applicable slowing or freezing is available; bosses reduce its effect or duration.':flags.conditionalGaze?'Facing-dependent petrification ignores damage immunities after a contact proc; sustained facing is not assumed.':'No applicable slowing or freezing; response depends on damage.',
    swarm:flags.area?'Multiple-target or area damage is available; target grouping and proc timing matter.':'Only focused damage is available against the group.',
    regeneration:flags.antiHeal?'Applicable healing block is available after a damaging hit; damage is also compared with regeneration.':'Damage is compared with regeneration; no applicable healing block was found.',
    recharge:flags.antiHeal?'Applicable healing block can prevent missing-health recharge after a damaging hit.':'Damage is compared with missing-health recharge; no applicable healing block was found.',
    shield:flags.bypass?'Applied damage over time, damage auras and non-direct secondary effects bypass hit shields; on-hit effects need an initial successful hit.':'Direct attack frequency is compared with shield pressure; no applicable bypass damage was found.',
    shell:flags.bypass?'Applied damage over time, auras and non-direct effects bypass the direct-hit shell.':'Shell reduction is subtracted from every direct hit, including Holy damage.',
    evasion:flags.trueStrike?'True Strike is available; nearby allied aim support depends on placement.':'Evasion reduces Physical, Magical and Holy direct hits; applied DOT and auras do not roll evasion.',
    stealth:flags.extendedDetection?'Extended detection is available; proximity and checkpoint reveal still matter.':'Active defenders reveal nearby cloaked enemies; no extended detection was found.',
    blink:flags.conditionalGaze?'Petrification can prevent teleport steps, but requires an attack proc and sustained facing; ordinary slowing cannot.':'Ordinary slowing does not prevent teleport steps; damage is compared without assuming a longer route.',
    buffer:'Damage against support units uses their own defenses; nearby buffs and target priority depend on position.',
    debuffer:flags.protection?'Control protection is available within a support radius; it does not prevent scorched-barricade attack penalties.':'No control protection was found; independent damage auras can continue during disarm.',
    thief:'Damage is compared with gold-stealing enemies; arrival and target priority are not predicted.',
    boss:'Damage is compared with possible bosses; secondary-target cleave is excluded for an isolated boss.',
  };
  return responses[id]||'Current damage capability is compared with possible enemies.';
}

/** A cached, deterministic comparison of abilities, never a combat forecast. */
export class ArmyReadiness{
  constructor(data){this.data=data||{towers:{},balance:{}};this.cache=new WeakMap();}
  evaluate(analysis,towers=[]){
    const active=towers.filter(t=>t?.state==='active'),cfg=settings(this.data),rules=enemyRulesFor(this.data);
    const signature=JSON.stringify([active.map(t=>[t.family,t.tier,t.mvpLevel||0,!!t.attackPaused]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),cfg,rules]);
    const cacheable=analysis&&typeof analysis==='object';
    let entries=cacheable?this.cache.get(analysis):null;
    if(entries?.has(signature))return entries.get(signature);
    const models=modelsFor(active,this.data),rows=[];
    const classified=analysis?.primaryThreats||analysis?.threats||[];
    const threats=classified.length?classified:(analysis?.enemies||[]).some(group=>group?.count>0)?[{id:'standard',label:'Focused damage'}]:[];
    for(const threat of threats){
      const candidates=[],flags={};
      for(const group of analysis.enemies||[]){
        if(!Number.isFinite(group.count)||group.count<=0)continue;
        const scores=[];
        for(const variant of group.variants||[]){
          const enemy=rawEnemy(variant,group,rules);if(!enemy||!matches(threat.id,variant,enemy))continue;
          const metrics=capabilities(models,enemy,group.count,this.data,cfg);
          scores.push(scoreFor(threat.id,metrics,enemy,rules));
          // Text only claims capabilities common to all relevant variants.
          for(const [key,value]of Object.entries(metrics.flags))flags[key]=flags[key]===undefined?value:flags[key]&&value;
        }
        if(scores.length)candidates.push({score:Math.min(...scores),count:group.count});
      }
      const weight=candidates.reduce((sum,c)=>sum+c.count,0),score=weight?candidates.reduce((sum,c)=>sum+c.score*c.count,0)/weight:0;
      const ordinal=score>=cfg.minStrongCoverage?3:score>=cfg.minGoodCoverage?2:score>=cfg.minFairCoverage?1:0;
      rows.push(Object.freeze({threatId:threat.id,label:threat.label||threat.id,level:levels[ordinal],ordinal,response:active.length?candidates.length?responseFor(threat.id,flags):'Insufficient enemy data to compare this threat.':'No active defenders yet.'}));
    }
    const result=Object.freeze({activeCount:active.length,empty:active.length===0,rows:Object.freeze(rows),scope:READINESS_SCOPE});
    if(cacheable){if(!entries){entries=new Map();this.cache.set(analysis,entries);}if(entries.size>=8)entries.delete(entries.keys().next().value);entries.set(signature,result);}
    return result;
  }
}

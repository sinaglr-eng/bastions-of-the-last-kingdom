import {damageAfterDefense, supportBonuses, towerStats,bypassesAirDefenses} from './math.js';
import {ENEMY_RULES as R} from './enemy-rules.js';

const DEFAULTS=Object.freeze({minStrongCoverage:.75,minGoodCoverage:.5,minFairCoverage:.25,damageWindowSeconds:5,burstHealthFraction:.2,shieldHitsPerSecond:2,minimumUsefulControl:.1,regenerationPressureMultiplier:1,areaTargetBudget:3});
export const READINESS_SCOPE='Composition only; placement, range coverage and maze length are not evaluated.';
const clamp=n=>Math.max(0,Math.min(1,n));
const positive=n=>Number.isFinite(n)?Math.max(0,n):0;
const magical=type=>!['physical','piercing','pure'].includes(type);
const physical=type=>['physical','piercing'].includes(type);
const levels=['weak','fair','good','strong'];

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
      const own={...tower,x:0,z:0},stats=towerStats(own,data),self=supportBonuses(own,[own],data);
      if(!Number.isFinite(stats.damage)||!Number.isFinite(stats.interval)||stats.interval<=0)continue;
      // Only guaranteed self support enters arithmetic. Allied aura overlap is
      // placement dependent and must not make a composition cache depend on Move.
      result.push({family:tower.family,stats:{...stats,damage:positive(stats.damage)*self.damage,trueStrike:!!(stats.trueStrike||self.trueStrike)},rate:self.haste/stats.interval,protection:self.controlResistance||0});
    }catch{/* Incomplete imported definitions cannot establish capability. */}
  }
  return result;
}

function rawEnemy(variant,group){
  const raw=variant.enemy||{},hp=variant.maxHp??raw.maxHp??raw.hp;
  if(!Number.isFinite(hp)||hp<=0)return null;
  return {...raw,type:raw.type||group.type,maxHp:hp,hp,armor:positive(variant.armor??raw.armor),flying:!!(variant.flying??raw.flying??group.flying),boss:Object.hasOwn(raw,'boss')?!!raw.boss:!!group.boss,resists:{...raw.resists},statuses:{},reactiveStacks:raw.reactiveArmor?R.reactive.maxStacks:0};
}

function matches(id,variant,enemy){
  if(id==='standard')return true;
  if(Array.isArray(variant.threatIds))return variant.threatIds.includes(id);
  // Fallback is for small integrations/test fixtures without classified IDs.
  // Production classification, including relative health, belongs to the analyzer.
  const map={heavyArmor:enemy.armor>0,fast:enemy.speed>0,swarm:true,highHealth:true,regeneration:enemy.regen>0,recharge:enemy.recharge>0,magicResistance:Object.entries(enemy.resists).some(([type,value])=>magical(type)&&value>0),magicImmune:enemy.magicImmune,physicalImmune:enemy.physicalImmune,flying:enemy.flying,shield:enemy.refraction>0,reactiveArmor:enemy.reactiveArmor>0,shell:enemy.krakenShell>0,evasion:enemy.evasion>0,stealth:enemy.stealth||enemy.cloakDaggers,blink:enemy.blink>0,buffer:enemy.type==='shaman'||enemy.type==='warlock'||enemy.hasteAura,debuffer:enemy.disarm||enemy.untouchable||enemy.type==='sapper',thief:enemy.thief>0,boss:enemy.boss};
  return !!map[id];
}

function capabilities(models,enemy,count,data,cfg){
  const balance={armorConstant:30,maxResistance:.85,...data.balance},adjusted={...enemy,armorShred:0,magicShred:0};
  const flags={magic:false,physical:false,pure:false,shred:false,magicShred:false,antiHeal:false,control:false,conditionalGaze:false,area:false,bypass:false,antiAirBypass:false,protection:false,extendedDetection:false,trueStrike:false};
  const reaches=s=>!s.melee||!enemy.flying;
  const defended=(amount,type,s,direct=false)=>{
    let value=damageAfterDefense(positive(amount),type,adjusted,s,balance);
    if(direct&&type!=='pure'&&!bypassesAirDefenses(enemy,s))value=Math.max(0,value-positive(enemy.krakenShell));
    if(direct&&physical(type)&&!s.trueStrike&&!bypassesAirDefenses(enemy,s))value*=1-clamp(positive(enemy.evasion));
    return value;
  };
  const hitAmount=s=>s.damage*(1+clamp(positive(s.critChance))*Math.max(0,(s.critMultiplier||1)-1))*(enemy.beast?(s.beastBonus||1):1)*((enemy.boss||enemy.type==='shaman')?(s.bossBonus||1):1);
  for(const {stats:s,family}of models){
    flags.extendedDetection||=(family==='cleric'?R.reveal.clericRadius:positive(s.detectionRange))>R.reveal.defenderRadius;
    flags.protection||=positive(s.aura?.controlResistance)>0;
    if(!enemy.magicImmune||s.auraPiercesImmunity){adjusted.armorShred=Math.max(adjusted.armorShred,positive(s.armorShredAura));adjusted.magicShred=Math.max(adjusted.magicShred,positive(s.magicShredAura));}
  }
  // On-hit debuffs require a damaging, targetable hit. Ranger lineage has an
  // explicit flying-only bypass; other immunity-piercing flags stay effect-only.
  for(const {stats:s}of models)if(reaches(s)&&defended(hitAmount(s),s.type,s,true)>0){
    adjusted.armorShred=Math.max(adjusted.armorShred,positive(s.shred),enemy.flying?positive(s.antiAirShred):0);
    if(!enemy.magicImmune||bypassesAirDefenses(enemy,s))adjusted.magicShred=Math.max(adjusted.magicShred,positive(s.shredMagic));
    if(enemy.flying&&(!enemy.magicImmune||s.antiAirPiercesImmunity||bypassesAirDefenses(enemy,s)))adjusted.magicShred=Math.max(adjusted.magicShred,positive(s.antiAirMagicShred));
  }
  flags.shred=adjusted.armorShred>0||models.some(({stats:s})=>reaches(s)&&s.penetration>0);
  flags.magicShred=adjusted.magicShred>0;
  let direct=0,hits=0,aura=0,secondary=0,groupedDirect=0,groupedSecondary=0,slow=0,freeze=0,healCoverage=0,protectedDamage=0;
  let unshieldedDirect=0,unshieldedSecondary=0,unshieldedGroupedDirect=0,unshieldedGroupedSecondary=0,unshieldedHealCoverage=0;
  const dots={burn:0,poison:0,bleed:0},unshieldedDots={burn:0,poison:0,bleed:0};
  const areaBudget=Math.min(Math.max(1,count),cfg.areaTargetBudget);
  for(const {stats:s,rate,protection}of models){
    if(s.burnAura){const value=defended(s.burnAura,'fire',s);aura+=value;flags.magic||=value>0;flags.bypass||=value>0;flags.area||=value>0&&count>1;}
    if(!enemy.magicImmune)slow=Math.max(slow,positive(s.slowAura));
    if(!reaches(s)||s.damage<=0)continue;
    const hit=hitAmount(s),value=defended(hit,s.type,s,true),landed=value>0,airBypass=bypassesAirDefenses(enemy,s);
    // Evasion precedes the shield check. Immunity follows it, so even a hit of
    // an immune damage type can consume a shield without applying its effects.
    hits+=rate*(physical(s.type)&&!s.trueStrike&&!airBypass?1-clamp(positive(enemy.evasion)):1);direct+=value*rate;protectedDamage+=value*rate*protection;
    groupedDirect+=value*rate*Math.min(Math.max(1,count),Math.max(1,s.multishot||1));
    if(airBypass){unshieldedDirect+=value*rate;unshieldedGroupedDirect+=value*rate*Math.min(Math.max(1,count),Math.max(1,s.multishot||1));}
    if(landed){flags.magic||=magical(s.type);flags.physical||=physical(s.type);flags.pure||=s.type==='pure';flags.trueStrike||=!!s.trueStrike||airBypass;flags.antiAirBypass||=airBypass;flags.bypass||=airBypass;
      if(!enemy.magicImmune||airBypass){
        dots.burn=Math.max(dots.burn,defended(s.damage*positive(s.burn),'fire',s));
        dots.poison=Math.max(dots.poison,defended(s.poisonDps||s.damage*positive(s.poison),'poison',s));
        slow=Math.max(slow,positive(s.slow));
        const freezeDuration=(s.freezeDuration||.8)*(enemy.boss?.5:1),freezeDuty=clamp(positive(s.freeze))*freezeDuration*rate;
        freeze=Math.max(freeze,s.stunRecovery?Math.min(freezeDuty,freezeDuration/s.stunRecovery):freezeDuty);
        flags.conditionalGaze||=positive(s.stoneGazeChance)>0;
        if(s.healingBlockDuration){flags.antiHeal=true;healCoverage+=rate*s.healingBlockDuration;if(airBypass)unshieldedHealCoverage+=rate*s.healingBlockDuration;}
      }
      dots.bleed=Math.max(dots.bleed,defended(s.damage*positive(s.bleed),'physical',s));
      if(airBypass){for(const [key,amount]of Object.entries({burn:s.damage*positive(s.burn),poison:s.poisonDps||s.damage*positive(s.poison),bleed:s.damage*positive(s.bleed)}))unshieldedDots[key]=Math.max(unshieldedDots[key],defended(amount,key==='burn'?'fire':key==='bleed'?'physical':'poison',s));}
      if(enemy.flying&&(!enemy.magicImmune||s.antiAirPiercesImmunity||airBypass))slow=Math.max(slow,positive(s.antiAirSlow));
      // Forks and burning procs can also strike the original target in Combat.
      const fork=positive(s.forkedTargets)?defended(s.forkedDamage,'arcane',s)*(s.forkedChance||1)*rate:0;
      const burn=defended(s.damage*positive(s.burnedMultiplier),'fire',s)*positive(s.burnedChance)*rate;
      secondary+=fork+burn;groupedSecondary+=fork*Math.min(Math.max(1,count),s.forkedTargets||1)+burn*areaBudget;
      if(airBypass){unshieldedSecondary+=fork+burn;unshieldedGroupedSecondary+=fork*Math.min(Math.max(1,count),s.forkedTargets||1)+burn*areaBudget;}
    }
    if(count>1){
      if(s.splash){groupedDirect+=value*rate*(areaBudget-1);if(airBypass)unshieldedGroupedDirect+=value*rate*(areaBudget-1);flags.area||=landed;}
      if(s.cleave){const value=defended(hit*s.cleave,s.cleaveType||s.type,s)*rate*(areaBudget-1);groupedSecondary+=value;if(airBypass)unshieldedGroupedSecondary+=value;flags.area||=value>0;flags.bypass||=value>0;flags.pure||=value>0&&s.cleaveType==='pure';}
      if(s.chain&&(!s.chainSequential||landed)){const value=defended(s.chainDamage||s.damage*.55,s.type,s,true)*rate*(s.chainChance||1)*Math.min(count-1,s.chain);groupedDirect+=value;if(airBypass)unshieldedGroupedDirect+=value;flags.area||=value>0;}
      // Ally-triggered bouncing frost depends on nearby caster placement. It is
      // not credited as guaranteed independent damage in a composition score.
      if(landed&&s.bouncingFrost&&s.bouncingFrostTrigger!=='nearby-ally-magic-hit'){const value=defended(s.bouncingFrostDamage||s.damage,'frost',s,true)*rate*(s.bouncingFrostChance||1)*s.bouncingFrost;groupedDirect+=value;if(airBypass)unshieldedGroupedDirect+=value;flags.area||=value>0;}
    }
    flags.area||=landed&&(s.multishot||1)>1;
  }
  const appliedDot=Object.values(dots).reduce((a,b)=>a+b,0);
  flags.bypass||=appliedDot>0||secondary>0;
  flags.control=Math.max(slow,freeze)>=cfg.minimumUsefulControl;
  // Compare shield startup/refresh pressure without simulating attacks. Applied
  // DoT needs the initial damaging hit; independent burn auras do not.
  const shieldProgress=enemy.refraction?clamp(1-positive(enemy.refraction)/(Math.max(.0001,hits)*Math.min(cfg.damageWindowSeconds,R.refraction.period))):1;
  const unshieldedDot=Object.values(unshieldedDots).reduce((a,b)=>a+b,0),unshielded=unshieldedDirect+unshieldedSecondary+unshieldedDot;
  const unshieldedGrouped=unshieldedGroupedDirect+unshieldedGroupedSecondary+unshieldedDot*areaBudget;
  const dps=(direct+secondary+appliedDot-unshielded)*shieldProgress+unshielded+aura;
  const grouped=(groupedDirect+groupedSecondary+appliedDot*areaBudget-unshieldedGrouped)*shieldProgress+unshieldedGrouped+aura*areaBudget;
  const capacity=dps*cfg.damageWindowSeconds/(enemy.maxHp*cfg.burstHealthFraction);
  const healing=enemy.maxHp*positive(enemy.regen)+enemy.maxHp*.5*positive(enemy.recharge)/R.recharge.period;
  const control=clamp(Math.max(slow*(enemy.boss?(balance.bossSlowMultiplier??.5):1),freeze)/Math.max(.5,cfg.minimumUsefulControl));
  const freeHealCoverage=clamp(unshieldedHealCoverage/Math.max(1,count));
  return {capacity,groupCapacity:grouped*cfg.damageWindowSeconds/(enemy.maxHp*Math.max(1,count)*cfg.burstHealthFraction),healingPressure:healing?dps/(healing*cfg.regenerationPressureMultiplier):capacity,healCoverage:(clamp(healCoverage/Math.max(1,count))-freeHealCoverage)*shieldProgress+freeHealCoverage,hitPressure:hits/Math.max(cfg.shieldHitsPerSecond,positive(enemy.refraction)/cfg.damageWindowSeconds),control,protectedShare:direct?protectedDamage/direct:0,flags};
}

function scoreFor(id,m,enemy){
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
  if(flags.antiAirBypass&&['heavyArmor','reactiveArmor','magicResistance','magicImmune','physicalImmune','flying','shield','shell','evasion'].includes(id))return 'Ranger lineage bypasses all damage defenses against flying targets, including armor, resistance, immunity, shields, evasion and shells.';
  const mitigation=flags.shred?'Armor reduction or penetration is available; on-hit reduction requires damage to land.':flags.magic?'Magical damage avoids armor.':flags.pure?'Pure damage avoids armor; secondary attacks require additional targets.':'Physical damage still faces the forecast armor.';
  const responses={
    standard:'Nominal focused damage is compared with actual enemy health and defenses; target exposure still matters.',
    heavyArmor:mitigation,reactiveArmor:mitigation+' Maximum reactive stacks are used for this comparison.',
    highHealth:'Nominal damage is compared with actual maximum health; conditional effects and target exposure still matter.',
    magicResistance:flags.physical||flags.pure?'Physical or applicable pure damage avoids magical resistance.':flags.magicShred?'Magic resistance reduction is available; damage still respects immunity.':'Magical damage remains reduced by the forecast resistance.',
    magicImmune:flags.physical||flags.pure?'Physical or applicable pure damage is available; magical damage and most magical effects are blocked.':'No applicable damage was found for at least one possible immune variant.',
    physicalImmune:flags.magic||flags.pure?'Magical or applicable pure damage is available; physical and piercing damage are blocked.':'No applicable damage was found for at least one possible immune variant.',
    flying:'Ranged attacks and applicable damage auras are counted; melee attacks are excluded.',
    fast:flags.control?'Applicable slowing or freezing is available; bosses reduce its effect or duration.':flags.conditionalGaze?'Facing-dependent petrification is available after an attack proc; sustained facing is not assumed.':'No applicable slowing or freezing; response depends on damage.',
    swarm:flags.area?'Multiple-target or area damage is available; target grouping and proc timing matter.':'Only focused damage is available against the group.',
    regeneration:flags.antiHeal?'Applicable healing block is available after a damaging hit; damage is also compared with regeneration.':'Damage is compared with regeneration; no applicable healing block was found.',
    recharge:flags.antiHeal?'Applicable healing block can prevent missing-health recharge after a damaging hit.':'Damage is compared with missing-health recharge; no applicable healing block was found.',
    shield:flags.bypass?'Damage auras and applied damage over time or secondary effects can bypass hit shields; initial hits may still be blocked.':'Direct attack frequency is compared with shield pressure; no applicable bypass damage was found.',
    shell:flags.bypass||flags.pure?'Applied damage over time, auras, non-direct effects or pure damage can bypass the direct-hit shell.':'The shell reduction is subtracted from each non-pure direct hit.',
    evasion:flags.trueStrike||flags.magic||flags.pure?'Unfailing aim or applicable magical/pure damage is available; nearby allied aim support depends on placement.':'Physical direct-hit damage is reduced by evasion in this comparison.',
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
    const active=towers.filter(t=>t?.state==='active'),cfg=settings(this.data);
    const signature=JSON.stringify([active.map(t=>[t.family,t.tier]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),cfg]);
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
          const enemy=rawEnemy(variant,group);if(!enemy||!matches(threat.id,variant,enemy))continue;
          const metrics=capabilities(models,enemy,group.count,this.data,cfg);
          scores.push(scoreFor(threat.id,metrics,enemy));
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

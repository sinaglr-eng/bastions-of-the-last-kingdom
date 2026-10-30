import {factionPrimaryBonuses} from './faction-combat.js';
export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function weightedIndex(weights, rng = Math.random) {
  const total = weights.reduce((sum, n) => sum + n, 0);
  if (total <= 0 || weights.some(n => n < 0 || !Number.isFinite(n))) throw new Error('Invalid probability weights');
  let value = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    value -= weights[i];
    if (value < 0) return i;
  }
  return weights.findLastIndex(n => n > 0);
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
import {damageType,canonicalCombatStats,scaleDamageStats} from './combat-rules.js';
import {mvpDamageBonus} from './mvp.js';
// Kept as a compatibility export for old integrations; no current damage
// class or Ranger can bypass all airborne defenses.
export const bypassesAirDefenses = () => false;
export function damageDefenseBreakdown(amount,type,enemy,stats,balance){
  const canonical=damageType(type,stats.type),armor=Math.max(0,(enemy.armor||0)+(enemy.reactiveStacks||0)*(enemy.reactiveArmor||0)-(enemy.armorShred||0))*(1-Math.max(0,Math.min(1,stats.penetration||0)));
  const constant=balance.armorConstant||30,multiplier=constant/(constant+armor);
  const blockReason=canonical==='physical'&&enemy.physicalImmune&&!(enemy.statuses?.breachPhysical?.time>0)?'physical-immunity':canonical==='magical'&&enemy.magicImmune&&!(enemy.statuses?.breachMagic?.time>0)?'magic-immunity':null;
  return {type:canonical,effectiveArmor:armor,armorMultiplier:multiplier,afterArmor:blockReason?0:amount*multiplier*(canonical==='physical'&&enemy.physicalImmune&&enemy.statuses?.breachPhysical?.time>0?enemy.statuses.breachPhysical.multiplier:canonical==='magical'&&enemy.magicImmune&&enemy.statuses?.breachMagic?.time>0?enemy.statuses.breachMagic.multiplier:1),blockReason};
}
export function damageAfterDefense(amount, type, enemy, stats, balance) {
  return damageDefenseBreakdown(amount,type,enemy,stats,balance).afterArmor;
}
export function towerStats(tower, data) {
  const stats = data.towers[tower.family];
  if(!stats.advanced&&stats.levels)return canonicalCombatStats({...stats,...stats.levels[tower.tier-1]});
  const multiplier = stats.advanced ? 1 : data.balance.tierDamage[tower.tier - 1];
  const aura=stats.aura?{...stats.aura,...(stats.aura.hasteGroups?{hasteGroups:{...stats.aura.hasteGroups}}:{})}:null;
  return canonicalCombatStats({...scaleDamageStats(stats,multiplier),...(aura?{aura}:{}),range:stats.range+(stats.advanced?0:data.balance.tierRange[tower.tier-1])});
}
export function supportBonuses(tower,towers,data) {
  const haste=new Map();let damage=0,range=0,trueStrike=false,controlResistance=0;
  for(const other of towers){
    if(other.state!=='active')continue;
    const definition=towerStats(other,data);
    if(definition.factionProfile){for(const a of definition.abilities||[]){if(distance(tower,other)>(a.radius||0))continue;switch(a.familyId){case'attack-speed-aura':haste.set('standard',Math.max(haste.get('standard')||0,a.bonusPercent/100));break;case'damage-aura':damage=Math.max(damage,a.bonusPercent/100);break;case'range-aura':range=Math.max(range,a.rangeBonus);break;case'protection-aura':controlResistance=Math.max(controlResistance,a.protectionPercent/100);break;}}continue;}
    const aura=definition.aura;
    if(!aura||distance(tower,other)>aura.range)continue;
    if(aura.haste){const key=aura.stackKey==='otomad'?'otomad':'standard';haste.set(key,Math.max(haste.get(key)||0,aura.haste));}
    for(const [key,value]of Object.entries(aura.hasteGroups||{})){const group=key==='otomad'?'otomad':'standard';haste.set(group,Math.max(haste.get(group)||0,value));}
    damage=Math.max(damage,aura.damageBonus||0);range=Math.max(range,aura.rangeBonus||0);
    trueStrike||=!!aura.trueStrike;controlResistance=Math.max(controlResistance,aura.controlResistance||0);
  }
  return {haste:1+[...haste.values()].reduce((a,b)=>a+b,0),damage:1+damage,range,...(trueStrike?{trueStrike}:{}),...(controlResistance?{controlResistance}:{})};
}
export function combatTowerStats(tower,towers,data){
  const bonuses=supportBonuses(tower,towers,data),multiplier=(1+mvpDamageBonus(tower))*bonuses.damage;
  const stats=factionPrimaryBonuses(scaleDamageStats(towerStats(tower,data),multiplier),tower,towers);
  if(stats.damage>0||stats.continuousAttack)stats.range+=bonuses.range;
  if(stats.continuousAttack)stats.continuousAttack={...stats.continuousAttack,dps:stats.continuousAttack.dps*multiplier};
  stats.trueStrike||=!!bonuses.trueStrike;
  if(stats.berserkHaste)bonuses.haste*=stats.berserkHaste;if(stats.berserkResistance)bonuses.controlResistance=Math.max(bonuses.controlResistance||0,stats.berserkResistance);return {stats,bonuses,multiplier};
}

// Offensive effect footprints are independent of direct targeting and range support.
export const offensiveAuraRange=(stats,kind)=>kind==='burn'?stats.burnAuraRange??stats.range:kind==='slow'?stats.slowAuraRange??stats.range:stats.effectRange??stats.range;

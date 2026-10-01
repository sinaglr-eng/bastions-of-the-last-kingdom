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
export function damageAfterDefense(amount, type, enemy, stats, balance) {
  if(type==='pure')return amount;
  if (type === 'physical' || type === 'piercing') {
    if(enemy.physicalImmune)return 0;
    const armor = Math.max(0, (enemy.armor || 0) + (enemy.reactiveStacks||0)*(enemy.reactiveArmor||0) - (enemy.armorShred || 0)) * (1 - (stats.penetration || 0));
    return amount * balance.armorConstant / (balance.armorConstant + armor);
  }
  if(enemy.magicImmune)return 0;
  let resistance = (enemy.resists?.magic || 0) + (enemy.resists?.[type] || 0) + (enemy.ward || 0) - (enemy.magicShred || 0);
  resistance = Math.min(balance.maxResistance, Math.max(-0.3, resistance));
  return amount * (1 - resistance);
}
export function towerStats(tower, data) {
  const stats = data.towers[tower.family];
  if(!stats.advanced&&stats.levels)return {...stats,...stats.levels[tower.tier-1]};
  const multiplier = stats.advanced ? 1 : data.balance.tierDamage[tower.tier - 1];
  const aura=stats.aura?{...stats.aura,...(stats.aura.hasteGroups?{hasteGroups:{...stats.aura.hasteGroups}}:{})}:null;
  return {...stats, damage: stats.damage * multiplier, ...(aura?{aura}:{}), ...(stats.burnAura?{burnAura:stats.burnAura*multiplier}:{}), ...(stats.poisonDps?{poisonDps:stats.poisonDps*multiplier}:{}), ...(stats.chainDamage?{chainDamage:stats.chainDamage*multiplier}:{}), ...(stats.forkedDamage?{forkedDamage:stats.forkedDamage*multiplier}:{}), ...(stats.bouncingFrostDamage?{bouncingFrostDamage:stats.bouncingFrostDamage*multiplier}:{}),range: stats.range + (stats.advanced ? 0 : data.balance.tierRange[tower.tier - 1])};
}
export function supportBonuses(tower,towers,data) {
  const haste=new Map();let damage=0,range=0,trueStrike=false,controlResistance=0;
  for(const other of towers){
    if(other.state!=='active')continue;
    const aura=towerStats(other,data).aura;
    if(!aura||distance(tower,other)>aura.range)continue;
    if(aura.haste){const key=aura.stackKey||'strongest';haste.set(key,Math.max(haste.get(key)||0,aura.haste));}
    for(const [key,value]of Object.entries(aura.hasteGroups||{}))haste.set(key,Math.max(haste.get(key)||0,value));
    damage=Math.max(damage,aura.damageBonus||0);range=Math.max(range,aura.rangeBonus||0);
    trueStrike||=!!aura.trueStrike;controlResistance=Math.max(controlResistance,aura.controlResistance||0);
  }
  return {haste:1+[...haste.values()].reduce((a,b)=>a+b,0),damage:1+damage,range,...(trueStrike?{trueStrike}:{}),...(controlResistance?{controlResistance}:{})};
}

// Only these three classes participate in damage defense. Older authored
// elemental names remain useful for presentation, never as extra defenses.
export const DAMAGE_TYPES=Object.freeze(['physical','magical','holy']);
export function damageType(type,fallback='magical'){
  if(type==='physical'||type==='piercing')return 'physical';
  if(type==='holy')return 'holy';
  if(type==='pure')return fallback==='pure'?'magical':damageType(fallback);
  return 'magical';
}
export const ignoresDamageImmunity=stats=>damageType(stats.type)==='holy';
// Damage class never changes the category of a status effect. Only Golem's
// explicitly authored petrification has a separate immunity bypass.
export function statusEffectAllowed(enemy,effect){
  if(['slow','freeze','gazeSlow'].includes(effect))return !enemy.physicalImmune;
  if(['poison','burn','healBlock'].includes(effect))return !enemy.magicImmune;
  return true;
}
export const attackTargetAllowed=(stats,enemy)=>!enemy.flying||!(stats.melee||stats.groundOnly);
export const slowAuraApplies=(stats,enemy)=>!!stats.slowAura&&statusEffectAllowed(enemy,'slow')&&(!stats.slowAuraGroundOnly||!enemy.flying);
export const effectDamageType=(stats,effect)=>ignoresDamageImmunity(stats)?'holy':effect==='bleed'?'physical':'magical';
export function canonicalCombatStats(stats){
  const result={...stats,type:damageType(stats.type),projectileEffect:stats.projectileEffect||stats.type};
  if(stats.cleave)result.cleaveType=damageType(stats.cleaveType||stats.type,stats.type);
  // These obsolete flags must never revive an old Ranger damage bypass.
  for(const key of ['antiAirBypassesDefenses','antiAirMagicShred','antiAirPiercesImmunity','magicShredAura','shredMagic','effectsIgnoreImmunity'])delete result[key];
  return result;
}
export function scaleDamageStats(stats,multiplier){
  const result={...stats};
  for(const key of ['damage','poisonDps','burnDps','burnAura','chainDamage','forkedDamage','bouncingFrostDamage'])if(Number.isFinite(stats[key]))result[key]=stats[key]*multiplier;
  return result;
}

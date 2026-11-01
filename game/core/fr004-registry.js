import requirement from '../../data/fr004.json' with {type:'json'};
export const FR004_RULESET_REVISION=requirement.rulesetRevision;
export const FR004_PHYSICAL_AURA_RADII=Object.freeze([4,4.5,5,5.5,6,6.5]);
const profileAt=(registry,change)=>registry.factions.find(f=>f.id===change.factionId)?.units.find(u=>u.id===change.unitId)?.profiles[change.rank-1];
const fieldAt=(profile,field)=>field.split('.').reduce((value,key)=>value?.[key],profile);
export function primaryWeaponDps(profile){
 if(profile.continuousAttack)return profile.continuousAttack.dps;
 const w=profile.weaponCycle;if(w){const seconds=(w.spinUpSeconds||0)+w.magazine*w.fixedInterval+w.reload;return seconds>0?profile.damage*w.magazine/seconds:0;}
 return profile.interval>0?profile.damage/profile.interval:0;
}
// Permanent changes precede faction conversion, support and MVP. No
// packet-wide multiplier is installed, so fixed secondary damage stays exact.
export function applyFr004Registry(baseline){
 if(baseline.revision!==requirement.baselineRulesetRevision||!baseline.fr002||!baseline.fr003||baseline.fr004)throw Error('FR-004 requires the implemented FR-003 baseline exactly once');
 const dwarves=baseline.factions.find(f=>f.id==='forge'),keys=new Set(requirement.profileChanges.map(c=>c.key)),native=dwarves?.units.filter(u=>u.id!=='ladyclaire');
 if(native?.length!==45||native.reduce((n,u)=>n+u.profiles.length,0)!==85||keys.size!==85||requirement.auraChanges.length!==10)throw Error('Incomplete FR-004 native scope');
 for(const u of native)for(let i=0;i<u.profiles.length;i++)if(!keys.has(`forge/${u.id}/${i+1}`))throw Error('FR-004 profile identity missing');
 for(const change of requirement.profileChanges){
  const p=profileAt(baseline,change);
  if(change.factionId!=='forge'||change.unitId==='ladyclaire'||!p||!['damage','continuousAttack.dps'].includes(change.field)||fieldAt(p,change.field)!==change.before||p.interval!==change.interval||p.range!==change.attackRange||p.type!==change.damageType||Math.abs(change.after-change.before*change.damageFactor)>1e-9)throw Error('FR-004 primary baseline drift: '+change.key);
 }
 for(const change of requirement.auraChanges){const a=profileAt(baseline,change)?.abilities.find(a=>a.familyId===change.familyId);if(!a||change.familyId!=='cancel-physical-immunity-aura'||a.levelId!==change.levelId||a.level!==change.level||a.radius!==change.beforeRadius||a.damageMultiplier!==change.damageMultiplier||change.afterRadius!==FR004_PHYSICAL_AURA_RADII[a.level-1])throw Error('FR-004 aura baseline drift: '+change.key);}
 const registry=structuredClone(baseline);registry.revision=FR004_RULESET_REVISION;registry.fr004=true;
 for(const change of requirement.profileChanges){
  const p=profileAt(registry,change);if(change.field==='damage')p.damage=change.after;else p.continuousAttack.dps=change.after;
  p.primaryDamageBonusPercent=change.bonusPercent;p.primaryDamageBonusApplied=true;p.primaryDamageApplication='Included in the base primary field; do not multiply owned damage packets again.';
  const dps=primaryWeaponDps(p),crit=p.abilities.find(a=>a.familyId==='critical-strike');
  if(p.cycleMetrics)p.cycleMetrics={...p.cycleMetrics,primaryDps:dps};
  if(p.expectedMetrics||crit)p.expectedMetrics={...p.expectedMetrics,primaryDps:dps*(1+(crit?.chancePercent||0)/100*((crit?.multiplier||1)-1))};
 }
 const levels=new Map();for(const change of requirement.auraChanges){const a=profileAt(registry,change).abilities.find(a=>a.familyId===change.familyId);a.radius=change.afterRadius;a.text=`Immune enemies within ${a.radius} tiles take ${Math.round(a.damageMultiplier*100)}% of normal Physical damage.`;levels.set(a.level,structuredClone(a));}
 registry.physicalImmunityAuraLevels=[...levels.values()].sort((a,b)=>a.level-b.level);
 return registry;
}

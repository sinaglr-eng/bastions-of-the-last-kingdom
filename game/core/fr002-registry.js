import approved from '../../data/fr002-approved.json' with {type:'json'};
export const FR002_RULESET_REVISION=approved.rulesetRevision;
const levels=new Map(approved.levels.map(a=>[a.id,a]));
export function applyFr002Registry(baseline){
 const registry=structuredClone(baseline);registry.revision=FR002_RULESET_REVISION;registry.fr002=true;
 for(const r of approved.recipes){const unit=registry.factions.find(f=>f.id===r.factionId).units.find(u=>u.id===r.id);if(JSON.stringify(unit.recipe)!==JSON.stringify(r.before))throw Error('FR-002 recipe baseline drift: '+r.id);unit.recipe=structuredClone(r.after);}
 for(const f of registry.factions)for(const u of f.units)u.profiles.forEach((p,index)=>{
  const key=`${f.id}/${u.id}/${index+1}`;p.abilities=(approved.assignments[key]||[]).map(id=>{const a=structuredClone(levels.get(id));if(!a)throw Error('FR-002 ability missing: '+id);a.levelId=a.id;a.levelLabel=a.label;delete a.id;delete a.label;return a;});
  p.fr002=true;p.fr002HumanChanges=approved.humanChanges[key]||[];
  const stat=approved.terminalStats.find(s=>s.factionId===f.id&&s.unitId===u.id);if(stat&&index===0&&u.id!=='dw_emberanvil'){if(p.damage!==stat.current)throw Error('FR-002 stat baseline drift: '+u.id);p.damage=stat.after;}
  const cone=p.abilities.find(a=>a.familyId==='flame-cone');if(cone){p.continuousAttack={...p.continuousAttack,dps:cone.dps,range:cone.range,angleDegrees:cone.coneDegrees};p.range=cone.range;}
  const crit=p.abilities.find(a=>a.familyId==='critical-strike');if(p.expectedMetrics||crit)p.expectedMetrics={...p.expectedMetrics,primaryDps:p.interval>0?p.damage/p.interval*(1+(crit?.chancePercent||0)/100*((crit?.multiplier||1)-1)):0};
  if(p.cycleMetrics&&p.weaponCycle){const w=p.weaponCycle,cycle=(w.spinUpSeconds||0)+w.magazine*w.fixedInterval+w.reload;p.cycleMetrics={...p.cycleMetrics,cycleSeconds:cycle,primaryDps:Math.round(p.damage*w.magazine/cycle*100)/100};}
 });
 return registry;
}
// Human attacks retain their established engine, base damage, cadence and
// range. Only the fourteen reviewed ability exceptions change effective fields.
export function fr002HumanStats(original,profile){
 const s={...original,abilities:structuredClone(profile.abilities),description:profile.abilities.map(a=>a.text).join(' '),abilityCatalogue:true,fr002:true};
 for(const family of profile.fr002HumanChanges){const a=profile.abilities.find(a=>a.familyId===family);
  switch(family){
   case 'slow':s.slowDuration=a.duration;if(a.targeting==='flying-only')s.antiAirSlow=a.slowPercent/100;else{s.slow=a.slowPercent/100;if(a.radius)s.effectsRadius=a.radius;}break;
   case 'slow-aura':s.slowAura=a.slowPercent/100;s.slowAuraRange=a.radius;s.slowAuraGroundOnly=!!a.groundOnly;break;
   case 'fire-aura':s.burnAura=a.dps;s.burnAuraRange=a.radius;break;
   case 'armor-reduction':if(a.targeting==='flying-only')s.antiAirShred=a.armorReduction;else s.shred=a.armorReduction;break;
   case 'burn':s.burnDps=a.dps;s.dotDuration=a.duration;break;
   case 'anti-regeneration':s.healingBlockDuration=a.duration;break;
   case 'lightning':if(a.mode==='forked-lightning'){s.forkedDamage=a.damage;}else{s.chain=a.targets;s.chainDamage=a.damage;s.chainRange=a.linkRange;s.chainChance=a.chancePercent/100;s.chainSequential=a.mode==='sequential-chain';}break;
   default:throw Error('Unreviewed Human ability change: '+family);
  }
 }
 return s;
}

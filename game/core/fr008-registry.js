export const FR008_RULESET_REVISION='fr008-r1-20261106';
export function applyFr008Registry(baseline){
 if(baseline.revision!=='fr006-fr007-r3-20261106'||!baseline.fr007||baseline.fr008)throw Error('FR-008 requires FR-007 revision 3 exactly once');
 const registry=structuredClone(baseline);registry.revision=FR008_RULESET_REVISION;registry.fr008=true;
 for(const u of registry.factions.find(f=>f.id==='forge').units)for(const p of u.profiles)for(const a of p.abilities){
  if(a.familyId==='sky-hunt')a.text+=' Physically immune flyers inside a Cancel Physical Immunity Aura receive this Slow multiplied by its strongest transmission. A timed Physical breach still permits full Slow.';
  if(a.familyId==='cancel-physical-immunity-aura')a.text+=' Physically immune flyers also receive covering Dwarf Sky Hunt Slow at this transmission fraction. Other companion control immunities remain active.';
 }
 return registry;
}

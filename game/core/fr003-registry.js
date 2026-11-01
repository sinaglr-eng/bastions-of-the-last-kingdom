import approved from '../../data/fr003-approved.json' with {type:'json'};
export const FR003_RULESET_REVISION=approved.rulesetRevision;
const canonical=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value);
export function applyFr003Registry(baseline){
 if(baseline.revision!==approved.baselineRulesetRevision)throw Error('FR-003 requires the implemented FR-002 registry');
 const registry=structuredClone(baseline);registry.revision=FR003_RULESET_REVISION;registry.fr003=true;
 for(const change of approved.changes){
  const unit=registry.factions.find(f=>f.id===change.factionId)?.units.find(u=>u.id===change.unitId),p=unit?.profiles[change.rank-1];if(!p)throw Error('FR-003 identity missing: '+change.key);
  for(const delta of change.stats){const parts=delta.field.split('.'),key=parts.pop();let object=p;for(const part of parts)object=object[part];
   if(change.factionId==='crown'){if(change.key!=='crown/roseguard/1'||delta.field!=='damage')throw Error('Unapproved Human change');p.fr003HumanChanges=change.stats;}
   else if(object[key]!==delta.before)throw Error('FR-003 stat baseline drift: '+change.key+'/'+delta.field);
   object[key]=delta.after;
  }
  for(const delta of change.abilities){const i=p.abilities.findIndex(a=>a.familyId===delta.oldFamilyId);if(i<0||canonical(p.abilities[i])!==canonical(delta.before))throw Error('FR-003 ability baseline drift: '+change.key+'/'+delta.oldFamilyId);p.abilities[i]=structuredClone(delta.after);}
  Object.assign(p,structuredClone(change.derived));
 }
 return registry;
}
export function fr003HumanStats(original,profile){
 if(!profile.fr003HumanChanges)return original;
 const result={...original};for(const delta of profile.fr003HumanChanges){if(result[delta.field]!==delta.before)throw Error('FR-003 actual Human baseline drift');result[delta.field]=delta.after;}
 if(profile.expectedMetrics)result.expectedMetrics=structuredClone(profile.expectedMetrics);
 if(profile.cycleMetrics)result.cycleMetrics=structuredClone(profile.cycleMetrics);
 return result;
}

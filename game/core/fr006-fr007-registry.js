import approved from '../../data/fr006-fr007-approved.json' with {type:'json'};
import rankI from '../../data/fr007-r3-approved.json' with {type:'json'};
export const FR006_FR007_RULESET_REVISION=rankI.rulesetRevision;
const unitAt=(registry,c)=>registry.factions.find(f=>f.id===c.factionId)?.units.find(u=>u.id===c.unitId);
// The handoff is retained verbatim as historical evidence. This authorized
// runtime delta changes recipes only; all combat profiles and asset mappings survive.
export function applyFr006Fr007Registry(baseline,{recipeRevision=3}={}){
  if(![2,3].includes(recipeRevision))throw Error('Unsupported FR-007 recipe revision');
  if(baseline.revision!==approved.baselineRulesetRevision||!baseline.fr005||baseline.fr007)throw Error('FR-006/007 requires the exact FR-005 revision 2 baseline exactly once');
  for(const c of approved.recipeChanges)if(JSON.stringify(unitAt(baseline,c)?.recipe)!==JSON.stringify(c.before))throw Error('FR-007 recipe baseline drift: '+c.unitId);
  const registry=structuredClone(baseline);registry.revision=approved.rulesetRevision;registry.fr006=true;registry.fr007=true;
  for(const c of approved.recipeChanges)unitAt(registry,c).recipe=structuredClone(c.after);
  if(recipeRevision===3){
    if(registry.revision!==rankI.baselineRulesetRevision)throw Error('FR-007 revision 3 baseline mismatch');
    for(const c of rankI.recipeChanges)if(JSON.stringify(unitAt(registry,c)?.recipe)!==JSON.stringify(c.before))throw Error('FR-007 revision 3 recipe baseline drift: '+c.unitId);
    for(const c of rankI.recipeChanges)unitAt(registry,c).recipe=structuredClone(c.after);
    registry.revision=FR006_FR007_RULESET_REVISION;
  }
  return registry;
}

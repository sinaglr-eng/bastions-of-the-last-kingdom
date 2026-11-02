import approved from '../../data/fr005-approved.json' with {type:'json'};
export const FR005_RULESET_REVISION=approved.rulesetRevision;
const canonical=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value);
const unitAt=(registry,c)=>registry.factions.find(f=>f.id===c.factionId)?.units.find(u=>u.id===c.unitId);
// Apply the reviewed delta to FR-004, before deriving effective faction fields.
// Whole-array guards detect stale assignments as well as duplicate application.
export function applyFr005Registry(baseline){
 if(baseline.revision!==approved.baselineRulesetRevision||!baseline.fr004||baseline.fr005)throw Error('FR-005 revision 2 requires the exact FR-004 baseline exactly once');
 for(const c of approved.recipeChanges)if(canonical(unitAt(baseline,c)?.recipe)!==canonical(c.before))throw Error('FR-005 recipe baseline drift: '+c.unitId);
 for(const c of approved.abilityProfileChanges)if(canonical(unitAt(baseline,c)?.profiles[c.rank-1]?.abilities)!==canonical(c.before))throw Error('FR-005 ability baseline drift: '+c.key);
 const registry=structuredClone(baseline);registry.revision=FR005_RULESET_REVISION;registry.fr005=true;
 for(const c of approved.recipeChanges)unitAt(registry,c).recipe=structuredClone(c.after);
 for(const c of approved.abilityProfileChanges)unitAt(registry,c).profiles[c.rank-1].abilities=structuredClone(c.after);
 for(const c of approved.unitMetadataChanges)unitAt(registry,c)[c.field]=structuredClone(c.after);
 return registry;
}
// Humans retain their established attack engine. Only Golem's approved
// control replacement needs new effective fields; no primary stat is rebuilt.
export function fr005HumanStats(original,profile){
 if(!profile.abilities.some(a=>a.familyId==='stun')||!original.stoneGazeChance)return original;
 const s={...original,abilities:structuredClone(profile.abilities),description:profile.abilities.map(a=>a.text).join(' '),fr005CanonicalControl:true};
 for(const key of ['stoneGazeChance','stoneGazeRange','stoneGazeDuration','stoneGazeSlow','stoneGazeFacingTime','petrifyDuration','petrifyPhysicalBonus','petrifyIgnoresImmunity'])delete s[key];
 s.role='Physical defender. Abilities: Armor Reduction, Freeze, Stun.';
 s.strong='Armor Reduction; Freeze; Stun';s.adaptationNote='Freeze and Stun use their canonical control immunity, boss duration and recovery rules.';
 return s;
}

// Apply only the human-approved deltas. Approval files are immutable evidence;
// gallery source, original models and unrelated current registry fields stay intact.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const folder='output/releases/v0.6.2/fr001/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const registry=read('data/factions-v060.json'),before=structuredClone(registry);
const numericApproval=read(folder+'authority/output/design/faction-balance-fr001-20261030/approval.json');
const recipeApproval=read(folder+'authority/output/design/faction-recipes-approved-20261030/approval.json');
const changedAbilities=new Map(),numeric=[],recipes=[];
for(const [original,hash] of Object.entries(numericApproval.approvedPatchManifest.hashes)){
 const file=folder+'inputs/'+original.split('/').at(-1),bytes=fs.readFileSync(file);
 assert.equal(sha(bytes),hash,'Frozen approved numeric bytes');
 const patch=read(file),f=registry.factions.find(f=>f.id===patch.factionId);
 assert.ok(['forge','grove'].includes(f.id));
 for(const c of patch.changes){
  const u=f.units.find(u=>u.id===c.unitId);assert.notEqual(u.id,'ladyclaire');
  const p=u.profiles[c.rank-1];let owner=p;
  for(const k of c.path.slice(0,-1)){assert.ok(Object.hasOwn(owner,k));owner=owner[k];}
  const k=c.path.at(-1);assert.equal(owner[k],c.before,JSON.stringify(c));assert.ok(Number.isFinite(c.after)&&c.after>=0);owner[k]=c.after;
  numeric.push({factionId:f.id,...c});
  if(c.path[0]==='abilities')changedAbilities.set(`${f.id}/${u.id}/${c.rank}/${c.path[1]}`,{factionId:f.id,ability:p.abilities[c.path[1]]});
 }
}
assert.equal(numeric.length,492);
for(const approved of recipeApproval.approvedRecipeInputs){
 const file=folder+'inputs/'+approved.factionId+'-recipes.json';assert.equal(sha(fs.readFileSync(file)),approved.sha256);
 const frozen=read(file),rows=Array.isArray(frozen)?frozen:frozen.recipes;
 const f=registry.factions.find(f=>f.id===approved.factionId);
 for(const change of approved.changes){
  const u=f.units.find(u=>u.id===change.id),old=u.recipe.map(i=>({family:i.id,tier:i.rank}));
  assert.deepEqual(old,change.before.ingredients,'Current recipe matches approved starting inputs');
  const neo=rows.find(r=>r.id===u.id);assert.deepEqual(neo.ingredients,change.after.ingredients);
  u.recipe=neo.ingredients.map(i=>({id:i.family,rank:i.tier}));recipes.push({factionId:f.id,id:u.id,before:old,after:neo.ingredients});
 }
}
assert.equal(recipes.length,18);
const text={
 lightning:a=>`Direct attacks have a ${a.chancePercent}% chance to chain lightning to ${a.targets} different enemies for ${a.damage} Magical damage each (Holy on Holy defenders). Jumps reach ${a.linkRange} tiles. A target is hit once per chain.`,
 'cleave-magical':a=>`Direct attacks deal ${a.damagePercent}% base damage as Magical damage to all other eligible enemies within ${a.radius} tiles of the target. Secondary damage cannot trigger more abilities. With Multishot, only the first selected target creates Splash or Cleave. Area damage skips every directly hit target, and each other enemy takes area damage at most once from that attack.`,
 burn:a=>`Fire contact burns the enemy for ${a.dps} Magical damage/s for ${a.duration} s. Reapplication refreshes the duration; only the strongest Burn deals damage.`,
 spark:a=>`Every ${a.cooldown} s, strike one enemy in attack range for ${a.damage} Magical lightning damage.`,
 'armor-reduction':a=>`Hits reduce armor by ${a.armorReduction} for ${a.duration} s. The strongest reduction applies; armor cannot fall below 0.`,
 'flame-cone':a=>`Continuously deal ${a.dps} damage/s to every ground enemy in a ${a.coneDegrees}° cone reaching ${a.range} tiles. There is no enemy-count limit. The damage type is the defender's listed damage type.`,
 'fire-aura':a=>`All eligible enemies within ${a.radius} tiles take ${a.dps} Magical fire damage/s. There is no enemy-count limit. Overlapping Fire Auras use the strongest damage.`,
 'attack-speed-aura':a=>`Allies within ${a.radius} tiles gain +${a.bonusPercent}% attack speed. Only the strongest aura applies. Reload, cooldowns and continuous damage/s are unchanged.`,
 'sky-hunt':a=>`Direct Physical attacks deal +${a.bonusPercent}% damage against flying enemies. Ground targets receive no bonus.`
};
for(const {factionId,ability:a} of changedAbilities.values()){
 assert.ok(text[a.familyId],'Supported approved description');a.text=text[a.familyId](a);
 const {name,text:copy,levelId,level,levelLabel,...parameters}=a;
 a.levelId=`${a.familyId}-${factionId}-fr001-${sha(Buffer.from(JSON.stringify(parameters))).slice(0,12)}`;
 a.levelLabel=`${a.name} · ${factionId==='grove'?'Elf':'Dwarf'} FR-001`;
}
assert.deepEqual(registry.factions[0],before.factions[0]);
for(const id of ['forge','grove']){
 const f=registry.factions.find(f=>f.id===id),b=before.factions.find(f=>f.id===id);
 assert.deepEqual(f.units.find(u=>u.id==='ladyclaire'),b.units.find(u=>u.id==='ladyclaire'));
 assert.deepEqual(f.assets,b.assets,'Model, portrait and animation identities unchanged');
}
fs.writeFileSync('data/factions-v060.json',JSON.stringify(registry,null,2)+'\n');
fs.writeFileSync(folder+'implementation.json',JSON.stringify({requirementId:'FR-001',version:'0.6.2',numericDeltas:numeric.length,recipeDeltas:recipes.length,regeneratedAbilityDescriptions:changedAbilities.size,baselineSha256:sha(Buffer.from(JSON.stringify(before))),registrySha256:sha(fs.readFileSync('data/factions-v060.json')),numeric,recipes,fullCampaignParityCertified:false},null,2)+'\n');
console.log(JSON.stringify({numeric:numeric.length,recipes:recipes.length,abilityDescriptions:changedAbilities.size}));

import catalog from '../../data/commander-artifacts.json' with {type:'json'};
export const ARTIFACT_CATALOG=catalog;
export const ARTIFACT_VERSION=catalog.effectVersion;
export const ARTIFACTS=Object.freeze(Object.setPrototypeOf(Object.fromEntries(catalog.artifacts.map(a=>[a.id,Object.freeze(a)])),null));
export const ARTIFACT_SETS=Object.freeze(Object.setPrototypeOf(Object.fromEntries(catalog.sets.map(s=>[s.id,Object.freeze(s)])),null));
export const ARTIFACT_SLOTS=Object.freeze(catalog.slots);
export const RARITIES=Object.freeze(Object.fromEntries(catalog.rarities.map(r=>[r.id,r])));
export const CHESTS=Object.freeze(Object.fromEntries(catalog.chests.map(c=>[c.tier,c])));
export const ARTIFACT_CAPS=Object.freeze({damage:.45,bossDamage:.25,conditional:.20,speed:.35,range:.15,poisonPower:1.5,burnPower:1.5,slow:.25,freezeChance:.15,freezeDuration:1,gold:500,cp:8,keepHealth:12,controlResistance:.5});
export const artifactRng=seed=>{let state=seed>>>0;return()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};};
export function validateArtifactEquipment(equipment={},owned=null){
 if(!equipment||typeof equipment!=='object'||Array.isArray(equipment))throw Error('Invalid artifact equipment.');
 const result={},seen=new Set(),ownership=owned?new Set(owned):null;
 for(const [slot,id]of Object.entries(equipment)){
  if(!ARTIFACT_SLOTS.includes(slot)||typeof id!=='string'||!ARTIFACTS[id]||ARTIFACTS[id].slot!==(slot.startsWith('ring')?'ring':slot))throw Error('Artifact does not fit this slot.');
  if(seen.has(id))throw Error('An artifact can only be equipped once.');if(ownership&&!ownership.has(id))throw Error('You do not own this artifact.');seen.add(id);result[slot]=id;
 }
 return Object.fromEntries(ARTIFACT_SLOTS.filter(s=>result[s]).map(s=>[s,result[s]]));
}
export function equipArtifactSet(equipment,setId,owned=null){
 if(!ARTIFACT_SETS[setId])throw Error('Unknown artifact set.');
 const next={...validateArtifactEquipment(equipment)},pieces=catalog.artifacts.filter(a=>a.setId===setId);
 for(const item of pieces){let slot=item.slot;if(slot==='ring')slot=next.ring1===item.id?'ring1':next.ring2===item.id?'ring2':!next.ring1?'ring1':!next.ring2?'ring2':'ring1';for(const [old,id]of Object.entries(next))if(id===item.id)delete next[old];next[slot]=item.id;}
 return validateArtifactEquipment(next,owned);
}
const maxima=new Set(['poisonBase','burnBase','slow','freezeChance','freezeDuration','shred','healingReduction']);
const add=(target,values)=>{for(const[k,v]of Object.entries(values))target[k]=maxima.has(k)?Math.max(target[k]||0,v):(target[k]||0)+v;};
export function artifactBonuses(equipment={}){
 const normalized=validateArtifactEquipment(equipment),effects={},sets={};
 for(const id of Object.values(normalized)){const a=ARTIFACTS[id];add(effects,a.modifiers);if(a.setId)sets[a.setId]=(sets[a.setId]||0)+1;}
 for(const [id,count]of Object.entries(sets))for(const[n,bonus]of Object.entries(ARTIFACT_SETS[id].bonuses))if(count>=Number(n))add(effects,bonus);
 effects.slow=(effects.slow||0)+(effects.slow?effects.slowBonus||0:0);effects.freezeChance=(effects.freezeChance||0)+(effects.freezeChance?effects.freezeChanceBonus||0:0);effects.freezeDuration=(effects.freezeDuration||0)+(effects.freezeDuration?effects.freezeDurationBonus||0:0);effects.healingReduction=(effects.healingReduction||0)+(effects.healingReduction?effects.healingReductionBonus||0:0);
 for(const[k,cap]of Object.entries(ARTIFACT_CAPS))if(k!=='conditional')effects[k]=Math.min(cap,Math.max(0,Number((effects[k]||0).toFixed(9))));
 effects.poisonFraction=(effects.poisonBase||0)*(1+(effects.poisonPower||0));effects.burnFraction=(effects.burnBase||0)*(1+(effects.burnPower||0));
 return {equipment:normalized,effects,sets};
}
const percent=n=>`${Number((n*100).toFixed(2)).toLocaleString('en-US')}%`;
export function artifactModifierText(m={}){
 const aggregate=Object.hasOwn(m,'poisonFraction');
 const labels={damage:'own damage',bossDamage:'damage vs bosses',conditionalPoison:'damage vs poisoned enemies',conditionalBurn:'damage vs burning enemies',conditionalControl:'damage vs slowed/frozen enemies',speed:'attack speed',range:'attack range',controlResistance:'disruption resistance',poisonPower:'artifact poison damage',burnPower:'artifact burn damage'};
 const rows=[];for(const[k,label]of Object.entries(labels))if(m[k]&&!(aggregate&&['poisonPower','burnPower'].includes(k)))rows.push(`+${percent(m[k])} ${label}`);
 for(const[k,label]of [['gold','starting gold'],['cp','starting CP'],['keepHealth','starting/max keep health']])if(m[k])rows.push(`+${m[k].toLocaleString('en-US')} ${label}`);
 if(m.poisonBase)rows.push(`Poison: ${percent(aggregate?m.poisonFraction:m.poisonBase)} of primary hit damage over 3s`);if(m.burnBase)rows.push(`Burn: ${percent(aggregate?m.burnFraction:m.burnBase)} of primary hit damage over 2s`);
 if(m.slow)rows.push(`${percent(m.slow)} slow for 2s`);if(m.slowBonus&&!aggregate)rows.push(`+${percent(m.slowBonus)} points artifact slow`);
 if(m.freezeChance)rows.push(`${percent(m.freezeChance)} freeze chance for ${m.freezeDuration||.6}s (half on bosses; 6s target cooldown)`);
 if(m.freezeChanceBonus&&!aggregate)rows.push(`+${percent(m.freezeChanceBonus)} points freeze chance, +${m.freezeDurationBonus}s duration`);
 if(m.healingReduction)rows.push(`${percent(m.healingReduction)} less enemy healing while artifact-poisoned`);if(m.healingReductionBonus&&!aggregate)rows.push(`+${percent(m.healingReductionBonus)} points healing reduction`);
 if(m.shred)rows.push(`-${m.shred} armor for 2s; strongest reduction only`);if(m.emberTransfer)rows.push('Ember Transfer: share unspent artifact burn among up to 3 nearby valid enemies');if(m.reinforceKeep)rows.push(`First boss restores up to ${m.reinforceKeep} keep health, once per run`);
 return rows;
}
export function chestTier(bossId,wave){const base=catalog.chests.find(c=>c.bossId===bossId)?.tier;if(!base)return null;return wave>=100?5:wave>50?Math.max(4,base):base;}
export function craftUnlockTier(rarity){return {common:1,uncommon:1,rare:1,epic:2,legendary:3}[rarity];}
const rank=id=>catalog.rarities.findIndex(r=>r.id===id);
export function rollArtifactChest(account,tier,seed){
 const chest=CHESTS[tier];if(!chest)throw Error('Unknown chest tier.');
 const owned=new Set(account.owned||[]),pity={...(account.pity||{})},rng=artifactRng(seed),items=[],excluded=new Set();let dustGained=chest.baseDust;
 const forced=(pity[tier]||0)>=chest.pityEvery-1;
 for(let i=0;i<chest.draws;i++){
  let roll=rng()*100,rarity=Object.keys(chest.weights).at(-1);for(const[k,w]of Object.entries(chest.weights)){roll-=w;if(roll<0){rarity=k;break;}}
  if(forced&&i===0&&rank(rarity)<rank(chest.pityRarity))rarity=chest.pityRarity;
  const candidates=catalog.artifacts.filter(a=>a.rarity===rarity&&!excluded.has(a.id)),fresh=candidates.filter(a=>!owned.has(a.id)),duplicates=candidates.filter(a=>owned.has(a.id));
  const pool=fresh.length&&duplicates.length?(rng()<.75?fresh:duplicates):fresh.length?fresh:duplicates;
  const a=pool[Math.floor(rng()*pool.length)];if(!a)throw Error('Empty artifact pool.');excluded.add(a.id);
  const duplicate=owned.has(a.id),dust=duplicate?RARITIES[a.rarity].dust:0;owned.add(a.id);dustGained+=dust;items.push({id:a.id,duplicate,dust});
 }
 pity[tier]=items.some(row=>rank(ARTIFACTS[row.id].rarity)>=rank(chest.pityRarity))?0:(pity[tier]||0)+1;
 return {owned:[...owned].sort(),pity,dust:(account.dust||0)+dustGained,dustGained,baseDust:chest.baseDust,items};
}

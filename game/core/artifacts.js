import catalog from '../../data/commander-artifacts.json' with {type:'json'};
export const ARTIFACT_CATALOG=catalog;
export const ARTIFACT_VERSION=catalog.effectVersion;
export const ARTIFACTS=Object.freeze(Object.setPrototypeOf(Object.fromEntries(catalog.artifacts.map(a=>[a.id,Object.freeze(a)])),null));
export const ARTIFACT_SETS=Object.freeze(Object.setPrototypeOf(Object.fromEntries(catalog.sets.map(s=>[s.id,Object.freeze(s)])),null));
export const ARTIFACT_SLOTS=Object.freeze(catalog.slots);
export const RARITIES=Object.freeze(Object.fromEntries(catalog.rarities.map(r=>[r.id,r])));
export const CHESTS=Object.freeze(Object.fromEntries(catalog.chests.map(c=>[c.tier,c])));
export const ARTIFACT_GEMS=Object.freeze({aquamarine:'Aquamarine',emerald:'Emerald'});
export const artifactCraftGem=item=>ARTIFACT_SETS[item.setId]?.craftGem||null;
export const bossChestHasGem=(bossId,wave)=>!!bossId&&(wave>50||wave===50&&bossId==='host_50');
export const ARTIFACT_CAPS=Object.freeze({damage:.50,bossDamage:.25,conditional:.20,speed:.35,rangeTiles:3,poisonPower:1.5,burnPower:1.5,slow:.25,freezeChance:.15,freezeDuration:1,gold:1000,cp:8,keepHealth:12,controlResistance:.5,shred:20,immunityReduction:.30,waveHeal:1});
export const usesArtifactRulesV3=value=>['fr011-v3','fr011-v4'].includes(typeof value==='string'?value:value?.artifactVersion);
export const usesArtifactRulesV4=value=>(typeof value==='string'?value:value?.artifactVersion)==='fr011-v4';
const v3Caps={...ARTIFACT_CAPS,damage:.45,shred:8};delete v3Caps.waveHeal;Object.freeze(v3Caps);
const v2Caps=Object.freeze({...v3Caps,rangeTiles:8});
const legacyCaps={...v3Caps,range:.15,gold:500};delete legacyCaps.rangeTiles;delete legacyCaps.shred;delete legacyCaps.immunityReduction;
export const setPieces=id=>catalog.artifacts.filter(a=>a.setId===id);
export const setThresholds=id=>Object.keys(ARTIFACT_SETS[id]?.bonuses||{}).map(Number).sort((a,b)=>a-b);
export const completeArtifactSet=equipment=>catalog.sets.find(s=>setPieces(s.id).every(a=>Object.values(equipment).includes(a.id)))||null;
export function normalizeArtifactPity(pity={}){if(pity._rules===catalog.pityRulesVersion)return {...pity};return {...pity,2:0,3:0,_rules:catalog.pityRulesVersion};}
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
export function equipArtifactSet(equipment,setId,owned=null,{ownedOnly=false}={}){
 if(!ARTIFACT_SETS[setId])throw Error('Unknown artifact set.');
 const next={...validateArtifactEquipment(equipment)},pieces=setPieces(setId).filter(a=>!ownedOnly||owned?.includes(a.id)),ringIds=new Set(pieces.filter(a=>a.slot==='ring').map(a=>a.id));
 if(ownedOnly&&!pieces.length)throw Error('You do not own any pieces of this set.');
 for(const item of pieces){let slot=item.slot;if(slot==='ring')slot=next.ring1===item.id?'ring1':next.ring2===item.id?'ring2':!next.ring1?'ring1':!next.ring2?'ring2':!ringIds.has(next.ring1)?'ring1':'ring2';for(const [old,id]of Object.entries(next))if(id===item.id)delete next[old];next[slot]=item.id;}
 return validateArtifactEquipment(next,owned);
}
const maxima=new Set(['poisonBase','burnBase','slow','freezeChance','freezeDuration','shred','healingReduction']);
const add=(target,values)=>{for(const[k,v]of Object.entries(values))target[k]=maxima.has(k)?Math.max(target[k]||0,v):(target[k]||0)+v;};
export const artifactRangeDelta=(positive,penalties=0)=>Math.max(-2,Number((Math.min(ARTIFACT_CAPS.rangeTiles,positive)+penalties).toFixed(9)));
export function artifactBonuses(equipment={},version=ARTIFACT_VERSION){
 const legacy=version===catalog.legacyEffects.version,current=version===ARTIFACT_VERSION,modern=usesArtifactRulesV3(version),compat=legacy?catalog.legacyEffects:catalog.compatibilityEffects?.[version];if(!current&&!compat)throw Error('Unsupported artifact effects version.');
 const normalized=validateArtifactEquipment(equipment),effects={},sets={},itemEffects={},setEffects={},penalties={},positiveItems={},thresholds=[];
 let itemRange=0,setRange=0,rangePenalty=0;
 const collect=(values,kind)=>{add(effects,values);add(kind==='item'?itemEffects:setEffects,values);for(const[k,v]of Object.entries(values)){if(v<0)penalties[k]=(penalties[k]||0)+v;else if(kind==='item')add(positiveItems,{[k]:v});if(k==='rangeTiles'){if(v<0)rangePenalty+=v;else if(kind==='item')itemRange+=v;else setRange+=v;}}};
 for(const id of Object.values(normalized)){const a=ARTIFACTS[id],modifiers=current?a.modifiers:compat.itemModifiers[id];if(!modifiers)throw Error('Artifact was not available in this defense ruleset.');collect(modifiers,'item');if(a.setId)sets[a.setId]=(sets[a.setId]||0)+1;}
 for(const [id,count]of Object.entries(sets))for(const[n,bonus]of Object.entries(current?ARTIFACT_SETS[id].bonuses:compat.setBonuses[id]||{}))if(count>=Number(n)){collect(bonus,'set');thresholds.push({setId:id,pieces:Number(n),modifiers:{...bonus}});}
 effects.slow=(effects.slow||0)+(modern||effects.slow||sets.necromancer?effects.slowBonus||0:0);effects.shred=(effects.shred||0)+(effects.shredBonus||0);effects.freezeChance=(effects.freezeChance||0)+(effects.freezeChance?effects.freezeChanceBonus||0:0);effects.freezeDuration=(effects.freezeDuration||0)+(effects.freezeDuration?effects.freezeDurationBonus||0:0);effects.healingReduction=(effects.healingReduction||0)+(effects.healingReduction?effects.healingReductionBonus||0:0);
 const rawEffects={...effects},caps=legacy?legacyCaps:current?ARTIFACT_CAPS:modern?v3Caps:v2Caps,capped={};
 for(const[k,cap]of Object.entries(caps))if(k!=='conditional'){
  const raw=Number((effects[k]||0).toFixed(9)),floor=!legacy&&['damage','speed','rangeTiles'].includes(k)?{damage:-.3,speed:-.3,rangeTiles:-2}[k]:0;
  effects[k]=modern&&k==='rangeTiles'?artifactRangeDelta(itemRange+setRange,rangePenalty):Math.min(cap,Math.max(floor,raw));
  if(Math.abs(raw-effects[k])>1e-9)capped[k]={raw,cap,final:effects[k]};
 }
 effects.poisonFraction=(effects.poisonBase||0)*(1+(effects.poisonPower||0));effects.burnFraction=(effects.burnBase||0)*(1+(effects.burnPower||0));
 const diagnostics=[];
 if(effects.poisonPower&&!effects.poisonBase)diagnostics.push({key:'poisonPower',state:'inactive',message:'Artifact poison power is inactive: equip an artifact poison source. Native defender poison is unchanged.'});
 if(effects.burnPower&&!effects.burnBase)diagnostics.push({key:'burnPower',state:'inactive',message:'Artifact burn power is inactive: equip an artifact burn source. Native Burn and Fire Aura are unchanged.'});
 if(effects.healingReduction)diagnostics.push({key:'healingReduction',state:'conditional',message:modern?'Healing reduction requires active native or artifact poison on the target and respects status immunity. A stronger native reduction takes precedence.':'Healing reduction requires active artifact poison on the target and respects status immunity.'});
 if(effects.slow||effects.shred||effects.immunityReduction)diagnostics.push({key:'strongest',state:'conditional',message:'Slow, armor reduction and immunity breach use the strongest active native or artifact effect. Weaker effects do not add to the stronger effect.'});
 if(effects.conditionalControl)diagnostics.push({key:'conditionalControl',state:'conditional',message:modern?'Requires actual Slow or Freeze from any permitted defender or Commander source. Root, Stun and Petrify alone do not qualify.':'Requires a Slow or Freeze status; movement-only aura and Commander slow do not qualify.'});
 const setSizes=Object.fromEntries(Object.keys(sets).map(id=>[id,setPieces(id).filter(a=>current||Object.hasOwn(compat.itemModifiers,a.id)).length]));
 return {equipment:normalized,effects,sets,setSizes,version,breakdown:{items:itemEffects,positiveItems,sets:setEffects,penalties,thresholds,rawEffects,capped,range:{items:itemRange,sets:setRange,positive:itemRange+setRange,cap:caps.rangeTiles??null,cappedPositive:modern?Math.min(caps.rangeTiles,itemRange+setRange):null,penalties:rangePenalty,final:effects.rangeTiles||0,discarded:modern?Math.max(0,itemRange+setRange-caps.rangeTiles):0}},diagnostics};
}
const percent=n=>`${Number((n*100).toFixed(2)).toLocaleString('en-US')}%`;
export function artifactModifierText(m={},options={}){
 const modern=usesArtifactRulesV3(options.version||ARTIFACT_VERSION);
 const aggregate=Object.hasOwn(m,'poisonFraction');
 const labels={damage:'own damage',bossDamage:'damage vs bosses',conditionalPoison:'damage vs poisoned enemies',conditionalBurn:'damage vs burning enemies',conditionalControl:'damage vs slowed/frozen enemies',speed:'attack speed',range:'attack range',controlResistance:'Disarm and Dread resistance',poisonPower:'artifact poison damage',burnPower:'artifact burn damage'};
 const rows=[];for(const[k,label]of Object.entries(labels))if(m[k])rows.push(`${m[k]>0?'+':'−'}${percent(Math.abs(m[k]))} ${label}`);
 if(m.rangeTiles)rows.push(`${m.rangeTiles>0?'+':'−'}${Math.abs(m.rangeTiles).toLocaleString('en-US')} attack range ${Math.abs(m.rangeTiles)===1?'tile':'tiles'}`);
 for(const[k,label]of [['gold','starting gold'],['cp','starting CP'],['keepHealth','starting/max keep health']])if(m[k])rows.push(`+${m[k].toLocaleString('en-US')} ${label}`);
 if(m.poisonBase)rows.push(`Artifact poison: after a primary hit removes 100 HP, add ${Number(((aggregate?m.poisonFraction:m.poisonBase)*100).toFixed(2))} total Magical poison damage over 3s, before the target’s Magical defenses. Based on HP removed by that hit, never the enemy’s maximum HP${aggregate?' (includes the artifact poison damage bonus above)':''}`);if(m.burnBase)rows.push(`Artifact burn: after a primary hit removes 100 HP, add ${Number(((aggregate?m.burnFraction:m.burnBase)*100).toFixed(2))} total Magical burn damage over 2s, before the target’s Magical defenses. Based on HP removed by that hit${aggregate?' (includes the artifact burn damage bonus above)':''}`);
 if(m.slow)rows.push(`${percent(m.slow)} slow for 2s`);if(m.slowBonus&&!aggregate)rows.push(`+${percent(m.slowBonus)} points artifact slow`);
 if(m.freezeChance)rows.push(`${percent(m.freezeChance)} freeze chance for ${m.freezeDuration||.6}s (half on bosses; 6s target cooldown)`);
 if(m.freezeChanceBonus&&!aggregate)rows.push(`+${percent(m.freezeChanceBonus)} points freeze chance, +${m.freezeDurationBonus}s duration`);
 if(m.healingReduction)rows.push(`${percent(m.healingReduction)} less enemy healing while ${modern?'native- or artifact-poisoned':'artifact-poisoned'}`);if(m.healingReductionBonus&&!aggregate)rows.push(`+${percent(m.healingReductionBonus)} points healing reduction`);
 if(m.shred)rows.push(`-${m.shred} armor for 2s; strongest reduction only`);if(m.shredBonus&&!aggregate)rows.push(`-${m.shredBonus} additional armor on primary hits`);if(m.immunityReduction)rows.push(`${percent(m.immunityReduction)} Physical/Magical damage passes through immunity; strongest breach applies; status immunities unchanged`);if(m.emberTransfer)rows.push('Ember Transfer: share unspent artifact burn among up to 3 valid enemies within 1.5 tiles; cannot chain');if(m.reinforceKeep)rows.push(modern?`A boss kill restores up to ${m.reinforceKeep} keep health once per run; full health preserves the charge`:`First boss restores up to ${m.reinforceKeep} keep health, once per run`);
 if(m.waveHeal)rows.push(`After each successfully completed wave, restore up to ${m.waveHeal} missing keep health. Cannot exceed maximum health or revive a defeated keep`);
 return rows;
}
export function chestTier(bossId,wave){const base=catalog.chests.find(c=>c.bossId===bossId)?.tier;if(!base)return null;return wave>=100?5:wave>50?Math.max(4,base):base;}
export function craftUnlockTier(rarity){return {common:1,uncommon:1,rare:1,epic:2,legendary:3}[rarity];}
const rank=id=>catalog.rarities.findIndex(r=>r.id===id);
export function rollArtifactChest(account,tier,seed){
 const chest=CHESTS[tier];if(!chest)throw Error('Unknown chest tier.');
 const owned=new Set(account.owned||[]),pity=normalizeArtifactPity(account.pity),rng=artifactRng(seed),items=[],excluded=new Set();let dustGained=chest.baseDust;
 const forced=(pity[tier]||0)>=chest.pityEvery-1;
 const artifactDrop=forced||rng()*100<(chest.artifactChance??100);
 for(let i=0;artifactDrop&&i<chest.draws;i++){
  let roll=rng()*100,rarity=Object.keys(chest.weights).at(-1);for(const[k,w]of Object.entries(chest.weights)){roll-=w;if(roll<0){rarity=k;break;}}
  if(forced&&i===0&&rank(rarity)<rank(chest.pityRarity))rarity=chest.pityRarity;
  const candidates=catalog.artifacts.filter(a=>a.rarity===rarity&&!excluded.has(a.id)),fresh=candidates.filter(a=>!owned.has(a.id)),duplicates=candidates.filter(a=>owned.has(a.id));
  const pool=fresh.length&&duplicates.length?(rng()<.75?fresh:duplicates):fresh.length?fresh:duplicates;
  const a=pool[Math.floor(rng()*pool.length)];if(!a)throw Error('Empty artifact pool.');excluded.add(a.id);
  const duplicate=owned.has(a.id),dust=duplicate?RARITIES[a.rarity].dust:0;owned.add(a.id);dustGained+=dust;items.push({id:a.id,duplicate,dust});
 }
 if(!items.length)dustGained=chest.noArtifactDust;
 pity[tier]=items.some(row=>rank(ARTIFACTS[row.id].rarity)>=rank(chest.pityRarity))?0:(pity[tier]||0)+1;
 return {owned:[...owned].sort(),pity,dust:(account.dust||0)+dustGained,dustGained,baseDust:chest.baseDust,items};
}

// Lord Bernhard now belongs to the hostile roster (wave 50). Historical
// definitions remain available for archived editions; current play excludes
// his former friendly recipe and unit.
import {APPROVED_DEFENDER_NAMES,APPROVED_CHAMPION_DESCRIPTIONS} from './approved-defender-names.js';
import {canonicalCombatStats} from './combat-rules.js';
// Approved V7/V8 identity copy follows the reconstructed artwork and voices.
// Archived source definitions remain verbatim. Current combat adjustments are
// explicit overrides on the playable roster, separate from reference values.
export const CAMPAIGN_COMBAT_OVERRIDES=Object.freeze({
  frostwarden:Object.freeze({type:'physical'}),
  mage:Object.freeze({cleaveType:'magical'}),
  rimewatch:Object.freeze({range:5,type:'physical',slow:.2,slowDuration:3}),
  frostblade:Object.freeze({range:5.5,slow:.25,slowDuration:3,cleaveType:'physical'}),
  highking:Object.freeze({range:7.5,critChance:.15,slow:.25,slowDuration:3,cleaveType:'physical'}),
  crownofages:Object.freeze({range:9,critChance:.2,slow:.3,slowDuration:3,shred:64,cleaveType:'physical'}),
  thornwarden:Object.freeze({range:5.5,multishot:3}),
  verdantguard:Object.freeze({range:6,multishot:5}),
  royalarsenal:Object.freeze({range:8,type:'magical'}),
  starfall:Object.freeze({range:6,damage:300,chainDamage:165}),
  thunderheart:Object.freeze({range:6.5,burnAuraRange:5.5,forkedDamage:3000}),
  winterhold:Object.freeze({range:5,type:'holy',groundOnly:true,slowAuraGroundOnly:true,slowAuraRange:4.5}),
  archangel:Object.freeze({range:4.5,type:'holy',slowAuraRange:4,bouncingFrostDamage:250}),
  dawnspire:Object.freeze({range:7,slowAuraRange:5,aura:Object.freeze({range:5,haste:.8,stackKey:'standard'})}),
  wyvernhunter:Object.freeze({range:5,antiAirShred:20,antiAirSlow:.4,slowDuration:3}),
  royalranger:Object.freeze({range:7,type:'physical',slowAura:.25,slowAuraRange:3.5,antiAirShred:30,antiAirSlow:.4,slowDuration:3}),
  kingsrangerguard:Object.freeze({range:6.5,slowAura:.3,slowAuraRange:3.5,antiAirShred:35,antiAirSlow:.5,slowDuration:3}),
  fireballista:Object.freeze({range:7,burnDps:120,dotDuration:3}),
  emeraldgolem:Object.freeze({range:5.5,stoneGazeRange:7,petrifyIgnoresImmunity:true}),
  griffinbomber:Object.freeze({range:6.5,armorShredAura:35,effectRange:4.5}),
  kingdomprotector:Object.freeze({range:4.5,type:'holy'}),
  monk:Object.freeze({range:4.5,aura:Object.freeze({range:5,haste:1,stackKey:'standard',damageBonus:.5,controlResistance:1})}),
  archbishop:Object.freeze({range:4.5,aura:Object.freeze({range:5,haste:5,stackKey:'otomad',damageBonus:1,controlResistance:1})}),
  ladyclaire:Object.freeze({range:8,type:'holy',chainRange:6,chainDamage:250,melancholyChance:0,melancholyDuration:0}),
  rangermentor:Object.freeze({range:7,poisonDps:96,aura:Object.freeze({range:5,rangeBonus:3,trueStrike:true})}),
  mothernature:Object.freeze({range:9,poisonDps:1898.4,aura:Object.freeze({range:5,rangeBonus:3,trueStrike:true})}),
  roseguard:Object.freeze({range:5}),
  tempest:Object.freeze({range:5.5}),
  stormcitadel:Object.freeze({range:6.5}),
  embercrown:Object.freeze({range:4.5,burnAuraRange:4.5}),
  worldfire:Object.freeze({range:5,burnAuraRange:5}),
  phoenix:Object.freeze({range:8,burnAuraRange:6.5}),
  greenheart:Object.freeze({range:6}),
  eldergrove:Object.freeze({range:6,aura:Object.freeze({range:5,rangeBonus:1})}),
  kingsreach:Object.freeze({range:6}),
  sunward:Object.freeze({range:4.5}),
  royalmarshal:Object.freeze({range:5.5,armorShredAura:20,effectRange:4}),
  stonewarden:Object.freeze({range:7}),
  elvenking:Object.freeze({range:7.5,slowAura:.4,slowAuraRange:4}),
  mechanicalgolem:Object.freeze({range:7,armorShredAura:45,effectRange:5.5}),
});
// Approved B05 ranks are current-play overrides; archived authoring data stays intact.
export const CAMPAIGN_BASIC_RANGES=Object.freeze({
  soldier:Object.freeze([2.5,2.5,2.5,2.5,2.5,2.5]),
  archer:Object.freeze([3.5,3.5,3.5,3.5,3.5,4.5]),
  druid:Object.freeze([4.5,4.5,4.5,4.5,4.5,4.5]),
  mage:Object.freeze([4.5,4.5,4.5,4.5,4.5,4.5]),
  cleric:Object.freeze([4.5,4.5,4.5,4.5,4.5,4.5]),
  runebreaker:Object.freeze([4.5,4.5,4.5,4.5,4.5,4.5]),
  frostwarden:Object.freeze([5,5,5,5,5,5]),
  stormcaller:Object.freeze([5,4.5,4.5,4.5,4.5,8]),
});
// Current ability copy is independent of preserved V8 authoring descriptions.
export const CAMPAIGN_ABILITY_DESCRIPTIONS=Object.freeze({
  mage:'Magical attacks with a secondary Magical cleave; each target applies its own armor and immunity.',
  cleric:'A Holy defender providing an attack-speed blessing. Only the strongest standard blessing applies.',
  stormcaller:'A gleeful storm conjurer. Mythic rank delivers three stronger bolts within eight tiles.',
  royalranger:'Physical poison ranger with a local movement-slow aura, stronger anti-air hit slow and a chance to restore keep health.',
  elvenking:'Top Physical ranger with a local movement-slow aura, stronger anti-air hit slow and a chance of fire splash.',
  frostblade:'Physical ranged champion with Physical secondary cleave and a 25% movement slow.',
  crownofages:'Top Physical ruler with 20% critical-hit chance, Physical cleave and strong armor reduction.',
  thornwarden:'Physical archer champion that attacks three distinct targets at once.',
  verdantguard:'Physical elf champion that attacks five distinct targets at once.',
  royalarsenal:'Top Magical champion with rapid three-target attacks that ignore evasion.',
  kingdomprotector:'Holy support champion protecting allies from enemy disarm and dread.',
  kingsrangerguard:'Physical ranger with a local movement-slow aura and stronger armor-reducing, slowing anti-air hits.',
  fireballista:'Physical ballista with target armor reduction and 120 Magical burning damage/s for 3s.',
  griffinbomber:'Mounted Physical bomber combining stun with a strongest-only armor-reduction aura.',
  monk:'Holy High Priest providing strongest-only +100% standard attack speed, damage support and control protection.',
  archbishop:'Holy support champion with separate +500% attack speed, +100% damage and full control protection within 5 tiles.',
  archangel:'Holy Angel whose Holy frost bounces are triggered by nearby allied Magical or Holy hits.',
  winterhold:'Holy ranged frost champion whose direct attacks and continuous movement-slow aura affect ground targets only.',
  ladyclaire:'Secret Holy champion with sequential and forked lightning; each chained target takes 250 Holy damage.',
});
export const campaignTowers = towers => Object.fromEntries(Object.entries(towers).filter(([id]) => id !== 'lordbernhard').map(([id,definition])=>{
  const name=APPROVED_DEFENDER_NAMES[id];
  const overrides=CAMPAIGN_COMBAT_OVERRIDES[id]||{};
  const current=canonicalCombatStats({...definition,projectileEffect:definition.projectileEffect||definition.type,...(name?{name,short:name}:{}),...(APPROVED_CHAMPION_DESCRIPTIONS[id]?{description:APPROVED_CHAMPION_DESCRIPTIONS[id]}:{}),...overrides});
  current.description=CAMPAIGN_ABILITY_DESCRIPTIONS[id]||(current.description||'').replace(/\b[Aa]rcane\b/g,'Magical').replace(/\bpure\b/gi,current.cleaveType==='physical'?'Physical':'Magical');
  if(definition.levels)current.levels=definition.levels.map((level,index)=>canonicalCombatStats({...level,...(CAMPAIGN_BASIC_RANGES[id]?{range:CAMPAIGN_BASIC_RANGES[id][index]}:{}),type:current.type,projectileEffect:current.projectileEffect,...(overrides.cleaveType?{cleaveType:overrides.cleaveType}:{})}));
  return [id,current];
}));
export const campaignRecipes = recipes => recipes.filter(recipe => (recipe.resultFamily || recipe.id) !== 'lordbernhard');
export const campaignWaves = waves => waves.map((wave,index)=>index===49?{...wave,name:'Lord Bernhard, the Black Sorcerer on the Wyvern Queen'}:wave);
export const campaignEnemies = enemies => {
  const name='Lord Bernhard, the Black Sorcerer on the Wyvern Queen',boss=enemies.host_50;
  const tune=(definition,wave)=>{
    const current={...definition};delete current.resists;
    if(current.regen>0)current.regen=wave===38?.25:.2;
    if(current.refraction>0)current.refraction=3;
    if(current.recharge>0)current.recharge=.5;
    if(current.evasion>0)current.evasion=.25;
    if(current.untouchable>0)current.untouchable=.75;
    if(current.blink>0)current.blink=6;
    if(current.hasteAura>1)current.hasteAura=1.5;
    if(Object.hasOwn(current,'cloakDaggers')){current.stealth=!!current.cloakDaggers;delete current.cloakDaggers;}
    if(current.krakenShell>0)current.krakenShell=(100+Math.max(0,wave-39)*10)*(wave===50&&current.krakenShell>(boss?.krakenShell||0)?1.3:1);
    if(current.traits)current.traits=current.traits.filter(trait=>!['magicResistance','magic-resistance'].includes(trait)).map(trait=>trait==='cloakDaggers'?'stealth':trait);
    if(current.threat)current.threat=current.threat.replaceAll('Dread aura','Dread on damaging hit');
    if(current.counter)current.counter=current.counter
      .replaceAll('Plated armor reduces physical damage; break armor or add magic.','Armor reduces all three damage types; use armor reduction or penetration.')
      .replaceAll('Heavy armor; use armor reduction or magic.','Heavy armor reduces all three damage types; use armor reduction or penetration.')
      .replaceAll('Ritual wards resist magic; physical and pure attacks remain effective.','')
      .replaceAll('Magic and magical status immunity; physical or pure damage wins.','Magical immunity blocks Magical damage, poison, burning and healing block; Physical or Holy damage remains available.')
      .replaceAll('Physical immunity; use magic or pure damage.','Physical immunity also blocks slowing and freezing; use Magical or Holy damage.')
      .replaceAll('Can evade direct physical hits; use magic.','Evasion affects all three direct-hit types; True Strike prevents misses.')
      .replaceAll('Nearby defenders attack more slowly.','Dealing HP damage refreshes on-hit Dread; control protection reduces the attack slowing.')
      .replaceAll('pure damage','Holy damage')
      .replaceAll('pure attacks','Holy attacks').trim();
    return current;
  };
  return Object.fromEntries(Object.entries(enemies).map(([id,definition])=>{
    const wave=Number(id.replace(/^host_/,''))||0,current=tune(definition,wave);
    if(definition.variants)current.variants=definition.variants.map(variant=>({
      ...tune(variant,wave),
      // Moon Clan shares the existing evasion chance, including forms that
      // already inherit it. Keep this playable override out of archived data.
      ...([5,15,27,28,29,41].includes(wave)&&variant.name?.endsWith(' · Moon Clan')?{evasion:.25}:{}),
      ...(id==='host_50'?{name}:{}),
    }));
    if(id==='host_50')current.name=name;
    return [id,current];
  }));
};

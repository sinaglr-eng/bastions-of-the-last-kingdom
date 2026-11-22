// Each slice includes a short decay to silence before the next sound starts.
export const CONTACT_SLICE_SECONDS = .36;
export const CONTACT_NAMES = Object.freeze([
  'pierce','arrow','cleave','anvil','pick','rock','oak','drum','powder','talon',
  'silk','rune','moon','holy','storm','seed','ember','frost','block','dodge',
  'ward','breach','critical','execute','spark','rebound','shatter','root','venom',
  'stagger','shred','wither','charge','hoof','wing','steam','valve','banshee',
]);
export const CONTACT_OFFSETS = new Map(CONTACT_NAMES.map((name,index)=>[name,index*CONTACT_SLICE_SECONDS]));
const contactsByWeapon = {
  spear:'pierce', lance:'pierce', bow:'arrow', sword:'cleave', katana:'cleave', axe:'cleave',
  'sword-and-shield':'cleave', hammer:'anvil', 'smith-hammer':'anvil', 'armored-fist':'anvil',
  pickaxe:'pick', catapult:'rock', 'branch-fists':'oak', 'paired-drum-mallets':'drum',
  bomb:'powder', 'bomb-and-airship':'powder', cannon:'powder', 'wheeled-cannon':'powder',
  'hand-held-mortar':'powder', 'hand-held-gatling':'pierce', 'arm-mounted-gatling':'pierce',
  rifle:'pierce', ballista:'pierce', 'arm-mounted-ballista':'pierce', 'griffin-beak-and-claws':'talon',
  'fangs-and-forelegs':'silk', 'humanoid-claws':'silk', 'rune-hammer':'rune', 'rune-staff-and-book':'rune',
  'crescent-blade':'moon', 'paired-crescent-blades':'moon', 'jade-sword':'moon', 'lunar-staff':'moon',
  'crescent-staff':'moon', 'crystal-wand':'rune', 'crystal-staff':'rune', crozier:'holy',
  'leaf-energy-core':'seed', 'beak-and-wings':'storm', 'storm-spear':'storm', 'storm-staff':'storm',
  'hooked-crook':'ember', 'flame-nozzle':'ember', 'paired-flame-nozzles':'ember',
  'forge-tongs-and-hearth':'ember', 'furnace-and-ground-receivers':'ember', 'mouth-and-lower-jaw':'ember',
  'held-brazier':'ember', 'staff-and-ground-braziers':'ember',
};
const contactsByElement = {holy:'holy',lightning:'storm',fire:'ember',poison:'seed',frost:'frost',physical:'rock',magical:'rune',arcane:'rune'};
export function directContact(cue,trace){
  if(!cue||!trace.directHit||trace.visible===false)return null;
  if(trace.blockReason)return ({evasion:'dodge',shield:'block',shell:'block','magic-immunity':'ward','physical-immunity':'ward'})[trace.blockReason]||null;
  if(!(trace.effectiveDamage>0))return null;
  if(trace.immunityMultiplier>0&&trace.immunityMultiplier<1)return 'breach';
  if(trace.presentationAbility==='moon-strike')return 'moon';
  if(trace.type==='holy')return 'holy';
  if(trace.presentationAbility==='lightning')return 'storm';
  if(trace.type==='magical'&&cue.weapon==='bow')return 'storm';
  if(trace.type==='physical'&&cue.weapon==='staff')return 'oak';
  return contactsByWeapon[cue.weapon]||contactsByElement[cue.element]||(trace.type==='magical'?'rune':'pierce');
}
const statusSounds={freeze:'shatter',petrify:'rock',stun:'stagger',root:'root',poison:'venom',burn:'ember',bleed:'talon',shred:'shred',slow:'frost',regenReduction:'wither',healBlock:'wither'};
export function statusAccent(statuses){
  return statuses?.length?statusSounds[Object.keys(statusSounds).find(key=>statuses.includes(key))]||null:null;
}
// The physical attack body stays recognisable across ranks. Model equipment
// and family determine the gesture, with a small pitch change for its weight.
const ornaments={
  dw_boarrider:'hoof',dw_boarlancer:'hoof',dw_goreback:'hoof',dw_boaravatar:'hoof',
  starfall:'wing',dw_griffinscout:'wing',dw_skyhook:'wing',dw_talonlord:'wing',dw_highthane:'wing',
  dw_griffinbomber:'wing',el_starfall_bowmaster:'wing',el_elven_archmage:'wing',el_storm_sovereign:'wing',
  dw_pressuresmith:'steam',el_moonwell_seer:'banshee',el_eclipse_unbinder:'banshee',
};
export const launchOrnament=(family)=>ornaments[family]||null;
export function weaponPitch(family,tier,listedDamage=0){
  let hash=0;for(let i=0;i<family.length;i++)hash=(hash*31+family.charCodeAt(i))|0;
  return 1.045+((hash>>>0)%7)*.007-Math.min(.14,Math.log2(1+Math.max(0,listedDamage))*.012)-Math.max(0,(tier||1)-1)*.006;
}

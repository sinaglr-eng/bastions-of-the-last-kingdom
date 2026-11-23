const elfDisplayNames={
 "el_moonblade": "Elf Defender",
 "el_sealweaver": "Drow Shaman",
 "el_drow_cinder": "Nigthweaver",
 "el_drow_blade": "Drow Assassin",
 "el_elven_archer": "Ranger Scout",
 "el_elven_bowmaster": "Ranger Captain",
 "el_tempest_bowmage": "Ranger Warden",
 "el_starfall_bowmaster": "Eagle Ranger",
 "el_twilight_huntress": "Drow Huntress",
 "el_elven_mage": "Thunder Adept",
 "el_storm_conductor": "Thunder Guard",
 "el_wisp_conductor": "Phoenix Rider",
 "el_veil_adept": "Wraithcaller",
 "el_sealwarden": "Moon Specter",
 "el_moonwell_seer": "Banshee",
 "el_drow_ember_novice": "Broodguard",
 "el_drow_pyromancer": "Spider Rider",
 "el_drow_ember_matron": "Spider Queen",
 "el_drow_blade_initiate": "Assassin Apprentice",
 "el_drow_duelist": "Assassin Adept",
 "el_drow_ashblade": "Assassin Expert",
 "el_drow_eclipse_duelist": "Assassin Master",
 "el_drow_gloom_initiate": "Battlemage Apprentice",
 "el_drow_eclipse_priest": "Battlemage Adept",
 "el_veilfire_hierophant": "Battlemage Expert",
 "el_drow_night_hierarch": "Battlemage Master"
};

export const FR008_RULESET_REVISION='fr008-r1-20261106';
export function applyFr008Registry(baseline){
 if(baseline.revision!=='fr006-fr007-r3-20261106'||!baseline.fr007||baseline.fr008)throw Error('FR-008 requires FR-007 revision 3 exactly once');
 const registry=structuredClone(baseline);registry.revision=FR008_RULESET_REVISION;registry.fr008=true;
 for(const u of registry.factions.find(f=>f.id==='forge').units)for(const p of u.profiles)for(const a of p.abilities){
  if(a.familyId==='sky-hunt')a.text+=' Physically immune flyers inside a Cancel Physical Immunity Aura receive this Slow multiplied by its strongest transmission. A timed Physical breach still permits full Slow.';
  if(a.familyId==='cancel-physical-immunity-aura')a.text+=' Physically immune flyers also receive covering Dwarf Sky Hunt Slow at this transmission fraction. Other companion control immunities remain active.';
 }
 // Current user-authorized targeting amendment (2026-11-13). Preserve the
 // approved baseline records and every numeric flame/Burn parameter.
 const dragons=new Set(['el_baby_fire_dragon','el_fire_dragon','el_mother_fire_dragon','el_ancient_patriarch']);
 for(const unit of registry.factions.find(f=>f.id==='grove').units.filter(u=>dragons.has(u.id)))for(const p of unit.profiles){
  p.groundOnly=false;p.continuousAttack.targeting='ground-and-air';
  const cone=p.abilities.find(a=>a.familyId==='flame-cone');cone.targeting='ground-and-air';
  cone.text=cone.text.replace('to ground enemies','to ground and flying enemies');
 }
 for(const unit of registry.factions.find(f=>f.id==='grove').units){
  if(elfDisplayNames[unit.id])unit.name=elfDisplayNames[unit.id];
 }
 return registry;
}

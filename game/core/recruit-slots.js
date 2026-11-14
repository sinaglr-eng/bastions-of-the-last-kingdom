// FR-010 presentation identity. Runtime families and historical source records stay intact.
export const RECRUIT_SLOTS=Object.freeze({
 A:['soldier','dw_shieldguard','el_moonblade'],
 B:['archer','dw_musketeer','el_grove_archer'],
 C:['druid','dw_runesmith','el_spark_adept'],
 D:['mage','dw_boarrider','el_sealweaver'],
 E:['cleric','dw_grenadier','el_drow_cinder'],
 F:['runebreaker','dw_engineer','el_drow_blade'],
 G:['frostwarden','dw_griffinhandler','el_drow_acolyte'],
 H:['stormcaller','dw_furnacetender','el_dragon_keeper'],
});
export const recruitSlot=family=>Object.keys(RECRUIT_SLOTS).find(key=>RECRUIT_SLOTS[key].includes(family))||null;
export function applyRecruitSlots(data){
 for(const [family,unit]of Object.entries(data.towers))if(!unit.advanced){const code=recruitSlot(family);if(!code)throw Error('Missing recruit slot: '+family);unit.unitCode=code;}
 return data;
}

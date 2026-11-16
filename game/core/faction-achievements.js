// Faction milestones depend only on verified wave clears and champion crafts.
// Combat-performance counters are deliberately not inferred from discoveries.
const definition=(factionId,factionName,slug,thematicName,champions)=>Object.freeze({
 factionName,campaignName:`${factionName} Wave 50 Victory`,
 thematic:Object.freeze({id:`faction:${factionId}:${slug}`,slug,name:`${factionName} ${thematicName}`,champions:Object.freeze(champions),reward:4,xp:6}),
});
export const FACTION_ACHIEVEMENT_DEFINITIONS=Object.freeze({
 crown:definition('crown','Human','combined-arms','Combined Arms',['rimewatch','verdantguard','sunward']),
 forge:definition('forge','Dwarf','forge-engineering','Forge Engineering',['dw_cinderhowitzer','dw_ironclad','dw_steamharpooner']),
 grove:definition('grove','Elf','grove-guardians','Grove Guardians',['el_stormblade_warden','el_stag_knight','el_elven_archmage']),
});
export function factionCollectionAchievements(data){
 const factionId=data.factionId,definition=FACTION_ACHIEVEMENT_DEFINITIONS[factionId];if(!definition)return[];
 const all=Object.freeze(Object.entries(data.towers).filter(([,unit])=>unit.advanced).map(([id])=>id)),theme=definition.thematic;
 const named=theme.champions.map(id=>data.towers[id]?.name||id);
 return[
  {id:`collection:${factionId}:all`,factionId,kind:'collection',name:`All ${definition.factionName} Champions`,description:`Forge every ${definition.factionName} champion, from Basic through Secret, across legal runs.`,reward:12,xp:20,target:all.length,requiredChampions:all},
  {id:theme.id,factionId,kind:'faction-collection',name:theme.name,description:`Forge ${named.join(', ')} across legal ${definition.factionName} runs.`,reward:theme.reward,xp:theme.xp,target:theme.champions.length,requiredChampions:theme.champions},
 ];
}

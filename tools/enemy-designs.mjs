import {readFileSync} from 'node:fs';

export const approvedEnemyDesigns=JSON.parse(readFileSync(new URL('../data/enemy-designs.json',import.meta.url),'utf8'));

// Presentation fields only: keep legacy model enums, seeded variants, movement
// and every numerical combat field intact, including cosmetic clan alternatives.
export function applyEnemyDesigns(enemies,waves){
  for(const design of approvedEnemyDesigns.designs){
    const enemy=enemies[design.id];
    if(!enemy)throw new Error('Missing campaign enemy '+design.id);
    Object.assign(enemy,{name:design.name,appearance:design.appearance,visualAsset:design.id,designArchetype:design.archetype,auraStage:design.auraStage});
    const variants=approvedEnemyDesigns.variants[design.id];
    if(enemy.variants)enemy.variants=enemy.variants.map((variant,index)=>{
      const visual=variants?.[index];
      return {...variant,name:visual?.name||(index?design.name+' · Moon Clan':design.name),visualAsset:visual?`${design.id}-${visual.model==='dragon'||visual.model==='assassin'?'':visual.model}`.replace(/-$/,''):design.id,...(visual?.appearance?{appearance:visual.appearance}:{}),...(visual?.archetype?{designArchetype:visual.archetype}:{})};
    });
    const wave=waves[design.wave-1];
    if(!wave||wave.groups[0]?.type!==design.id)throw new Error('Incorrect wave order for '+design.id);
    wave.name=design.name;
  }
  return {enemies,waves};
}

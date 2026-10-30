export const FACTIONS=Object.freeze([
 {id:'crown',name:'Human',specialty:'Versatile',sceneWidth:1660,sceneHeight:948,scene:'assets/ui/faction-scenes-v062/crown-march.png',description:'Versatile defenders combining Physical, Magical and Holy damage. Flexible champions adapt to many threats.'},
 {id:'forge',name:'Dwarves',specialty:'Physical damage',sceneWidth:1660,sceneHeight:948,scene:'assets/ui/faction-scenes-v062/forge-march.png',description:'Physical damage specialists. Heavy weapons, sturdy warriors and powerful machines break through enemy lines.'},
 {id:'grove',name:'Elves',specialty:'Magical damage',sceneWidth:1659,sceneHeight:948,scene:'assets/ui/faction-scenes-v062/grove-march.png',description:'Magical damage specialists. Elemental spells, lunar magic and battlefield control overwhelm the enemy.'}
]);
export const factionName=id=>FACTIONS.find(f=>f.id===id)?.name||'Faction not recorded';
export function factionProfile(profile){
 const s={...profile,factionProfile:true,description:profile.abilities.map(a=>a.text).join(' '),listedDamage:profile.damage,projectileSpeed:18,projectileEffect:profile.type,abilities:profile.abilities||[]};
 const get=id=>s.abilities.find(a=>a.familyId===id),aura={range:0};
 for(const [id,key,param,scale]of [['armor-penetration','penetration','armorIgnorePercent',.01],['armor-reduction','shred','armorReduction',1],['slow','slow','slowPercent',.01],['visibility','detectionRange','radius',1],['multishot','multishot','targets',1],['slow-aura','slowAura','slowPercent',.01],['armor-reduction-aura','armorShredAura','armorReduction',1]]){const a=get(id);if(a)s[key]=a[param]*scale;}
 if(get('slow'))s.slowDuration=get('slow').duration;
 if(get('slow-aura'))s.slowAuraRange=get('slow-aura').radius;
 if(get('armor-reduction-aura'))s.effectRange=get('armor-reduction-aura').radius;
 for(const [id,key,param,scale]of [['attack-speed-aura','haste','bonusPercent',.01],['damage-aura','damageBonus','bonusPercent',.01],['range-aura','rangeBonus','rangeBonus',1],['protection-aura','controlResistance','protectionPercent',.01]]){const a=get(id);if(a){aura[key]=a[param]*scale;aura.range=Math.max(aura.range,a.radius);}}
 if(aura.range)s.aura=aura;
 return s;
}
export function createFactionData(current,registry,id){
 const f=registry.factions.find(f=>f.id===id);if(!f||!FACTIONS.some(f=>f.id===id))throw Error('Choose a valid faction.');
 const towers={};
 for(const u of f.units){
  const original=current.towers[u.id],human=id==='crown'||u.id==='ladyclaire';
  if(human&&!original)throw Error('Human combat identity missing: '+u.id);
  const advanced=u.kind!=='basic',levels=human?structuredClone(original.levels):u.profiles.map(factionProfile);
  towers[u.id]={...(human?structuredClone(original):factionProfile(u.profiles[0])),name:u.name,short:u.name,unitCode:u.code,advanced,weight:advanced?0:1,classification:u.classification,factionId:id,role:u.role,description:human?original.description:u.profiles[0].abilities.map(a=>a.text).join(' '),color:human?original.color:id==='forge'?'#b27b45':'#679882',icon:human?original.icon:'shield',...(advanced?{}:{levels})};
 }
 const recipes=id==='crown'?structuredClone(current.recipes):f.units.filter(u=>u.kind!=='basic').map(u=>({id:u.id,level:1,stage:u.classification,currentRoundOnly:u.id==='ladyclaire'||!!u.currentRoundOnly,ingredients:u.recipe.map(i=>({family:i.id,tier:i.rank}))}));
 for(const r of recipes){if(!towers[r.id]||!r.ingredients?.length)throw Error('Invalid faction recipe.');for(const i of r.ingredients)if(!towers[i.family]||!Number.isInteger(i.tier)||i.tier<1||i.tier>(towers[i.family].advanced?1:6))throw Error('Foreign or invalid ingredient.');}
 if(Object.values(towers).filter(t=>!t.advanced).length!==8||recipes.length!==38||f.assets.length!==86)throw Error('Incomplete faction package.');
 return {...current,towers,recipes,factionId:id,factionName:factionName(id),rulesetRevision:registry.revision,contentManifestId:'approved-faction-models-v3-20261030',defenderAssets:f.assets};
}

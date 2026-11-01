const definitions=new WeakMap();
const channels={'cancel-physical-immunity-aura':'physical','cancel-magic-immunity-aura':'magical'};
// Profiles are immutable within a run. Cache definitions, never live coverage:
// ownership, state and positions are checked again for every damage event.
function auraDefinitions(abilities){
 if(!Array.isArray(abilities))return [];
 if(!definitions.has(abilities))definitions.set(abilities,abilities.filter(a=>channels[a.familyId]&&Number.isFinite(a.radius)&&a.radius>0&&Number.isFinite(a.damageMultiplier)).map(a=>({channel:channels[a.familyId],radius:a.radius,multiplier:Math.max(0,Math.min(1,a.damageMultiplier))})));
 return definitions.get(abilities);
}
export function immunityAuraCoverage(enemy,towers,data){
 if(!data?.fr003)return null;
 const result={physical:{multiplier:0,sources:[]},magical:{multiplier:0,sources:[]}};
 if(enemy.dead||(!enemy.physicalImmune&&!enemy.magicImmune)||!Number.isFinite(enemy.x)||!Number.isFinite(enemy.z))return result;
 for(const tower of towers||[]){
  if(tower.state!=='active'||!Number.isFinite(tower.x)||!Number.isFinite(tower.z))continue;
  const definition=data.towers[tower.family],profile=definition?.levels?definition.levels[tower.tier-1]:definition;
  const squared=(tower.x-enemy.x)**2+(tower.z-enemy.z)**2;
  for(const aura of auraDefinitions(profile?.abilities)){
   if(aura.channel==='physical'?!enemy.physicalImmune:!enemy.magicImmune)continue;
   if(squared>aura.radius*aura.radius||aura.multiplier<=0)continue;
   const row=result[aura.channel];if(aura.multiplier<row.multiplier)continue;
   if(aura.multiplier>row.multiplier){row.multiplier=aura.multiplier;row.sources=[];}
   row.sources.push({id:tower.id,family:tower.family,name:definition.name||tower.family,radius:aura.radius});
  }
 }
 return result;
}

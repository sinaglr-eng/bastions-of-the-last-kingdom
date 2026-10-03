// One physical camera scale for the six ranks of a basic family. A taller hat
// or a different staff must not resize the body when switching ranks.
export function basicFamilyFrame(entries,family){
 const rows=entries.filter(entry=>entry.family===family&&entry.tier>=1&&entry.tier<=6);
 if(rows.length!==6||new Set(rows.map(entry=>entry.tier)).size!==6)return null;
 const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
 for(const entry of rows){
  const qa=entry.metrics||entry.qa;
  if(!qa?.boundsMin||!qa?.boundsMax||qa.boundsMin.length!==3||qa.boundsMax.length!==3)return null;
  for(let i=0;i<3;i++){
   if(!Number.isFinite(qa.boundsMin[i])||!Number.isFinite(qa.boundsMax[i])||qa.boundsMax[i]<=qa.boundsMin[i])return null;
   low[i]=Math.min(low[i],qa.boundsMin[i]);high[i]=Math.max(high[i],qa.boundsMax[i]);
  }
 }
 // Native metrics use Blender Z-up; exported models use Three.js Y-up.
 return {radius:Math.max(1,(high[2]-low[2])/2.2,(high[0]-low[0])/2.1,(high[1]-low[1])/2.1),centre:[0,(high[2]+low[2])/2,0]};
}

import {releaseAsset} from '../release.js';

export const GEOMETRIC_ASSET_ROOT='assets/geometric/';
export const geometricModelPath=(family,tier=1,advanced=false)=>`${GEOMETRIC_ASSET_ROOT}${advanced?'champions/'+family:'defenders/'+family+'-'+tier}.glb`;
export function geometricEntries(manifest){
  const entries=Array.isArray(manifest)?manifest:manifest.assets||manifest.entries||manifest.models||manifest.subjects;
  if(!Array.isArray(entries))throw new Error('Geometric manifest has no model entries');
  return entries.map(entry=>({...entry,tier:entry.tier??entry.rank??1,kind:entry.kind||(entry.category==='enemies'?'enemy':'tower')}));
}
export async function fetchGeometricEntries(manifest){
  const response=await fetch(releaseAsset(GEOMETRIC_ASSET_ROOT+manifest));
  if(!response.ok)throw new Error(`Geometric manifest ${manifest}: HTTP ${response.status}`);
  return geometricEntries(await response.json());
}
export const geometricEntryUrl=entry=>releaseAsset(entry.file.startsWith('assets/')?entry.file:GEOMETRIC_ASSET_ROOT+entry.file);
// Keep browser decoding bounded while the full roster streams in.
export async function loadModelEntries(entries,load,{concurrency=6,isDisposed=()=>false}={}){
  let next=0;
  const failures=[];
  await Promise.all(Array.from({length:Math.min(concurrency,entries.length)},async()=>{
    while(next<entries.length&&!isDisposed()){
      const entry=entries[next++];
      try{await load(entry);}catch(error){failures.push({entry,error});}
    }
  }));
  return failures;
}

// Pass the exact runtime hero geometry to Blender, keeping previews and GLBs identical.
import {writeFileSync,mkdirSync} from 'node:fs';
import {towerModel,DEFENDER_FAMILIES} from '../game/render/models.js';
import {CHAMPIONS} from '../game/render/champion-catalog.js';
const models=[];
for(const family of [...DEFENDER_FAMILIES,...Object.keys(CHAMPIONS)])for(let tier=1;tier<=(CHAMPIONS[family]?1:6);tier++){
  const advanced=!!CHAMPIONS[family],model=towerModel(family,tier,advanced),parts=[];
  model.traverse(o=>{if(o.isMesh){const g=o.geometry;parts.push({positions:Array.from(g.attributes.position.array),color:o.material.color.toArray(),indices:g.index?Array.from(g.index.array):null});}});
  models.push({family,tier,advanced,style:advanced?'champion-v3':'hero-v2',parts});
}
mkdirSync('blender/generated',{recursive:true});
writeFileSync('blender/generated/defenders.json',JSON.stringify(models));
console.log(`Prepared ${models.length} defender meshes for Blender.`);

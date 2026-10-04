import * as THREE from 'three';
import {enemyModel} from './models.js';
import {ENEMY_RULES as R,enemyDisarmActive} from '../core/enemy-rules.js';

export function enemyAssetKey(enemy,templates){
  if(enemy.visualAsset&&templates.has(enemy.visualAsset))return enemy.visualAsset;
  const variant=`${enemy.type}-${enemy.model}`;
  return templates.has(variant)?variant:enemy.type;
}
export function enemyFigure(enemy,templates){
  const key=enemyAssetKey(enemy,templates),template=templates.get(key);
  if(!template){const fallback=enemyModel(enemy.type,enemy);fallback.userData.assetKey=null;return fallback;}
  const root=new THREE.Group(),body=template.clone(true),limbs=[],wings=[];
  root.add(body);root.userData.sharedAsset=true;root.userData.body=body;root.userData.assetKey=key;
  root.userData.visualCues=[];root.userData.ownedMaterials=[];
  body.traverse(o=>{
    if(o.name.startsWith('leg_')){o.userData.restRotation=o.rotation.x;limbs.push(o);}
    if(o.name.startsWith('wing_')){o.userData.restRotation=o.rotation.z;wings.push(o);}
    if(o.name==='refraction_shards')root.userData.shards=o;
    if(o.isMesh&&o.userData.visualCue){
      const originals=Array.isArray(o.material)?o.material:[o.material],materials=originals.map(m=>m.clone());
      o.material=Array.isArray(o.material)?materials:materials[0];root.userData.ownedMaterials.push(...materials);
      root.userData.visualCues.push({node:o,kind:o.userData.visualCue,materials,base:materials.map(m=>({emissive:m.emissive?.clone(),intensity:m.emissiveIntensity||0}))});
    }
  });
  root.userData.limbs=limbs;root.userData.wings=wings;
  root.userData.barHeight=new THREE.Box3().setFromObject(body).max.y+.15;
  return root;
}
export function installEnemyTemplate(view,entry,scene){
  if(view.disposed)return false;view.enemyTemplates.set(entry.id,scene);
  for(const enemy of view.game.combat.enemies){
    const figure=view.enemies.get(enemy.id);if(!figure)continue;
    if(enemyAssetKey(enemy,view.enemyTemplates)!==figure.userData.assetKey){figure.removeFromParent();disposeEnemyFigure(figure);view.enemies.delete(enemy.id);}
  }
  view.previewKey=null;view.updateCampPreview();return true;
}
export function animateEnemyCues(root,enemy,elapsed,{reducedMotion=false}={}){
  // Reduced motion stops decorative pulsing, never the combat ability windows.
  const combatTime=Number.isFinite(elapsed)?Math.max(0,elapsed):0,pulseTime=reducedMotion?0:combatTime;
  for(const cue of root.userData.visualCues||[]){
    let active=.2;
    switch(cue.kind){
      case 'regen':active=enemy.statuses?.healBlock?0:.35+.18*Math.sin(pulseTime*2);break;
      case 'recharge':active=enemy.rechargeClock>R.recharge.period-.75&&!enemy.statuses?.healBlock?1:.12;break;
      case 'blink':active=enemy.blinkClock>R.blink.period-.4?1:.18;break;
      case 'reactiveArmor':active=Math.min(1,(enemy.reactiveStacks||0)/R.reactive.maxStacks);break;
      case 'rush':active=combatTime%R.rush.period<R.rush.duration?1:.15;break;
      case 'disarm':active=enemyDisarmActive(enemy,combatTime)?.85:.16;break;
      case 'refraction':active=enemy.shields>0?.5:0;break;
      case 'warDrums':active=enemy.hasteAura&&combatTime%R.support.hastePeriod<R.support.hasteDuration?.45+.25*Math.sin(pulseTime*3):.15;break;
      case 'magicImmune':case 'physicalImmune':active=.6;break;
      case 'evasion':active=.3+.16*Math.sin(pulseTime*2.4);break;
    }
    cue.materials.forEach((material,i)=>{if(material.emissive){material.emissive.copy(cue.base[i].emissive);material.emissiveIntensity=cue.base[i].intensity+Math.max(0,active)*.7;}});
  }
}
export function disposeEnemyFigure(root){
  // Imported clones share the pack's geometries and materials with future spawns.
  root.userData.bar?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  root.userData.aura?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  root.userData.ownedMaterials?.forEach(m=>m.dispose());
  if(!root.userData.sharedAsset)root.userData.body?.traverse(o=>o.geometry?.dispose());
}

import {enemyFigure,disposeEnemyFigure,animateEnemyCues} from './enemy-assets.js';
import {animateEnemyMotion} from './enemy-motion.js';
import {createGeometricMotionRig,resetGeometricMotion} from './geometric-motion.js';
import {createEnemyAura,animateEnemyAura} from './enemy-aura.js';
import {EnemyAbilityEffects} from './geometric-enemy-effects.js';
import {animateGeometricOrbits} from './geometric-orbits.js';

export function createAtelierEnemyPreview(scene,definition,template){
  const enemy={...definition,id:definition.wave,x:0,z:0,traveled:0,dead:false,statuses:{},shields:definition.refraction||0,rechargeClock:8,blinkClock:0};
  const figure=enemyFigure(enemy,new Map([[definition.visualAsset,template]]));
  figure.userData.geometricMotion=createGeometricMotionRig(figure);
  figure.userData.aura=createEnemyAura(enemy,figure.userData.body);
  if(figure.userData.aura)figure.add(figure.userData.aura);
  const effects=new EnemyAbilityEffects(scene,{maxEnemies:1,maxEffects:4});
  const preview={enemy,figure,effects,time:0,moving:false,flightLift:enemy.flying?.65:0,disposed:false};
  figure.position.y=preview.flightLift;
  return preview;
}

export function updateAtelierEnemyPreview(preview,dt,{reducedMotion=false,showEffects=true}={}){
  if(!preview||preview.disposed)return;
  const elapsed=Math.max(0,Number.isFinite(dt)?dt:0);preview.time+=elapsed;
  preview.effects.reducedMotion=reducedMotion;
  if(preview.moving)preview.enemy.traveled+=elapsed*Math.max(0,preview.enemy.speed||0);
  let bob=0;
  if(preview.moving)bob=animateEnemyMotion(preview.figure,preview.enemy,preview.time,{moving:true,reducedMotion});
  else{
    const rig=preview.figure.userData.geometricMotion;
    if(rig){resetGeometricMotion(rig);rig.clock=preview.time;rig.traveled=preview.enemy.traveled;}
  }
  preview.figure.position.y=preview.flightLift+bob;
  animateEnemyCues(preview.figure,preview.enemy,preview.time,{reducedMotion});
  animateEnemyAura(preview.figure.userData.aura,preview.time,{reducedMotion});
  animateGeometricOrbits(preview.figure.userData.body,preview.time,{reducedMotion});
  if(preview.figure.userData.aura)preview.figure.userData.aura.visible=showEffects;
  preview.effects.sync([preview.enemy],new Map([[preview.enemy.id,preview.figure]]),preview.time);
  preview.effects.update(elapsed);preview.effects.group.visible=showEffects;
}

export function disposeAtelierEnemyPreview(preview){
  if(!preview||preview.disposed)return;preview.disposed=true;
  preview.effects.dispose();disposeEnemyFigure(preview.figure);preview.figure.removeFromParent();
}

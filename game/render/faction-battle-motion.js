import * as THREE from 'three';
import {createFactionAttackPlayer} from './faction-attack-player.js';
import {authoredWeaponPhase} from './faction-attack-visuals.js';

// The attack clip includes the return to guard. Slow-firing weapons spend
// the rest of their cooldown in guard rather than moving in slow motion.
const strokeSeconds={
  'spear-thrust':.57,'sword-slash':.60,'dual-blade':.48,'axe-cleave':.75,
  'hammer-slam':.83,'pick-strike':.63,'bow-shot':.73,'rifle-shot':.49,
  'mortar-shot':.68,'grenade-throw':.76,'cannon-shot':.70,
  'ballista-shot':.74,'catapult-shot':.97,'staff-cast':.79,'hand-cast':.66,
  'ent-slam':.98,'beak-strike':.58,'spider-strike':.50,'drum-strike':.52,'mech-punch':.72,
};
const aimPoint=new THREE.Vector3();
function aim(rig,target){
  rig.faction.aimAt(aimPoint.set(target.x-18,0,target.z-18));
}
function sampleState(rig){
  rig.stage=rig.faction.state.stage;
  rig.active=rig.stage!=='idle';
}
function timing(rig,interval,rate,reducedMotion){
  return {cadenceSeconds:Math.min(interval||rig.runtimeAttack.intervalSeconds,rig.strokeSeconds),
    rateMultiplier:rate??1,reducedMotion};
}
export function factionBattleRig(actor,entry,stats){
  const nativeAttack=entry.attack;
  const runtimeAttack=Number.isFinite(stats.damage)?{
    ...nativeAttack,intervalSeconds:stats.interval,weaponCycle:stats.weaponCycle||null,
    cycleMetrics:stats.cycleMetrics||{},continuousAttack:stats.continuousAttack||null,
    mode:stats.continuousAttack?'continuous':stats.damage<=0?'aura-only':'discrete'
  }:nativeAttack;
  const rank=Math.max(1,Math.min(6,entry.tier||1));
  const weight=nativeAttack.weaponGroup==='lance'||nativeAttack.bodyType==='construct'?1.12:1;
  const naturalStroke=(strokeSeconds[nativeAttack.motionKind]??.8)*weight*(1+.025*(rank-1));
  return {faction:createFactionAttackPlayer(actor,{...entry,attack:runtimeAttack}),nativeAttack,runtimeAttack,
    strokeSeconds:naturalStroke,handIndex:0,lastMotionRelease:null,lastChannelStep:null,channelTarget:null,stage:'idle',active:false};
}
export function releaseFactionMotion(rig,payload){
  const p=rig.faction,mode=rig.runtimeAttack.mode;
  if(mode!=='discrete'){
    if(payload.target){
      rig.channelTarget=payload.target;
      rig.lastChannelStep=payload.combatTime;
      aim(rig,payload.target);
      p.setChannel(true,{reducedMotion:payload.reducedMotion});
      sampleState(rig);
    }
    return;
  }
  // Every target in a single volley receives a packet. Only the primary
  // release moves the weapon. A secondary aura cannot turn its caster either.
  if(payload.firstPrimary===false||payload.breath)return;
  const stamp=payload.volleyStamp??payload.combatTime??payload.id;
  if(stamp!=null&&stamp===rig.lastMotionRelease)return;
  rig.lastMotionRelease=stamp;
  // An actual volley chooses one attacking limb. Side changes never add hits.
  rig.handIndex=Number.isInteger(payload.releaseCount)?(payload.releaseCount-1)%2:0;
  if(payload.target)aim(rig,payload.target);
  const rate=payload.visualRate??1;
  const options=rig.runtimeAttack.weaponCycle?{rateMultiplier:rate,reducedMotion:payload.reducedMotion}:
    timing(rig,payload.stats?.interval,rate,payload.reducedMotion);
  const phase=payload.source?.weaponCycleState?.phase;
  if(phase!==undefined&&rig.runtimeAttack.weaponCycle){
    rig.authoritativePhase=phase;
    rig.nativePosePhase=authoredWeaponPhase(rig.runtimeAttack,rig.nativeAttack,phase,rate);
    options.cyclePhase=rig.nativePosePhase;
  }
  p.releaseFromCombat({stamp,...options});
  rig.releaseTime=payload.combatTime;
  sampleState(rig);
}
export function updateFactionMotion(rig,dt,context,reducedMotion){
  if(dt===0)return;
  const p=rig.faction,rate=context.rate??1;
  const options={reducedMotion,rateMultiplier:rate};
  if(context.blocked||context.combat===false){
    if(rig.stage!=='idle')p.interrupt();
    rig.channelTarget=null;
  }else if(rig.runtimeAttack.mode!=='discrete'){
    // The cone may select a different target than the tower's generic
    // priority (e.g. ground-only). Its own combat event supplies its aim.
    const authoritative=rig.runtimeAttack.mode==='continuous'&&context.stamp!=null;
    const target=authoritative?(context.stamp===rig.lastChannelStep?rig.channelTarget:null):context.target;
    if(target){aim(rig,target);p.setChannel(true,options);}
    else if(rig.stage!=='idle')p.setChannel(false);
  }else if(rig.runtimeAttack.weaponCycle){
    if(context.target)aim(rig,context.target);
    const phase=context.tower?.weaponCycleState?.phase;
    if(phase!==undefined){
      rig.authoritativePhase=phase;
      rig.nativePosePhase=authoredWeaponPhase(rig.runtimeAttack,rig.nativeAttack,phase,rate);
      p.syncWeaponCycle({phase:rig.nativePosePhase,...options});
    }else if(rig.stage!=='idle')p.interrupt();
  }else if(context.combat&&context.target&&rate>0&&Number.isFinite(context.cooldown)){
    if(rig.stage!=='attack')aim(rig,context.target);
    p.prepareFromCooldown({...timing(rig,context.interval,rate,reducedMotion),cooldownSeconds:Math.max(0,context.cooldown)/rate});
  }else if(rig.stage==='preparation'){
    p.interrupt();
  }
  // Keep the release on its exact keyframe for the simulation step that
  // created the projectile; the next step samples its recovery.
  if(context.stamp==null||rig.releaseTime!==context.stamp)p.update(dt,options);
  sampleState(rig);
}

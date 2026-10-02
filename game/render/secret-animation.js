import * as THREE from 'three';
import {distance,supportBonuses,towerStats} from '../core/math.js';

export const SECRET_ATTACK_RELEASE=.36;
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=value=>THREE.MathUtils.clamp(finite(value),0,1);

/** Native exported bone animation. This module never schedules combat hits. */
export function createSecretAnimation(actor,family,stats={}){
  if(!actor)return null;
  let skinned=false;actor.traverse(node=>{skinned||=!!node.isSkinnedMesh;});
  const clips=actor.animations||[],idleClip=clips.find(clip=>clip.name==='Idle'),attackClip=clips.find(clip=>clip.name==='Attack');
  if(!skinned||!idleClip||!attackClip||!(attackClip.duration>0))return null;
  const mixer=new THREE.AnimationMixer(actor),idle=mixer.clipAction(idleClip),attack=mixer.clipAction(attackClip);
  idle.play();idle.paused=true;attack.play();attack.paused=true;
  let release=SECRET_ATTACK_RELEASE;actor.traverse(node=>{const value=node.userData.attackReleaseFraction;if(Number.isFinite(value)&&value>0&&value<1)release=value;});
  const rig={actor,family,mixer,idle,attack,idleClip,attackClip,release,clock:0,phase:0,stage:'idle',interval:stats.interval||attackClip.duration,rate:1,cycleDuration:attackClip.duration,lastRelease:null,disposed:false};
  actor.userData.nativeDefenderAnimation=true;
  if(family==='ladyclaire'||family==='lordbernhard')actor.userData.nativeSecretAnimation=true;
  sample(rig,0);return rig;
}
function sample(rig,phase,{reducedMotion=false}={}){
  rig.phase=clamp(phase);
  const active=rig.stage!=='idle'&&!reducedMotion;
  rig.idle.enabled=true;rig.idle.time=reducedMotion?0:rig.clock%Math.max(.001,rig.idleClip.duration);rig.idle.setEffectiveWeight(active?0:1);
  rig.attack.enabled=true;rig.attack.time=rig.phase*rig.attackClip.duration;rig.attack.setEffectiveWeight(active?1:0);
  rig.mixer.update(0);rig.actor.updateMatrixWorld(true);
}
function cycleDuration(rig,interval,rate=1){
  // Fit the complete authored stroke inside the unchanged effective cadence.
  return Math.max(.001,Math.min(rig.attackClip.duration,finite(interval,rig.attackClip.duration)/Math.max(.01,finite(rate,1))*.90));
}
export function releaseSecretAttack(rig,{interval=rig?.interval,rate=rig?.rate??1,stamp=null,reducedMotion=false}={}){
  if(!rig||rig.disposed)return false;
  // Multiple targets belonging to one volley share one cast and one release pose.
  if(stamp!==null&&rig.lastRelease===stamp)return false;
  rig.interval=Math.max(.001,finite(interval,rig.interval));rig.rate=Math.max(0,finite(rate,rig.rate));
  rig.lastRelease=stamp;rig.cycleDuration=cycleDuration(rig,rig.interval,rig.rate);rig.stage='recovery';
  sample(rig,rig.release,{reducedMotion});return true;
}
export function secretAttackContext(tower,game){
  const combat=game.phase==='combat',stats=towerStats(tower,game.data),bonuses=supportBonuses(tower,game.towers,game.data);
  stats.range+=bonuses.range;let dread=0;
  for(const enemy of game.combat.enemies)if(!enemy.dead&&enemy.untouchable&&distance(tower,enemy)<4)dread=Math.max(dread,enemy.untouchable*(1-(bonuses.controlResistance||0)));
  let rate=bonuses.haste*(1-dread);
  for(const other of game.towers)if(other.state==='ruin'&&other.weakened>0&&distance(tower,other)<2)rate*=.85;
  const blocked=tower.state!=='active'||!!tower.disarmed||(tower.melancholyUntil||0)>game.combat.elapsed;
  return {combat,blocked,interval:stats.interval,rate,cooldown:tower.cooldown,target:combat&&!blocked?game.combat.targetList(tower,stats)[0]||null:null,stamp:combat?game.combat.elapsed:null};
}
export function updateSecretAnimation(rig,dt,{interval=rig?.interval,rate=rig?.rate??1,cooldown=Infinity,target=null,combat=false,blocked=false,stamp=null,reducedMotion=false}={}){
  if(!rig||rig.disposed)return;
  const elapsed=Math.max(0,finite(dt));rig.clock=(rig.clock+elapsed)%1e6;
  // Simulation dt=0 freezes every bone, including Idle and orbiting orbs.
  if(!elapsed)return;
  rig.interval=Math.max(.001,finite(interval,rig.interval));rig.rate=Math.max(0,finite(rate,rig.rate));
  if(rig.stage==='recovery'){
    if(stamp!==null&&stamp===rig.lastRelease){sample(rig,rig.phase,{reducedMotion});return;}
    rig.cycleDuration=cycleDuration(rig,rig.interval,rig.rate);
    const next=rig.phase+elapsed/rig.cycleDuration;
    if(next<1){sample(rig,next,{reducedMotion});return;}
    rig.stage='idle';
  }
  const duration=cycleDuration(rig,rig.interval,rig.rate),remaining=Math.max(0,finite(cooldown,Infinity))/Math.max(.01,rig.rate),preparation=duration*rig.release;
  if(combat&&!blocked&&target&&remaining>0&&remaining<=preparation){
    rig.stage='preparation';rig.cycleDuration=duration;sample(rig,rig.release*(1-remaining/preparation),{reducedMotion});
  }else{rig.stage='idle';sample(rig,0,{reducedMotion});}
}
export function resetSecretAnimation(rig,{reducedMotion=false}={}){
  if(!rig||rig.disposed)return;rig.stage='idle';rig.lastRelease=null;sample(rig,0,{reducedMotion});
}

/** Atelier plays the complete preparation, release and recovery for inspection. */
export function previewSecretAttack(rig,{duration=1}={}){
  if(!rig||rig.disposed)return false;rig.stage='preview';rig.cycleDuration=Math.max(.1,finite(duration,1));sample(rig,0);return true;
}
export function updateSecretPreview(rig,dt,{reducedMotion=false,onRelease=()=>{}}={}){
  if(!rig||rig.disposed)return;
  const elapsed=Math.max(0,finite(dt));if(!elapsed)return;rig.clock=(rig.clock+elapsed)%1e6;
  if(rig.stage==='preview'){
    const previous=rig.phase,next=Math.min(1,previous+elapsed/rig.cycleDuration);
    // Sample the exact release pose before obtaining the weapon's world muzzle.
    if(previous<rig.release&&next>=rig.release){sample(rig,rig.release,{reducedMotion});onRelease({elapsedAfterRelease:(next-rig.release)*rig.cycleDuration});}
    if(next>=1){rig.stage='idle';sample(rig,0,{reducedMotion});}else sample(rig,next,{reducedMotion});
  }else{rig.stage='idle';sample(rig,0,{reducedMotion});}
}
export function disposeSecretAnimation(rig){
  if(!rig||rig.disposed)return;rig.mixer.stopAllAction();rig.mixer.uncacheRoot(rig.actor);delete rig.actor.userData.nativeSecretAnimation;delete rig.actor.userData.nativeDefenderAnimation;rig.disposed=true;
}

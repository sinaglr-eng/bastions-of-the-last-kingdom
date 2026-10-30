import * as THREE from 'three';

const clamp01=value=>Math.max(0,Math.min(1,value));
const finitePositive=(value,fallback,name)=>{
  if(value===undefined)return fallback;
  if(!Number.isFinite(value)||value<=0)throw new RangeError(`${name} must be a finite positive number`);
  return value;
};
const attackOf=profile=>profile?.attack??profile??{};
const modeOf=attack=>attack.mode==='aura-only'||attack.mode==='aura'?'aura-only':attack.mode==='continuous'||attack.continuousAttack||attack.continuous?'continuous':'discrete';

/** Presentation stages only. This function never consumes ammunition or fires. */
export function weaponCycleStage(profile,phase){
  const attack=attackOf(profile),cycle=attack.weaponCycle;
  if(!cycle)return null;
  const magazine=Math.max(1,Math.trunc(cycle.magazine||1));
  const interval=Number(cycle.fixedInterval??attack.intervalSeconds)||0;
  const spinUp=Math.max(0,Number(cycle.spinUpSeconds)||0),reload=Math.max(0,Number(cycle.reload)||0);
  const duration=Number(attack.cycleMetrics?.cycleSeconds)||Number(attack.cycleSeconds)||spinUp+magazine*interval+reload;
  const elapsed=clamp01(phase)*duration;
  return Object.freeze({stage:elapsed<spinUp?'spin-up':elapsed<spinUp+magazine*interval?'firing':elapsed<duration?'reload':'complete',
    magazine,fixedIntervalSeconds:interval,spinUpSeconds:spinUp,reloadSeconds:reload,sourceCycleSeconds:duration,sourceElapsedSeconds:elapsed});
}

/**
 * Drive real exported skins on ONE private actor. No combat scheduler, damage,
 * target selection, ammunition consumption or projectile simulation lives here.
 */
export function createFactionAttackPlayer(actor,profile,{clips=actor?.animations,onVisualRelease=()=>{}}={}){
  if(!actor?.isObject3D)throw new TypeError('A private Three.js actor is required');
  if(actor.userData.factionAttackPlayer)throw new Error('This actor already has an attack player');
  if(typeof onVisualRelease!=='function')throw new TypeError('onVisualRelease must be a function');
  const idleClip=clips?.find(clip=>clip.name==='Idle'),attackClip=clips?.find(clip=>clip.name==='Attack');
  let skinned=false;actor.traverse(node=>{skinned||=!!node.isSkinnedMesh;});
  if(!skinned||!idleClip||!attackClip||!(idleClip.duration>0)||!(attackClip.duration>0))throw new Error('Actual Idle and Attack clips with a real skin are required');
  const attackProfile=attackOf(profile),mode=modeOf(attackProfile),hasWeaponCycle=!!attackProfile.weaponCycle;
  const marker=attackProfile.eventSemantics?.releasePhase??attackProfile.releasePhase;
  const releasePhase=mode==='discrete'&&attackProfile.eventSemantics?.discreteRelease!==false&&Number.isFinite(marker)?clamp01(marker):null;
  const selectedCycle=Number(attackProfile.cycleMetrics?.cycleSeconds)||Number(attackProfile.cycleSeconds)||attackClip.duration;
  const defaultDuration=mode!=='discrete'||hasWeaponCycle?selectedCycle:Number(attackProfile.intervalSeconds)||selectedCycle;
  const mixer=new THREE.AnimationMixer(actor),idle=mixer.clipAction(idleClip),attack=mixer.clipAction(attackClip);
  idle.setLoop(THREE.LoopRepeat,Infinity);attack.setLoop(THREE.LoopOnce,1);attack.clampWhenFinished=true;
  idle.play();attack.play();idle.paused=attack.paused=true;
  let stage='idle',phase=0,clock=0,rateMultiplier=1,timingMultiplier=1,baseDuration=defaultDuration;
  let released=false,cycleStamp=null,disposed=false,generation=0,reducedMotion=false,loops=0;
  const stamps=new Set(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
  const effectiveDuration=()=>rateMultiplier===0?Infinity:baseDuration/(rateMultiplier*timingMultiplier);
  const assertLive=()=>{if(disposed)throw new Error('The attack player has been disposed');};
  function sample(value){
    // These exports are +Z forward and +Y up. Preserve caller placement and
    // yaw; never turn an imported top-level animation track into root motion.
    position.copy(actor.position);quaternion.copy(actor.quaternion);scale.copy(actor.scale);
    phase=clamp01(value);const active=stage!=='idle'&&!reducedMotion;
    idle.enabled=true;attack.enabled=true;
    idle.time=reducedMotion?0:clock%idleClip.duration;idle.setEffectiveWeight(active?0:1);
    attack.time=(reducedMotion?0:phase)*attackClip.duration;attack.setEffectiveWeight(active?1:0);
    mixer.update(0);
    actor.position.copy(position);actor.quaternion.copy(quaternion);actor.scale.copy(scale);actor.updateMatrixWorld(true);
  }
  function setTiming(options={}){
    assertLive();
    const nextRate=options.rateMultiplier===undefined?rateMultiplier:options.rateMultiplier;
    if(!Number.isFinite(nextRate)||nextRate<0)throw new RangeError('rateMultiplier must be finite and nonnegative');
    if(options.cadenceSeconds!==undefined&&hasWeaponCycle&&options.cycleSeconds===undefined)throw new Error('A magazine weapon needs its full cycleSeconds, not its per-shot cadenceSeconds');
    const nextBase=finitePositive(options.cycleSeconds??options.cadenceSeconds,baseDuration,'cycleSeconds');
    const nextTiming=finitePositive(options.timingMultiplier,timingMultiplier,'timingMultiplier');
    if(nextRate>0&&(!Number.isFinite(nextRate*nextTiming)||!(nextBase/(nextRate*nextTiming)>0)))throw new RangeError('Combined playback rate must produce a finite positive cycle');
    rateMultiplier=nextRate;baseDuration=nextBase;timingMultiplier=nextTiming;
    if(options.reducedMotion!==undefined)reducedMotion=!!options.reducedMotion;
    return timing();
  }
  function timing(){return Object.freeze({exportedClipSeconds:attackClip.duration,sourceCycleSeconds:baseDuration,
    effectiveCycleSeconds:effectiveDuration(),clipTimeScale:attackClip.duration/effectiveDuration(),rateMultiplier,timingMultiplier});}
  function remember(stamp){
    if(stamp===null||stamp===undefined)return true;
    if(stamps.has(stamp))return false;
    stamps.add(stamp);if(stamps.size>256)stamps.delete(stamps.values().next().value);return true;
  }
  function notify(source,stamp,elapsedAfterRelease=0){
    onVisualRelease(Object.freeze({type:'visual-release',visualOnly:true,source,mode,phase,authoredReleasePhase:releasePhase,
      stamp,elapsedAfterRelease,weaponCycle:weaponCycleStage(attackProfile,phase),actor}));
  }
  function playAttack(options={}){
    assertLive();if(mode!=='discrete')return setChannel(true,options);
    if(stage!=='idle'&&!options.restart)return false;
    if(options.stamp!==undefined&&!remember(options.stamp))return false;
    setTiming(options);generation++;stage='attack';released=false;cycleStamp=options.stamp??null;phase=0;loops=0;sample(0);return true;
  }
  function setChannel(active,options={}){
    assertLive();if(mode==='discrete')throw new Error('Only continuous or aura-only profiles can channel');
    if(!active){interrupt();return false;}
    setTiming(options);if(stage!=='channel'){generation++;stage='channel';phase=0;released=true;loops=0;sample(0);}return true;
  }
  function syncWeaponCycle({phase:nextPhase,...options}){
    assertLive();if(!hasWeaponCycle||mode!=='discrete')throw new Error('This profile has no authoritative magazine cycle to synchronize');
    if(!Number.isFinite(nextPhase)||nextPhase<0||nextPhase>1)throw new RangeError('Authoritative cycle phase must be between zero and one');
    setTiming(options);generation++;stage='external-cycle';released=true;sample(nextPhase);return weaponCycleStage(attackProfile,phase);
  }
  function releaseFromCombat(options={}){
    assertLive();if(mode!=='discrete'||releasePhase===null)return false;
    if(options.stamp!==undefined&&stamps.has(options.stamp))return false;
    if(hasWeaponCycle){
      if(options.cyclePhase!==undefined)syncWeaponCycle({...options,phase:options.cyclePhase});
      else if(stage==='idle')throw new Error('Start the full magazine cycle or supply the authoritative cyclePhase before its shot event');
      else setTiming(options);
      remember(options.stamp);released=true;sample(phase);notify('combat-event',options.stamp??null);return true;
    }
    setTiming(options);remember(options.stamp);generation++;stage='attack';released=true;cycleStamp=options.stamp??null;
    sample(releasePhase);notify('combat-event',cycleStamp);return true;
  }
  function prepareFromCooldown({cooldownSeconds,...options}){
    assertLive();if(mode!=='discrete'||hasWeaponCycle||releasePhase===null)return false;
    if(!Number.isFinite(cooldownSeconds)||cooldownSeconds<0)throw new RangeError('Effective cooldownSeconds must be finite and nonnegative');
    if(stage!=='idle'&&stage!=='preparation')return false;
    setTiming(options);const preparation=effectiveDuration()*releasePhase;
    if(!Number.isFinite(preparation)||preparation<=0||cooldownSeconds>preparation){if(stage==='preparation')interrupt();return false;}
    stage='preparation';released=false;sample(releasePhase*(1-cooldownSeconds/preparation));return true;
  }
  function update(dt,options={}){
    assertLive();if(!Number.isFinite(dt)||dt<0)throw new RangeError('Simulation delta must be finite and nonnegative');
    if(dt===0)return; // Pause freezes bones, stage, timing changes and callbacks.
    setTiming(options);clock=(clock+dt)%1e6;
    if(stage==='idle'){sample(0);return;}
    if(stage==='external-cycle'||stage==='preparation'){sample(phase);return;}
    const duration=effectiveDuration(),next=phase+dt/duration;
    if(!Number.isFinite(duration)){sample(phase);return;}
    if(!Number.isFinite(next))throw new RangeError('Simulation delta exceeds the supported playback range');
    if(stage==='channel'){loops+=Math.floor(next);sample(next%1);return;}
    const token=generation;
    if(!released&&releasePhase!==null&&phase<=releasePhase&&next>=releasePhase){
      released=true;sample(releasePhase);notify('authored-cycle',cycleStamp,Math.max(0,(next-releasePhase)*duration));
      if(disposed||generation!==token)return;
    }
    if(next>=1){stage='idle';sample(0);}else sample(next);
  }
  function interrupt({clearStamps=false}={}){
    assertLive();generation++;stage='idle';phase=0;released=false;cycleStamp=null;
    if(clearStamps)stamps.clear();sample(0);
  }
  function reset(){assertLive();clock=0;loops=0;interrupt({clearStamps:true});}
  function aimAt(worldTarget){
    assertLive();if(!worldTarget||![worldTarget.x,worldTarget.y??0,worldTarget.z].every(Number.isFinite))throw new TypeError('A finite world-space target is required');
    actor.updateWorldMatrix(true,false);const origin=actor.getWorldPosition(new THREE.Vector3());
    const direction=new THREE.Vector3(worldTarget.x-origin.x,0,worldTarget.z-origin.z);
    if(direction.lengthSq()<1e-12)return false;
    const desired=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(direction.x,direction.z));
    if(actor.parent)desired.premultiply(actor.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
    actor.quaternion.copy(desired);actor.updateMatrixWorld(true);return true;
  }
  function dispose(){
    if(disposed)return;
    const placement={position:actor.position.clone(),quaternion:actor.quaternion.clone(),scale:actor.scale.clone()};
    interrupt();mixer.stopAllAction();mixer.uncacheRoot(actor);actor.position.copy(placement.position);actor.quaternion.copy(placement.quaternion);actor.scale.copy(placement.scale);actor.updateMatrixWorld(true);delete actor.userData.factionAttackPlayer;disposed=true;
    // Private skeleton ownership/texture disposal belongs to the host's clone
    // lifecycle. Shared geometries, materials and clips are never disposed here.
  }
  const player={actor,mixer,idleClip,attackClip,playAttack,releaseFromCombat,prepareFromCooldown,setChannel,syncWeaponCycle,update,setTiming,timing,aimAt,interrupt,reset,dispose,
    get state(){return Object.freeze({stage,phase,mode,disposed,loops,released,cycleStamp,weaponCycle:weaponCycleStage(attackProfile,phase),...timing()});}};
  actor.userData.factionAttackPlayer=true;sample(0);return player;
}

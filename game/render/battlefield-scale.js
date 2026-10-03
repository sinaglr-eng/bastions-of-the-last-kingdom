// Game tiles are presentation space. Native Blender and Atelier sizes stay intact.
export const BATTLEFIELD_UNIT_SCALE=.88*.8;
export const BATTLEFIELD_BOSS_MULTIPLIER=1.5;
export const enemyPresentationMultiplier=enemy=>enemy?.boss?BATTLEFIELD_BOSS_MULTIPLIER:1;
const baseScales=new WeakMap(),authoredScales=new WeakMap(),bossMultipliers=new WeakMap();
export function scaleBattlefieldUnit(actor,enemy=null){
  const multiplier=enemy?enemyPresentationMultiplier(enemy):bossMultipliers.get(actor)||1;
  if(!baseScales.has(actor)||bossMultipliers.get(actor)!==multiplier){
    if(!authoredScales.has(actor))authoredScales.set(actor,actor.scale.clone());
    actor.scale.copy(authoredScales.get(actor)).multiplyScalar(BATTLEFIELD_UNIT_SCALE*multiplier);
    baseScales.set(actor,actor.scale.clone());bossMultipliers.set(actor,multiplier);
  }
  return actor;
}
export function animateBattlefieldIdleScale(actor,stretch=0){
  const base=baseScales.get(actor)||actor.scale;
  actor.scale.set(base.x,base.y*(1+stretch),base.z);
}

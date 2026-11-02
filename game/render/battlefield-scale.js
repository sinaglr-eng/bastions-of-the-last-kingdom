// Game tiles are presentation space. Native Blender and Atelier sizes stay intact.
export const BATTLEFIELD_UNIT_SCALE=.88*.8;
export const BATTLEFIELD_BOSS_MULTIPLIER=1.875*.84*.75;
// The seven largest ordinary V6 silhouettes (authored height >= 3.7), plus
// every boss, shrink by 25% relative to the previous battlefield presentation.
// Source models, smaller enemies, collision, range, routes and HP stay intact.
export const LARGE_ENEMY_PRESENTATION_IDS=Object.freeze(['host_22','host_39','host_42','host_43','host_45','host_46','host_49']);
const largeEnemies=new Set(LARGE_ENEMY_PRESENTATION_IDS);
export function enemyPresentationMultiplier(enemy){
  if(enemy?.boss)return BATTLEFIELD_BOSS_MULTIPLIER;
  const id=String(enemy?.visualAsset||enemy?.type||'').match(/^host_\d{2}/)?.[0];return largeEnemies.has(id)?.75:1;
}
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

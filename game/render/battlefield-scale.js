// Game tiles are presentation space. Native Blender and Atelier sizes stay intact.
export const BATTLEFIELD_UNIT_SCALE=.88;
const baseScales=new WeakMap();
export function scaleBattlefieldUnit(actor){
  if(!baseScales.has(actor)){actor.scale.multiplyScalar(BATTLEFIELD_UNIT_SCALE);baseScales.set(actor,actor.scale.clone());}
  return actor;
}
export function animateBattlefieldIdleScale(actor,stretch=0){
  const base=baseScales.get(actor)||actor.scale;
  actor.scale.set(base.x,base.y*(1+stretch),base.z);
}

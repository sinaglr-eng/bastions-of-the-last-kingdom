// Animate each figure's private hierarchy; native geometry and shared templates
// retain their authored rest pose. Combat and exhibition use separate clocks.
export function animateEnemyMotion(figure,enemy,time,{moving=true,reducedMotion=false}={}){
  const body=figure.userData.body;if(!body)return 0;
  const clock=Number.isFinite(time)?Math.max(0,time):0;
  const phase=Number(enemy.id??enemy.previewRound??0)*1.618;
  const native=figure.userData.nativeFlight;
  if(native){
    native.action.time=reducedMotion?0:(clock+phase*.03)%Math.max(.001,native.duration);
    native.mixer.update(0);body.updateMatrixWorld(true);
    return reducedMotion?0:Math.sin(clock*2.5+phase)*.025;
  }
  const motion=reducedMotion?0:1,flying=!!enemy.flying;
  const archetype=enemy.designArchetype||'',wyvern=archetype.includes('wyvern')||enemy.model==='dragon';
  const manta=archetype.includes('manta'),armored=archetype==='iron-bat';
  const frequency=wyvern?3.4:manta?4.1:armored?5.2:9;
  const stroke=Math.sin(clock*frequency+phase)*motion;
  const amplitude=wyvern?.36:manta?.29:armored?.50:.68;
  for(const [index,wing]of (figure.userData.wings||[]).entries()){
    const side=wing.userData.wingSide??(wing.name.endsWith('_L')?-1:wing.name.endsWith('_R')?1:index%2?1:-1);
    wing.rotation.z=(wing.userData.restRotation||0)+stroke*amplitude*side;
  }
  const pace=clock*Math.max(.3,Number(enemy.speed)||1)*6+phase;
  for(const [index,limb]of (figure.userData.limbs||[]).entries()){
    const rest=limb.userData.restRotation??0;
    const gait=limb.userData.gaitPhase??(index%2)*Math.PI;
    limb.rotation.x=rest+Math.sin((flying?clock*2.4:pace)+gait)*(flying?.07:moving?.40:.025)*motion;
  }
  const rest=body.userData.motionRest??={rotation:body.rotation.clone(),scale:body.scale.clone()};
  const breath=Math.sin(clock*2.2+phase)*.008*motion;
  body.scale.set(rest.scale.x*(1-breath*.25),rest.scale.y*(1+breath),rest.scale.z*(1-breath*.25));
  body.rotation.x=rest.rotation.x+(flying?Math.cos(clock*frequency+phase)*.024:0)*motion;
  body.rotation.z=rest.rotation.z+(enemy.hit>0?.10:0)+Math.sin(flying?clock*2+phase:pace)*
    (flying?.028:moving?.018:.012)*motion;
  return flying?Math.sin(clock*frequency+phase)*.075*motion:moving?Math.abs(Math.sin(pace))*.028*motion:0;
}

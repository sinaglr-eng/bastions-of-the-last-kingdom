import * as THREE from 'three';

const rigs=new WeakMap(),axis=new THREE.Vector3(0,1,0);
const finite=value=>Number.isFinite(value)?Math.max(0,value):0;
function bind(actor,time){
  const orbs=[];actor.updateMatrixWorld(true);
  actor.traverse(node=>{
    if(!node.userData.sourceOrbitGem||!node.parent)return;
    const bounds=new THREE.Box3().setFromObject(node,true);if(bounds.isEmpty())return;
    const worldCentre=bounds.getCenter(new THREE.Vector3()),centre=node.parent.worldToLocal(worldCentre.clone()),offset=node.worldToLocal(worldCentre.clone());
    orbs.push({node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone(),centre,offset,radius:Math.hypot(centre.x,centre.z),phase:Math.atan2(centre.z,centre.x)});
  });
  const rig={last:time,clock:0,orbs,point:new THREE.Vector3(),offset:new THREE.Vector3(),spin:new THREE.Quaternion()};rigs.set(actor,rig);return rig;
}

// Source orbit groups can have their origin at (0,0,0), with an off-centre
// diamond baked into the vertices. Move and spin around that actual centre;
// never change those shared buffers or the source's radius/height/scale.
export function animateGeometricOrbits(actor,time,{reducedMotion=false,melancholy=false}={}){
  if(!actor)return false;
  const clock=finite(time),rig=rigs.get(actor)||bind(actor,clock);
  const elapsed=Math.min(.25,Math.max(0,clock-rig.last));rig.last=clock;
  if(!reducedMotion)rig.clock+=elapsed*(melancholy ? .22 : 1);
  for(const orb of rig.orbs){
    const {node,position,quaternion,scale,centre,offset,radius,phase}=orb;
    if(reducedMotion){node.position.copy(position);node.quaternion.copy(quaternion);node.scale.copy(scale);continue;}
    const angle=phase+rig.clock*.65;
    rig.point.set(Math.cos(angle)*radius,centre.y+(Math.sin(rig.clock*1.6+phase)-Math.sin(phase))*.025,Math.sin(angle)*radius);
    node.quaternion.copy(quaternion).multiply(rig.spin.setFromAxisAngle(axis,rig.clock*.35));node.scale.copy(scale);
    rig.offset.copy(offset).multiply(scale).applyQuaternion(node.quaternion);
    node.position.copy(rig.point).sub(rig.offset);
  }
  return rig.orbs.length>0;
}

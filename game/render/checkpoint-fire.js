import * as THREE from 'three';
import {CHECKPOINT_GROUND_Y} from './checkpoint-vignettes.js';

const states=new WeakMap(),noPick=()=>{};
export function createCheckpointFire(){
  const root=new THREE.Group();root.name='Checkpoint cooking fire';root.userData.checkpointPart='fire';
  const flameGeometry=new THREE.ConeGeometry(1,1,5);flameGeometry.translate(0,.5,0);
  const orange=new THREE.MeshStandardMaterial({color:'#ed762d',emissive:'#ef6326',emissiveIntensity:1.4,transparent:true,opacity:.88,depthWrite:false,roughness:1,flatShading:true});
  const yellow=new THREE.MeshStandardMaterial({color:'#ffe6a0',emissive:'#ffc55e',emissiveIntensity:1.8,transparent:true,opacity:.93,depthWrite:false,roughness:1,flatShading:true});
  const flames=[];
  for(const [i,[dx,dz,width,height]] of [[-.025,.006,.050,.185],[.023,-.012,.043,.21],[0,.012,.029,.16]].entries()){
    const mesh=new THREE.Mesh(flameGeometry,i===2?yellow:orange);root.add(mesh);flames.push({mesh,dx,dz,width,height,phase:i*2.1});
  }
  const coalGeometry=new THREE.IcosahedronGeometry(1,0),coal=new THREE.Mesh(coalGeometry,orange);coal.position.set(-.27,CHECKPOINT_GROUND_Y+.035,-.12);coal.scale.set(.066,.015,.058);root.add(coal);
  const emberGeometry=new THREE.IcosahedronGeometry(.007,0),emberMaterial=new THREE.MeshBasicMaterial({color:'#ffd071',transparent:true,opacity:.78,depthWrite:false,blending:THREE.AdditiveBlending});
  const embers=new THREE.InstancedMesh(emberGeometry,emberMaterial,8);embers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);embers.frustumCulled=false;root.add(embers);
  const state={root,flames,orange,yellow,embers,matrix:new THREE.Matrix4(),color:new THREE.Color(),geometries:[flameGeometry,coalGeometry,emberGeometry],materials:[orange,yellow,emberMaterial]};states.set(root,state);
  root.traverse(node=>{node.raycast=noPick;node.userData.checkpointEffect='fire';});animateCheckpointEffects(root,0);return root;
}

// Absolute cosmetic time is independent of combat pause/speed. Reduced motion
// restores a steady flame and hides rising sparks, without replacing resources.
export function animateCheckpointEffects(group,time,{reducedMotion=false}={}){
  if(!group?.visible||!Number.isFinite(time))return;
  const t=reducedMotion?0:Math.max(0,time);
  group.traverse(node=>{
    const state=states.get(node);if(!state)return;
    for(const {mesh,dx,dz,width,height,phase} of state.flames){
      const flicker=.93+.13*Math.sin(t*8.3+phase)+.07*Math.sin(t*13.7+phase*.6);
      mesh.position.set(-.27+dx,CHECKPOINT_GROUND_Y+.035,-.12+dz);mesh.scale.set(width*(1+.08*Math.sin(t*6.1+phase)),height*flicker,width);
      mesh.rotation.set(.06*Math.sin(t*5.7+phase),phase,.12*Math.sin(t*7.1+phase));
    }
    state.orange.emissiveIntensity=1.35+.22*Math.sin(t*10.3);state.yellow.emissiveIntensity=1.8+.2*Math.sin(t*8.7+.9);state.embers.visible=!reducedMotion;
    for(let i=0;i<state.embers.count;i++){
      const age=(t*.58+i*.137)%1,angle=i*2.4+t*.6,size=.5+Math.sin(age*Math.PI)*.55;
      state.matrix.makeScale(size,size,size);state.matrix.setPosition(-.27+Math.sin(angle)*(.018+age*.037),CHECKPOINT_GROUND_Y+.06+age*.39,-.12+Math.cos(angle)*(.018+age*.037));state.embers.setMatrixAt(i,state.matrix);
      state.color.setRGB(1,.42+.28*(1-age),.10).multiplyScalar(Math.sin(age*Math.PI));state.embers.setColorAt(i,state.color);
    }
    state.embers.instanceMatrix.needsUpdate=true;state.embers.instanceColor.needsUpdate=true;
  });
}

export function disposeCheckpointEffects(group){
  if(!group)return;const fires=[];group.traverse(node=>{if(states.has(node))fires.push(node);});
  for(const fire of fires){const state=states.get(fire);for(const geometry of state.geometries)geometry.dispose();for(const material of state.materials)material.dispose();state.embers.dispose();states.delete(fire);fire.clear();fire.removeFromParent();}
  group.removeFromParent();
}

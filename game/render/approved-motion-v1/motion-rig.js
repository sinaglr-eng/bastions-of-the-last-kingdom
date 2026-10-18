// Motion-only working hierarchy. Approved source geometry remains immutable.
export function createRig(THREE,scene){
  scene.updateMatrixWorld(true);
  const nodes=new Map();scene.traverse(node=>{if(node.isMesh)nodes.set(node.name,node)});
  const joints=new Map(),deformers=[];
  const vector=value=>value?.isVector3?value.clone():new THREE.Vector3(...value);
  function bounds(names){
    scene.updateMatrixWorld(true);const box=new THREE.Box3(),inverse=scene.matrixWorld.clone().invert();
    for(const name of names){const node=typeof name==='string'?nodes.get(name):name;if(!node)throw new Error('Missing motion part: '+name);node.geometry.computeBoundingBox();const b=node.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld));box.union(b)}
    return box;
  }
  function joint(key,{names=[],pivot,parent}={}){
    if(joints.has(key))throw new Error('Duplicate motion joint: '+key);
    const group=new THREE.Group();group.name='Motion_'+key;scene.add(group);group.position.copy(vector(pivot||bounds(names).getCenter(new THREE.Vector3())));scene.updateMatrixWorld(true);
    if(parent){const p=joints.get(parent);if(!p)throw new Error('Missing parent motion joint: '+parent);p.node.attach(group)}
    for(const name of names){const node=typeof name==='string'?nodes.get(name):name;if(!node)throw new Error('Missing motion part: '+name);group.attach(node)}
    joints.set(key,{node:group,position:group.position.clone(),quaternion:group.quaternion.clone(),scale:group.scale.clone()});return group;
  }
  function deformer(key,names){
    scene.updateMatrixWorld(true);const sceneInverse=scene.matrixWorld.clone().invert();
    const meshes=names.map(name=>{
      const node=typeof name==='string'?nodes.get(name):name;if(!node)throw new Error('Missing deforming part: '+name);
      const sourceGeometry=node.geometry,geometry=sourceGeometry.clone();geometry.userData.motionOwned=true;node.geometry=geometry;
      const position=geometry.getAttribute('position'),rest=position.array.slice(),normal=geometry.getAttribute('normal'),restNormals=normal?.array.slice(),toScene=sceneInverse.clone().multiply(node.matrixWorld),fromScene=toScene.clone().invert();
      return {node,geometry,sourceGeometry,position,rest,normal,restNormals,toScene,fromScene};
    });
    const point=new THREE.Vector3();let dirty=false;
    const result={key,meshes,apply(fn){
      for(const mesh of meshes){for(let i=0;i<mesh.position.count;i++){point.fromArray(mesh.rest,i*3).applyMatrix4(mesh.toScene);fn(point,mesh.node.name,i);point.applyMatrix4(mesh.fromScene);mesh.position.setXYZ(i,point.x,point.y,point.z)}mesh.position.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere()}dirty=true;
    },reset(){if(!dirty)return;for(const mesh of meshes){mesh.position.array.set(mesh.rest);mesh.position.needsUpdate=true;if(mesh.normal&&mesh.restNormals){mesh.normal.array.set(mesh.restNormals);mesh.normal.needsUpdate=true}mesh.geometry.computeBoundingSphere()}dirty=false},dispose(){for(const mesh of meshes){mesh.node.geometry=mesh.sourceGeometry;mesh.geometry.dispose()}}};
    deformers.push(result);return result;
  }
  return {scene,nodes,joints,find(regex){return [...nodes.keys()].filter(name=>{regex.lastIndex=0;return regex.test(name)})},has(name){return nodes.has(name)},bounds,center(names){return bounds(names).getCenter(new THREE.Vector3())},joint,deformer,
    rotate(key,x=0,y=0,z=0){const j=joints.get(key);if(!j)throw new Error('Missing motion joint: '+key);j.node.quaternion.copy(j.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z)))},
    translate(key,x=0,y=0,z=0){const j=joints.get(key);if(!j)throw new Error('Missing motion joint: '+key);j.node.position.copy(j.position).add(new THREE.Vector3(x,y,z))},
    reset(){for(const j of joints.values()){j.node.position.copy(j.position);j.node.quaternion.copy(j.quaternion);j.node.scale.copy(j.scale)}for(const d of deformers)d.reset()},
    dispose(){for(const d of deformers)d.dispose()}
  };
}

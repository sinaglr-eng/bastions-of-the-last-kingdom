// The approved workshop implementation remains preserved in approved-motion-v1.
// This runtime adapter evaluates the same fields on private actor buffers while
// avoiding a restore immediately before every field overwrites those buffers.
export function createRig(THREE,scene){
  scene.updateMatrixWorld(true);
  const nodes=new Map();scene.traverse(node=>{if(node.isMesh)nodes.set(node.name,node);});
  const joints=new Map(),deformers=[],compatible=new WeakMap();
  const vector=value=>value?.isVector3?value.clone():new THREE.Vector3(...value);
  const deltaEuler=new THREE.Euler(),deltaQuaternion=new THREE.Quaternion(),deltaPosition=new THREE.Vector3();
  let evaluating=false,poseRevision=0;
  function bounds(names){
    scene.updateMatrixWorld(true);const box=new THREE.Box3(),inverse=scene.matrixWorld.clone().invert();
    for(const name of names){const node=typeof name==='string'?nodes.get(name):name;if(!node)throw new Error('Missing motion part: '+name);node.geometry.computeBoundingBox();box.union(node.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld)));}
    return box;
  }
  function joint(key,{names=[],pivot,parent}={}){
    if(joints.has(key))throw new Error('Duplicate motion joint: '+key);
    const group=new THREE.Group();group.name='Motion_'+key;scene.add(group);group.position.copy(vector(pivot||bounds(names).getCenter(new THREE.Vector3())));scene.updateMatrixWorld(true);
    if(parent){const p=joints.get(parent);if(!p)throw new Error('Missing parent motion joint: '+parent);p.node.attach(group);}
    for(const name of names){const node=typeof name==='string'?nodes.get(name):name;if(!node)throw new Error('Missing motion part: '+name);group.attach(node);}
    joints.set(key,{node:group,position:group.position.clone(),quaternion:group.quaternion.clone(),scale:group.scale.clone()});return group;
  }
  function deformer(key,names){
    scene.updateMatrixWorld(true);const sceneInverse=scene.matrixWorld.clone().invert();
    const meshes=names.map(name=>{
      const node=typeof name==='string'?nodes.get(name):name;if(!node)throw new Error('Missing deforming part: '+name);
      const sourceGeometry=node.geometry,geometry=sourceGeometry.clone();geometry.userData.motionOwned=true;node.geometry=geometry;
      const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
      // Cached authoring buffers are immutable and live as long as this actor.
      // An overlapping runtime field still needs a private captured rest pose.
      const rest=sourceGeometry.userData.motionOwned?position.array.slice():sourceGeometry.getAttribute('position').array;
      const restNormals=sourceGeometry.userData.motionOwned?normal?.array.slice():sourceGeometry.getAttribute('normal')?.array;
      const toScene=sceneInverse.clone().multiply(node.matrixWorld),fromScene=toScene.clone().invert();
      if(!geometry.boundingBox)geometry.computeBoundingBox();if(!geometry.boundingSphere)geometry.computeBoundingSphere();
      return {node,geometry,sourceGeometry,position,rest,normal,restNormals,toScene,fromScene,
        restBox:geometry.boundingBox.clone(),restSphere:geometry.boundingSphere.clone(),normalEvaluated:false};
    });
    const point=new THREE.Vector3();let dirty=false,pendingReset=false;
    const result={key,meshes,get dirty(){return dirty;},apply(fn){
      pendingReset=false;poseRevision++;
      for(const mesh of meshes){
        const {position,geometry}=mesh;let changed=false,minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
        for(let i=0;i<position.count;i++){
          point.fromArray(mesh.rest,i*3).applyMatrix4(mesh.toScene);fn(point,mesh.node.name,i);point.applyMatrix4(mesh.fromScene);
          const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
          position.setXYZ(i,point.x,point.y,point.z);
          const nx=position.getX(i),ny=position.getY(i),nz=position.getZ(i);
          if(nx!==x||ny!==y||nz!==z)changed=true;
          minX=Math.min(minX,nx);minY=Math.min(minY,ny);minZ=Math.min(minZ,nz);maxX=Math.max(maxX,nx);maxY=Math.max(maxY,ny);maxZ=Math.max(maxZ,nz);
        }
        if(changed)position.needsUpdate=true;
        // Identical positions produce identical recomputed normals. The first
        // evaluation still runs, preserving the workshop's authored-rest reset.
        if(changed||!mesh.normalEvaluated){geometry.computeVertexNormals();mesh.normalEvaluated=true;}
        if(changed){
          geometry.boundingBox.min.set(minX,minY,minZ);geometry.boundingBox.max.set(maxX,maxY,maxZ);
          geometry.boundingBox.getCenter(geometry.boundingSphere.center);
          // A conservative box sphere uses bounds already collected above;
          // it changes no vertex, shading, contact or precise picking result.
          geometry.boundingSphere.radius=Math.hypot(maxX-minX,maxY-minY,maxZ-minZ)*.5;
        }
      }
      dirty=true;
    },reset(){
      pendingReset=false;if(!dirty)return;poseRevision++;
      for(const mesh of meshes){
        mesh.position.array.set(mesh.rest);mesh.position.needsUpdate=true;
        if(mesh.normal&&mesh.restNormals){mesh.normal.array.set(mesh.restNormals);mesh.normal.needsUpdate=true;}
        mesh.geometry.boundingBox.copy(mesh.restBox);mesh.geometry.boundingSphere.copy(mesh.restSphere);mesh.normalEvaluated=false;
      }
      dirty=false;
    },queueReset(){pendingReset=true;},finish(){if(pendingReset)result.reset();},
    copyFrom(other){
      pendingReset=false;dirty=other.dirty;poseRevision++;
      for(let i=0;i<meshes.length;i++){
        const mesh=meshes[i],source=other.meshes[i];
        mesh.position.array.set(source.position.array);mesh.position.needsUpdate=true;
        if(mesh.normal&&source.normal){mesh.normal.array.set(source.normal.array);mesh.normal.needsUpdate=true;}
        mesh.geometry.boundingBox.copy(source.geometry.boundingBox);mesh.geometry.boundingSphere.copy(source.geometry.boundingSphere);mesh.normalEvaluated=source.normalEvaluated;
      }
    },
    dispose(){for(const mesh of meshes){mesh.node.geometry=mesh.sourceGeometry;mesh.geometry.dispose();}}};
    deformers.push(result);return result;
  }
  const rig={scene,nodes,joints,deformers,evaluations:0,copies:0,get poseRevision(){return poseRevision;},find(regex){return [...nodes.keys()].filter(name=>{regex.lastIndex=0;return regex.test(name);});},has(name){return nodes.has(name);},bounds,center(names){return bounds(names).getCenter(new THREE.Vector3());},joint,deformer,
    rotate(key,x=0,y=0,z=0){const j=joints.get(key);if(!j)throw new Error('Missing motion joint: '+key);poseRevision++;j.node.quaternion.copy(j.quaternion).multiply(deltaQuaternion.setFromEuler(deltaEuler.set(x,y,z)));},
    translate(key,x=0,y=0,z=0){const j=joints.get(key);if(!j)throw new Error('Missing motion joint: '+key);poseRevision++;j.node.position.copy(j.position).add(deltaPosition.set(x,y,z));},
    beginUpdate(){if(evaluating)throw new Error('Nested motion evaluation');evaluating=true;},
    endUpdate(){for(const d of deformers)d.finish();evaluating=false;poseRevision++;rig.evaluations++;},
    copyPoseFrom(other){
      if(!other||other===rig)return false;
      if(!compatible.has(other)){
        let equal=deformers.length===other.deformers.length&&joints.size===other.joints.size;
        if(equal)for(const [key,j]of joints){const source=other.joints.get(key);if(!source||!j.position.equals(source.position)||!j.quaternion.equals(source.quaternion)||!j.scale.equals(source.scale)){equal=false;break;}}
        if(equal)for(let i=0;i<deformers.length;i++){
          const target=deformers[i],source=other.deformers[i];if(target.key!==source.key||target.meshes.length!==source.meshes.length){equal=false;break;}
          for(let k=0;k<target.meshes.length;k++){const a=target.meshes[k],b=source.meshes[k];if(a.node.name!==b.node.name||a.sourceGeometry!==b.sourceGeometry||!a.toScene.equals(b.toScene)||!a.fromScene.equals(b.fromScene)){equal=false;break;}}
          if(!equal)break;
        }
        compatible.set(other,equal);
      }
      if(!compatible.get(other))return false;
      for(const [key,j]of joints){const source=other.joints.get(key).node;j.node.position.copy(source.position);j.node.quaternion.copy(source.quaternion);j.node.scale.copy(source.scale);}
      for(let i=0;i<deformers.length;i++)deformers[i].copyFrom(other.deformers[i]);
      for(const [name,node]of nodes){const source=other.nodes.get(name);if(source)node.visible=source.visible;}
      poseRevision++;rig.copies++;return true;
    },
    reset(){poseRevision++;for(const j of joints.values()){j.node.position.copy(j.position);j.node.quaternion.copy(j.quaternion);j.node.scale.copy(j.scale);}for(const d of deformers)if(evaluating)d.queueReset();else d.reset();},
    dispose(){for(const d of deformers)d.dispose();}
  };return rig;
}

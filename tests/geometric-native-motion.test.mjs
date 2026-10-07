import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as THREE from 'three';
import {auditGeometricRuntime} from '../tools/verify-geometric-runtime.mjs';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {partMeshes} from '../tools/audit-geometric-appearance.mjs';
import {currentReconstructionEntry,auditCurrentReconstructionIds} from '../tools/audit-reconstructed-roster.mjs';

// Exercise the production files, not substitute boxes bearing the same joint
// names. Animated instances must preserve authored geometry and their peers.
for(const [folder,expected] of [['defenders',48],['champions',38],['enemies',50]]){
  test(`all ${expected} actual ${folder} GLBs ${folder==='enemies'?'articulate and settle on terrain':'preserve native source surfaces and execute supported runtime attacks'}`,async()=>{
    const directory=resolve('public/assets/geometric',folder);
    const files=readdirSync(directory).filter(file=>file.endsWith('.glb')).sort();
    assert.equal(files.length,expected,'production roster is complete');
    for(const file of files){
      if(folder!=='enemies'&&currentReconstructionEntry(file.replace(/\.glb$/,''))){
        const [result]=await auditCurrentReconstructionIds([file.replace(/\.glb$/,'')]);
        assert.deepEqual(result.failures,[],file+' actual raw-source/adaptation/runtime verification');
        assert.ok(result.maximumPhysicalTravel>1e-5,file+' actual approved mesh vertices move');
        assert.ok(result.checks.length>=50,file+' nonempty surface, attack and lifecycle checks');
        continue;
      }
      const result=await auditGeometricRuntime(resolve(directory,file));
      const failures=result.checks.filter(check=>!check.pass);
      assert.deepEqual(failures,[],`${file}: ${JSON.stringify(failures)}`);
    }
  });
}

test('the actual Hollow Sky King dark eye sockets are exposed on the front skull surface during head motion',async()=>{
  const bytes=readFileSync('public/assets/geometric/enemies/host_40.glb'),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),head=gltf.scene.getObjectByName('head_pivot');
  assert.ok(head);
  // Inspect both actual recessed V6 eye interiors, retaining the historical
  // socket selector for earlier geometry. Counts alone do not prove exposure.
  const sockets=partMeshes(head,/^(?:Sky king skull deep rectangular eye socket|V6 Hollow King actual deep open eye interior [LR])$/);
  assert.equal(sockets.length,2,'the source skull carries two dark eye sockets');
  for(const pose of [[0,0,0],[.24,.32,.08]]){
    head.rotation.set(...pose);gltf.scene.updateMatrixWorld(true);
    for(const socket of sockets){
      const centre=new THREE.Box3().setFromObject(socket,true).getCenter(new THREE.Vector3()),local=head.worldToLocal(centre.clone()),origin=head.localToWorld(local.clone().add(new THREE.Vector3(0,0,-3))),direction=centre.clone().sub(origin).normalize(),hit=new THREE.Raycaster(origin,direction).intersectObject(head,true)[0];
      assert.equal(hit?.object,socket,`${socket.name} must be visible from the skull front rather than buried inside opaque ivory geometry`);
    }
  }
  disposeDecodedGeometricAsset(gltf);
});

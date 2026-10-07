import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {prepareReconstructedDefender} from '../game/render/reconstruction-adapter.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {auditReconstructedRoster,currentReconstructionEntry,captureReconstructionSurface,compareReconstructionSurfaces} from '../tools/audit-reconstructed-roster.mjs';

test('all 86 approved V7/V8 exports preserve actual surfaces and execute compatible isolated runtime attacks',async()=>{
  const report=await auditReconstructedRoster({output:null,quiet:true});
  assert.equal(report.models,86);
  assert.equal(report.failures,0,JSON.stringify(report.results.filter(result=>result.failures.length).map(result=>({id:result.id,failures:result.failures})),null,2));
  assert.ok(report.results.every(result=>result.maximumMuzzleTravel>1e-5));
  assert.ok(report.results.every(result=>result.checks.length>=30));
});

test('an actually displaced approved head or changed rendered PBR surface fails rest preservation despite unchanged metadata',async()=>{
  const entry=currentReconstructionEntry('soldier-1'),bytes=readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url)),gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  try{
    const expected=captureReconstructionSurface(gltf.scene);prepareReconstructedDefender(gltf.scene,entry);
    assert.equal(compareReconstructionSurfaces(expected,captureReconstructionSurface(gltf.scene)).passed,true);
    const head=gltf.scene.getObjectByName('head_pivot'),declarations=JSON.stringify(head.userData),position=head.position.clone();head.position.x+=.15;
    assert.equal(compareReconstructionSurfaces(expected,captureReconstructionSurface(gltf.scene)).passed,false);
    assert.equal(JSON.stringify(head.userData),declarations);head.position.copy(position);
    let physical;head.traverse(node=>{if(!physical&&node.isMesh)physical=node;});assert.ok(physical,'the diagnostic moves real source mesh descendants');
    const nativeMaterial=physical.material,changed=nativeMaterial.clone();physical.material=changed;changed.color.setRGB(.07,.09,.11);
    assert.equal(compareReconstructionSurfaces(expected,captureReconstructionSurface(gltf.scene)).passed,false);
    physical.material=nativeMaterial;changed.dispose();assert.equal(compareReconstructionSurfaces(expected,captureReconstructionSurface(gltf.scene)).passed,true);
  }finally{disposeDecodedGeometricAsset(gltf);}
});

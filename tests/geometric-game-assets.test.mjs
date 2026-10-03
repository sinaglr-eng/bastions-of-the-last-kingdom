import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {geometricEntries} from '../game/render/geometric-assets.js';
import {geometricMetadata} from '../game/render/geometric-motion.js';
import {campaignTowers} from '../game/core/campaign-roster.js';
const root=new URL('../public/assets/geometric/',import.meta.url);
const rosters=['defenders','champions','enemies'].map(kind=>geometricEntries(JSON.parse(readFileSync(new URL(`geometric-${kind}.json`,root)))));
const entries=rosters.flat(),towers=campaignTowers(JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url))));
const sources=JSON.parse(readFileSync(new URL('source-manifest.json',root)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the current geometric edition covers every approved subject: 48 basic ranks, 38 champions and 50 enemies',()=>{
  assert.deepEqual(rosters.map(r=>r.length),[48,38,50]);
  assert.equal(new Set(entries.map(e=>e.id)).size,136);
  assert.equal(new Set(entries.map(e=>e.file)).size,136);
  assert.deepEqual(new Set(entries.map(e=>e.id)),new Set(sources.map(e=>e.id)));
  for(const [family,stats] of Object.entries(towers))for(let tier=1;tier<=(stats.advanced?1:6);tier++)assert.equal(entries.filter(e=>e.kind==='tower'&&e.family===family&&e.tier===tier).length,1,`${family} ${tier}`);
  assert.ok(!entries.some(e=>e.family==='lordbernhard'));
  assert.ok(entries.some(e=>e.id==='host_50'));
});

test('actual Three.js imports preserve finite closed model geometry, source provenance and articulated hierarchy for all 136 assets',async()=>{
  const signatures=new Set();
  for(const entry of entries){
    const bytes=readFileSync(new URL(entry.file,root)),qa=entry.metrics||entry.qa;
    assert.equal(bytes.toString('ascii',0,4),'glTF',entry.id);
    assert.equal(bytes.readUInt32LE(8),bytes.length,entry.id);
    assert.equal(hash(bytes),qa.fileSha256,entry.id+' immutable export');
    assert.equal(qa.degenerateTriangles,0,entry.id);
    assert.equal(qa.nonManifoldEdges,0,entry.id);
    assert.ok(qa.roundtripBoundsError<1e-5,entry.id);
    const coverage=qa.headCoverage||qa.coverage;
    assert.ok(coverage,entry.id+' recorded head coverage');
    const checks=(Array.isArray(coverage)?coverage:[coverage]).filter(check=>Object.hasOwn(check,'passed'));
    for(const check of checks)assert.equal(check.passed,true,entry.id+' head coverage');
    assert.equal(entry.sourceSha256,sources.find(e=>e.id===entry.id).sha256,entry.id);
    assert.ok(existsSync(new URL(entry.portrait,root)),entry.id+' portrait');
    const portrait=readFileSync(new URL(entry.portrait,root));
    assert.equal(portrait.subarray(0,8).toString('hex'),'89504e470d0a1a0a',entry.id+' actual PNG portrait');
    assert.ok(portrait.readUInt32BE(16)>=256&&portrait.readUInt32BE(20)>=256,entry.id+' portrait resolution');
    const views=entry.views||qa.views;
    assert.deepEqual(new Set(views.map(view=>view.view)),new Set(['front','back','left','right','three-quarter-front','three-quarter-back']),entry.id+' six actual cameras');
    assert.ok(views.every(view=>view.geometrySha256===qa.geometrySha256),entry.id+' one physical geometry for every view');
    const {scene}=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    scene.updateMatrixWorld(true);
    let protectedCover=false;scene.traverse(node=>{if(node.isMesh&&/Continuous_wrapped_hood|Thick_pointed_hood|Helmet_/i.test(node.name))protectedCover=true;});
    if(protectedCover)assert.ok(checks.length,entry.id+' protected covering has an actual coverage check');
    const meta=geometricMetadata(scene);assert.ok(meta,entry.id+' exported motion metadata');
    assert.equal(meta.locomotion,entry.locomotion,entry.id);
    assert.equal(meta.attackStyle,entry.attackStyle,entry.id);
    assert.equal(meta.sourceSha256||meta.referenceSha256,entry.sourceSha256,entry.id);
    let count=0;const geometryHash=createHash('sha256');
    scene.traverse(node=>{
      if(!node.isMesh)return;
      for(const attribute of [node.geometry.attributes.position,node.geometry.attributes.normal]){
        assert.ok(attribute,entry.id+' position/normal');
        for(const value of attribute.array)assert.ok(Number.isFinite(value),entry.id);
      }
      const position=node.geometry.attributes.position,index=node.geometry.index;
      count+=(index?index.count:position.count)/3;
      // Include actual instance transforms: source primitives can have the
      // same local vertex array while forming different physical sculptures.
      const vertex=new THREE.Vector3(),worldVertices=new Int32Array(position.count*3);
      for(let i=0;i<position.count;i++){
        vertex.fromBufferAttribute(position,i).applyMatrix4(node.matrixWorld);
        worldVertices.set([Math.round(vertex.x*1e6),Math.round(vertex.y*1e6),Math.round(vertex.z*1e6)],i*3);
      }
      geometryHash.update(Buffer.from(worldVertices.buffer));
    });
    assert.equal(count,qa.triangles,entry.id+' imported triangle count');
    const box=new THREE.Box3().setFromObject(scene),size=box.getSize(new THREE.Vector3());
    assert.ok(size.x>0&&size.y>0&&size.z>0,entry.id+' bounds');
    assert.ok(Math.abs(box.min.y-qa.boundsMin[2])<1e-5,entry.id+' Y-up ground');
    if(entry.locomotion!=='flying')assert.ok(Math.abs(box.min.y)<.002,entry.id+' soles');
    signatures.add(geometryHash.digest('hex'));
  }
  assert.equal(signatures.size,136,'each rank/subject has distinct physical geometry');
});

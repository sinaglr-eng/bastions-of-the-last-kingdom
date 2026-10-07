import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {prepareReconstructedDefender} from '../game/render/reconstruction-adapter.js';
import {optimizeGeometricSiblings} from '../game/render/geometric-batching.js';
import {attackRig,attackMuzzle,previewGeometricAttack,updateGeometricPreview,resetAttack,disposeAttack} from '../game/render/battle-animation.js';
import {cloneDefenderTemplate} from '../game/render/defender-assets.js';
import {atelierRankColors,atelierRankEquipment,galleryEnemyProperties,approvedCharacterName} from '../game/render/atelier-copy.js';

const entries=['defenders','champions'].flatMap(category=>JSON.parse(fs.readFileSync(new URL('../public/assets/geometric/geometric-'+category+'.json',import.meta.url))).entries);
async function load(id,{batch=false}={}){
 const entry=entries.find(row=>row.id===id),bytes=fs.readFileSync(new URL('../public/assets/geometric/'+entry.file,import.meta.url));
 const decoded=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 prepareReconstructedDefender(decoded.scene,entry);if(batch)optimizeGeometricSiblings(decoded.scene);return {entry,scene:decoded.scene};
}
function meshes(root,pattern){const result=[];root.traverse(node=>{if(node.isMesh&&pattern.test(node.userData.semanticPart||''))result.push(node);});return result;}
function parentOf(node,name){for(let p=node;p;p=p.parent)if(p.name===name)return true;return false;}
function position(node){node.updateWorldMatrix(true,false);return node.getWorldPosition(new THREE.Vector3());}
function vertex(node){node.updateWorldMatrix(true,false);return node.getVertexPosition(0,new THREE.Vector3()).applyMatrix4(node.matrixWorld);}

test('V8 leaf blades and boot cuffs remain clothing; eyes, hood and skull share head',async()=>{
 const {scene}=await load('thornwarden');
 const leaves=meshes(scene,/shoulder collar.*blade/i),cuffs=meshes(scene,/boot layered cuff/i),head=meshes(scene,/pointed elf ear|rectangular visible eye|^hood\b|^head\b/i);
 assert.ok(leaves.length>=20);assert.equal(new Set(cuffs.map(mesh=>mesh.userData.semanticPart)).size,2);assert.ok(head.length>=6);
 for(const mesh of leaves)assert.ok(parentOf(mesh,'torso_pivot'),mesh.userData.semanticPart);
 for(const mesh of cuffs)assert.ok(parentOf(mesh,'torso_pivot'),mesh.userData.semanticPart);
 for(const mesh of head)assert.ok(parentOf(mesh,'head_pivot'),mesh.userData.semanticPart);
});

for(const id of ['archer-6','thornwarden','royalranger'])test(id+' keeps approved rest rope and retracts real shooting-plane nock',async()=>{
 const {entry,scene}=await load(id,{batch:true}),actor=cloneDefenderTemplate(scene),rig=attackRig(actor,entry.family);
 assert.ok(rig.string?.keepAuthoredAtRest);assert.ok(rig.authoredStrings.some(row=>row.node.isMesh));
 assert.equal(rig.string.object.visible,false);for(const row of rig.authoredStrings)assert.equal(row.node.visible,row.visible);
 const top=position(actor.getObjectByName('bow_tip_upper')),bottom=position(actor.getObjectByName('bow_tip_lower')),nock=position(actor.getObjectByName('bow_nock'));
 assert.ok(top.y>bottom.y);assert.ok(Math.abs(top.x-bottom.x)<.02,'string endpoints lie in forward vertical plane');
 assert.ok(nock.z>=Math.min(top.z,bottom.z)-.01,'nock is behind the forward bow tips');
 assert.ok(attackMuzzle(rig).distanceTo(nock)<1e-8);
 previewGeometricAttack(rig);updateGeometricPreview(rig,.24);
 assert.equal(rig.string.object.visible,true);for(const row of rig.authoredStrings)assert.equal(row.node.visible,false);
 const release=position(actor.getObjectByName('bow_nock'));assert.ok(release.distanceTo(nock)>.005);
 assert.ok(attackMuzzle(rig).distanceTo(release)<1e-8);
 const buffer=rig.string.object.geometry.attributes.position;for(let i=0;i<buffer.count;i++)assert.ok(Number.isFinite(buffer.getZ(i)));
 resetAttack(rig);assert.equal(rig.string.object.visible,false);assert.ok(position(actor.getObjectByName('bow_nock')).distanceTo(nock)<1e-8);
 for(const row of rig.authoredStrings)assert.equal(row.node.visible,row.visible);disposeAttack(rig);
});

test('approved Rimewatch two-palm greatsword grip stays rigid through conservative attack',async()=>{
 const {entry,scene}=await load('rimewatch'),rig=attackRig(scene,entry.family);
 const hands=['R','L'].map(s=>meshes(scene,new RegExp('Watchman '+(s==='R'?'RIGHT':'LEFT')+'.*fitted palm','i'))[0]);
 const hilt=meshes(scene,/greatsword.*coherent shaped hilt/i)[0];assert.ok(hilt&&hands.every(Boolean));
 const rest=hands.map(hand=>vertex(hand).distanceTo(vertex(hilt))),origin=vertex(hilt);previewGeometricAttack(rig);
 for(const dt of [.08,.16,.18,.28]){updateGeometricPreview(rig,dt);for(let i=0;i<2;i++)assert.ok(Math.abs(vertex(hands[i]).distanceTo(vertex(hilt))-rest[i])<1e-8,'two-palm/hilt separation changed');}
 assert.ok(vertex(hilt).distanceTo(origin)>.001);resetAttack(rig);assert.ok(vertex(hilt).distanceTo(origin)<1e-8);disposeAttack(rig);
});

test('Nature Spirit animates actual energy-core volume and attached muzzle, without fake hand weapon',async()=>{
 const {entry,scene}=await load('rangermentor'),rig=attackRig(scene,entry.family),core=meshes(scene,/faceted green energy core/i)[0];
 assert.equal(entry.reconstruction.role,'spirit');assert.equal(entry.reconstruction.presentationScale,1);assert.equal(rig.attackStyle,'focus');assert.ok(core);
 const rest=vertex(core),muzzle=attackMuzzle(rig);previewGeometricAttack(rig);updateGeometricPreview(rig,.22);
 assert.ok(vertex(core).distanceTo(rest)>.001);assert.ok(attackMuzzle(rig).distanceTo(muzzle)>.001);
 assert.ok(parentOf(rig.muzzle,'torso_pivot'));resetAttack(rig);assert.ok(vertex(core).distanceTo(rest)<1e-8);disposeAttack(rig);
});

test('English gallery includes current source links, preparation boundary and translated enemy properties',()=>{
 const gallery=fs.readFileSync(new URL('../game/archer-preview.js',import.meta.url),'utf8');
 assert.doesNotMatch(gallery,/[ěščřžýáíéůúťďň]/i);assert.match(gallery,/prepareReconstructedDefender\(decoded\.scene,entry\);optimizeGeometricSiblings/);
 assert.match(gallery,/source\.publicPath\|\|/);assert.match(gallery,/The model could not be loaded\. Choose another character or reload the page\./);
 assert.deepEqual(atelierRankColors,['Blue','Green','Purple','Ivory','Gold','Radiance']);
 assert.equal(approvedCharacterName(entries.find(e=>e.id==='rangermentor'),'Bearking'),'Nature Spirit');
 assert.equal(approvedCharacterName(entries.find(e=>e.id==='mothernature'),'Nature Spirit'),'Mother Nature');
 assert.equal(approvedCharacterName(entries.find(e=>e.id==='runebreaker-1'),'Engineer'),'Engineer');
 for(const family of Object.values(atelierRankEquipment)){assert.equal(family.length,6);assert.ok(family.every(value=>!/[ěščřžýáíéůúťďň]/i.test(value)));}
 assert.deepEqual(galleryEnemyProperties({regen:true,cloaked:true,magicImmune:true,evasion:.15,resists:{fire:.5}}),['fire: 50%','Regeneration','Cloaking','Magic immunity','Evasion: 15%']);
});

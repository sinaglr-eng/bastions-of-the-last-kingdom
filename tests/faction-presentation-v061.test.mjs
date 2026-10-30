import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {installDefenderTemplate,cloneDefenderTemplate} from '../game/render/defender-assets.js';
import {applyDefenderClassificationScale,defenderPresentationMultiplier,DWARF_BATTLEFIELD_PRESENTATION_SCALE} from '../game/render/defender-classification-scale.js';
import {FACTIONS} from '../game/core/factions.js';
const registry=JSON.parse(fs.readFileSync(new URL('../data/factions-v060.json',import.meta.url)));
async function actorFor(faction,family){const entry=registry.factions.find(f=>f.id===faction).assets.find(a=>a.family===family&&a.tier===1),b=gunzipSync(fs.readFileSync(new URL('../public/'+entry.packedFile,import.meta.url))),g=await new NativeTestGLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');installDefenderTemplate({imported:new Map(),game:{towers:[]}}, {...entry,factionId:faction},g.scene,g.animations);return cloneDefenderTemplate(g.scene);}
function height(a){a.updateMatrixWorld(true);return new THREE.Box3().setFromObject(a).getSize(new THREE.Vector3()).y;}
test('Dwarf size adjustment uses actual selected-faction metadata and remains idempotent',async()=>{const dwarf=await actorFor('forge','dw_shieldguard'),human=await actorFor('crown','soldier'),elf=await actorFor('grove','el_moonblade'),before=height(dwarf),h=height(human),e=height(elf);assert.equal(dwarf.userData.factionAttackEntry.factionId,'forge');applyDefenderClassificationScale(dwarf,'dw_shieldguard');assert.ok(Math.abs(height(dwarf)/before-1.75)<1e-5);assert.ok(height(dwarf)>h*.9&&height(dwarf)<e*1.25);const s=dwarf.scale.clone();applyDefenderClassificationScale(dwarf,'dw_shieldguard');assert.deepEqual(dwarf.scale,s);applyDefenderClassificationScale(human,'soldier');applyDefenderClassificationScale(elf,'el_moonblade');assert.equal(height(human),h);assert.equal(height(elf),e);});
test('Dwarf presentation never enlarges shared Lady Claire or legacy/non-Dwarf actors',()=>{assert.equal(DWARF_BATTLEFIELD_PRESENTATION_SCALE,1.75);assert.equal(defenderPresentationMultiplier('ladyclaire','forge'),1);assert.equal(defenderPresentationMultiplier('dw_shieldguard'),1);assert.equal(defenderPresentationMultiplier('soldier','crown'),1);assert.equal(defenderPresentationMultiplier('el_spark_adept','grove'),1);});
test('faction scene choices are distinct battle illustrations with explicit specializations',()=>{assert.deepEqual(FACTIONS.map(f=>f.specialty),['Versatile','Physical damage','Magical damage']);for(const f of FACTIONS){assert.ok(f.scene.startsWith('assets/ui/faction-scenes-v062/'));const b=fs.readFileSync(new URL('../public/'+f.scene,import.meta.url));assert.equal(b.readUInt32BE(16),f.sceneWidth);assert.equal(b.readUInt32BE(20),f.sceneHeight);assert.ok(f.sceneWidth/f.sceneHeight>1.7);}});

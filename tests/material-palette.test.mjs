import test from'node:test';import assert from'node:assert/strict';import * as THREE from'three';
import{materialPaletteKey,withPaletteColor,paletteMaterial}from'../game/render/material-palette.js';

test('diffuse palettes merge only identical non-color rendering parameters at full precision',()=>{
 const a=new THREE.MeshStandardMaterial({color:'#315f84',roughness:.371,metalness:.23}),b=a.clone();b.color.set('#d9aa43');assert.equal(materialPaletteKey(a),materialPaletteKey(b));
 for(const key of['roughness','metalness','emissiveIntensity','opacity','polygonOffsetFactor']){const c=b.clone();c[key]+=.0000001;assert.notEqual(materialPaletteKey(c),materialPaletteKey(a),key);}
 const c=b.clone();c.emissive.r+=1e-9;assert.notEqual(materialPaletteKey(a),materialPaletteKey(c),'Emissive color is not rounded to an 8-bit key');
 for(const changes of[{transparent:true},{vertexColors:true},{type:'MeshPhysicalMaterial'}])assert.equal(materialPaletteKey(Object.assign(b.clone(),changes)),null);
 const mapped=a.clone();mapped.map=new THREE.Texture();assert.equal(materialPaletteKey(mapped),materialPaletteKey(mapped.clone()),'The exact same texture and UV contract may be shared');const other=mapped.clone();other.map=mapped.map.clone();assert.equal(materialPaletteKey(mapped),materialPaletteKey(other),'Identical GLTFLoader texture clones retain the same decoded source');other.map.offset.x=.01;assert.notEqual(materialPaletteKey(mapped),materialPaletteKey(other),'Different UV transforms stay separate');other.map=mapped.map.clone();other.map.source=new THREE.Source();assert.notEqual(materialPaletteKey(mapped),materialPaletteKey(other),'Different decoded images stay separate');
 mapped.map.offset.set(.1,.2);const before=materialPaletteKey(mapped);mapped.map.updateMatrix();assert.equal(materialPaletteKey(mapped),before,'Renderer UV-matrix refresh never splits an otherwise identical sharing group');
});

test('palette geometry retains every original attribute/index byte and exact float32 diffuse colors without editing source',()=>{
 const original=new THREE.BoxGeometry(),before=original.attributes.position.array.slice(),material=new THREE.MeshStandardMaterial({color:new THREE.Color(.123456789,.456789123,.987654321),emissive:'#123456',roughness:.27}),copy=withPaletteColor(original,material.color),m=paletteMaterial(material);
 for(const[key,a]of Object.entries(original.attributes))assert.deepEqual(copy.attributes[key].array,a.array);assert.deepEqual(copy.index.array,original.index.array);assert.deepEqual(original.attributes.position.array,before);assert.equal(original.attributes.color,undefined);
 for(let i=0;i<copy.attributes.color.count;i++)assert.deepEqual([copy.attributes.color.getX(i),copy.attributes.color.getY(i),copy.attributes.color.getZ(i)],[material.color.r,material.color.g,material.color.b].map(Math.fround));
 assert.equal(m.vertexColors,true);assert.equal(m.color.getHex(),0xffffff);m.vertexColors=false;assert.equal(materialPaletteKey(m),materialPaletteKey(material));copy.dispose();m.dispose();original.dispose();material.dispose();
});

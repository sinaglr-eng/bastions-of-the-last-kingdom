import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import * as THREE from 'three';
import {TOWN_STREAM_CURVE,RIVER_CONTROL_POINTS} from '../game/render/valley-relief.js';
const layout=JSON.parse(readFileSync(new URL('../data/scenery-v6.json',import.meta.url),'utf8'));
layout.townStream.samples=TOWN_STREAM_CURVE.getPoints(480).map(p=>[p.x,p.y,p.z]);
layout.mainRiver={waterWidth:4.1,samples:new THREE.CatmullRomCurve3(RIVER_CONTROL_POINTS.map(([x,z])=>new THREE.Vector3(x,0,z))).getPoints(480).map(p=>[p.x,p.y,p.z])};
mkdirSync(new URL('../public/assets/scenery/',import.meta.url),{recursive:true});
writeFileSync(new URL('../public/assets/scenery/layout-v6.json',import.meta.url),JSON.stringify(layout,null,2)+'\n');
console.log('V6 shared scenery layout: sampled rivers, full western frontier and natural pastures.');

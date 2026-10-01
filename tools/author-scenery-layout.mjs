import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {TOWN_STREAM_CURVE} from '../game/render/valley-relief.js';
const layout=JSON.parse(readFileSync(new URL('../data/scenery-v5.json',import.meta.url),'utf8'));
layout.townStream.samples=TOWN_STREAM_CURVE.getPoints(480).map(p=>[p.x,p.y,p.z]);
mkdirSync(new URL('../public/assets/scenery/',import.meta.url),{recursive:true});
writeFileSync(new URL('../public/assets/scenery/layout-v5.json',import.meta.url),JSON.stringify(layout,null,2)+'\n');
console.log('V5 shared scenery layout: 481 actual CatmullRom stream samples.');

import {readFileSync,writeFileSync} from 'node:fs';
import {applyEnemyDesigns} from './enemy-designs.mjs';
const enemies=JSON.parse(readFileSync('data/enemies.json','utf8'));
const waves=JSON.parse(readFileSync('data/waves.json','utf8'));
applyEnemyDesigns(enemies,waves);
for(const [name,value]of Object.entries({enemies,waves}))writeFileSync(`data/${name}.json`,JSON.stringify(value,null,2)+'\n');
console.log('Applied approved names, visual assets and five cosmetic aura stages to all 50 waves.');

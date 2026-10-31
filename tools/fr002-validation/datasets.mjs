import fs from 'node:fs';
import {createFactionData} from '../../game/core/factions.js';
import {applyFr002Registry} from '../../game/core/fr002-registry.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../../game/core/campaign-roster.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url)));
export function loadFr002Datasets({baseline=false}={}){
 const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(k=>[k,read('data/'+k+'.json')])),current={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)},original=read('data/factions-v060.json'),registry=baseline?original:applyFr002Registry(original);
 return Object.fromEntries(registry.factions.map(f=>[f.id,createFactionData(current,registry,f.id)]));
}

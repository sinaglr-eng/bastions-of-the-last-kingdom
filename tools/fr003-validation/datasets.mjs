import fs from 'node:fs';
import {createFactionData} from '../../game/core/factions.js';
import {applyFr002Registry} from '../../game/core/fr002-registry.js';
import {applyFr003Registry} from '../../game/core/fr003-registry.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../../game/core/campaign-roster.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url)));
export function loadFr003Datasets({baseline=false}={}){
 const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(k=>[k,read('data/'+k+'.json')])),current={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)},fr002=applyFr002Registry(read('data/factions-v060.json')),registry=baseline?fr002:applyFr003Registry(fr002);
 return Object.fromEntries(registry.factions.map(f=>[f.id,createFactionData(current,registry,f.id)]));
}

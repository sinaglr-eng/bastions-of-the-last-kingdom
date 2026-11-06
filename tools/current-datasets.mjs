import fs from 'node:fs';
import {createFactionData} from '../game/core/factions.js';
import {applyFr002Registry} from '../game/core/fr002-registry.js';
import {applyFr003Registry} from '../game/core/fr003-registry.js';
import {applyFr004Registry} from '../game/core/fr004-registry.js';
import {applyFr006Fr007Registry} from '../game/core/fr006-fr007-registry.js';
import {applyFr005Registry} from '../game/core/fr005-registry.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
export function loadCurrentDatasets({revision='current'}={}){
 if(!['current','fr006r2','fr005','fr004','fr003','fr002'].includes(revision))throw Error('Unknown simulation ruleset');
 const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(k=>[k,read('data/'+k+'.json')])),current={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies,{fr006:['current','fr006r2'].includes(revision)}),waves:campaignWaves(raw.waves)};
 let registry=applyFr002Registry(read('data/factions-v060.json'));if(revision!=='fr002')registry=applyFr003Registry(registry);if(['current','fr006r2','fr005','fr004'].includes(revision))registry=applyFr004Registry(registry);if(['current','fr006r2','fr005'].includes(revision))registry=applyFr005Registry(registry);if(['current','fr006r2'].includes(revision))registry=applyFr006Fr007Registry(registry,{recipeRevision:revision==='fr006r2'?2:3});
 return Object.fromEntries(registry.factions.map(f=>[f.id,createFactionData(current,registry,f.id)]));
}

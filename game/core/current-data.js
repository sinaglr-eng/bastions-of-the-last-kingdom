import balance from '../../data/balance.json' with {type:'json'};
import towers from '../../data/towers.json' with {type:'json'};
import enemies from '../../data/enemies.json' with {type:'json'};
import waves from '../../data/waves.json' with {type:'json'};
import recipes from '../../data/recipes.json' with {type:'json'};
import registry from '../../data/factions-v060.json' with {type:'json'};
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from './campaign-roster.js';
import {createFactionData} from './factions.js';
import {applyFr002Registry} from './fr002-registry.js';
import {applyFr003Registry} from './fr003-registry.js';
import {applyFr004Registry} from './fr004-registry.js';
import {applyFr005Registry} from './fr005-registry.js';
import {applyFr006Fr007Registry} from './fr006-fr007-registry.js';
import {applyFr008Registry} from './fr008-registry.js';
import {applyRecruitSlots} from './recruit-slots.js';
export const FR010_RULESET='fr010-v1';
const approvedRegistry=applyFr008Registry(applyFr006Fr007Registry(applyFr005Registry(applyFr004Registry(applyFr003Registry(applyFr002Registry(registry))))));
const base={balance,towers:campaignTowers(towers),enemies:campaignEnemies(enemies),waves:campaignWaves(waves),recipes:campaignRecipes(recipes)};
const cache=new Map();
export function currentFactionData(id){
 if(!cache.has(id))cache.set(id,applyRecruitSlots({...createFactionData(base,approvedRegistry,id),fr010:true,rulesetRevision:FR010_RULESET}));
 return cache.get(id);
}

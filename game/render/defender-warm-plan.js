import {recipeFamily,recipeTier} from '../core/recipes.js';
import {defenderTemplateKey} from './defender-model-loader.js';

// Only already revealed board identities and public recipes participate.
// Never inspect latent draws or roll RNG to predict a future recruit.
export function defenderWarmPlan(game,{limit=2}={}){
  if(!['build','select','ready','reward'].includes(game.phase))return [];
  const definitions=game.data.towers,pool=game.towers.filter(t=>['active','draft'].includes(t.state)&&defenderTemplateKey(t,definitions)),counts=new Map(),ranked=new Map();
  for(const t of pool){const key=defenderTemplateKey(t,definitions);counts.set(key,(counts.get(key)||0)+1);}
  const add=(key,priority)=>{if(!counts.has(key))ranked.set(key,Math.max(priority,ranked.get(key)||0));};
  for(const recipe of game.recipes||[]){
    if(recipe.currentRoundOnly||recipe.level>game.economy.level)continue;
    const family=recipeFamily(recipe),tier=recipeTier(recipe);if(!definitions[family])continue;
    const used=new Map();let matched=0;
    for(const piece of recipe.ingredients){const key=piece.family+':'+piece.tier,n=used.get(key)||0;if(n<(counts.get(key)||0)){matched++;used.set(key,n+1);}}
    if(!matched)continue;
    const missing=recipe.ingredients.length-matched,selected=game.selection&&recipe.ingredients.some(i=>i.family===game.selection.family&&i.tier===game.selection.tier);
    add(family+':'+tier,(missing===0?10000:100*matched-10*missing)+(recipe.id===game.pinned?30:0)+(selected?5:0));
  }
  const fresh=pool.filter(t=>t.state==='draft'&&t.round===game.round&&!definitions[t.family].advanced);
  for(const t of fresh)if(t.tier<6&&fresh.some(o=>o!==t&&o.family===t.family&&o.tier===t.tier))add(t.family+':'+(t.tier+1),11000+(game.selection===t?5:0));
  return [...ranked].sort(([a,x],[b,y])=>y-x||a.localeCompare(b)).slice(0,Math.max(0,Math.min(3,limit))).map(([key])=>key);
}

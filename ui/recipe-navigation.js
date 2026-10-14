import {recipeFamily,recipeTier,rankLabel,recipeTreeProgress} from '../game/core/recipes.js';
import {defenderCode} from '../game/core/unit-label.js';

// Navigation belongs to the interface. It never changes selection, inventory,
// pinning, draw commitment, currency or the random stream.
export function recipeNavigationModel(state={}){
  const history=Array.isArray(state.history)?state.history.filter(id=>typeof id==='string'&&id):[];
  const index=history.length?Math.max(0,Math.min(history.length-1,Number.isInteger(state.index)?state.index:history.length-1)):-1;
  return {history,index,recipeId:history[index]||null,canBack:index>0,canForward:index>=0&&index<history.length-1};
}
export function recipeNavigationVisit(state,id){
  if(typeof id!=='string'||!id)return null;
  const navigation=recipeNavigationModel(state);
  if(navigation.recipeId===id)return id;
  state.history=[...navigation.history.slice(0,navigation.index+1),id];state.index=state.history.length-1;
  return id;
}
export function recipeNavigationStep(state,delta){
  const navigation=recipeNavigationModel(state),index=navigation.index+Math.sign(delta);
  if(!delta||index<0||index>=navigation.history.length)return null;
  state.history=navigation.history;state.index=index;return state.history[index];
}
// Catalog order is independent of exploration history. The caller supplies
// the current filtered rows in their existing recipe order; no wrapping or
// silent fallback occurs when an inspected component is outside that list.
export function recipeCatalogNavigation(recipes,recipeId){
  const ids=recipes.map(entry=>entry.recipe?.id||entry.id||entry),index=ids.indexOf(recipeId);
  return {index,count:ids.length,inCatalog:index>=0,previousId:index>0?ids[index-1]:null,nextId:index>=0&&index<ids.length-1?ids[index+1]:null};
}
// Engineer's player-facing initial is E. Its runtime family and canonical R
// identifier remain untouched; all other basic codes use defenderCode.
export function displayDefenderCode(stats,tier=1,{family}={}){
  if(stats.advanced)return null;
  return family==='runebreaker'||stats.unitCode==='R'?`E ${rankLabel(tier)}`:defenderCode(stats,tier);
}
export function recipeIngredientPresentation(piece,data){
  const stats=data.towers[piece.family],recipe=data.recipes.find(entry=>recipeFamily(entry)===piece.family&&recipeTier(entry)===piece.tier);
  return {name:stats.name,rank:rankLabel(piece.tier),code:displayDefenderCode(stats,piece.tier,{family:piece.family}),recipeId:stats.advanced?recipe?.id||null:null};
}
export function downstreamRecipes(recipe,data){
  if(!recipe)return [];
  return data.recipes.filter(entry=>entry.ingredients.some(piece=>piece.family===recipeFamily(recipe)&&piece.tier===recipeTier(recipe)));
}

// Retained ownership remains visible in combat/end inspection. Provisional
// stock comes only from a real, revealed draw belonging to this current round.
export function recipeDisplayInventory(game,recipe){
  if(!recipe)return [];
  const candidates=new Set();
  if(!game.draft.resolved&&['build','select'].includes(game.phase))for(const draw of game.draft.draws){
    if(!draw.placed||draw.reservedForNextDraft)continue;
    const tower=game.towers.find(t=>t.id===draw.towerId&&t.state==='draft'&&t.round===game.round&&t.placed!==false);
    if(tower)candidates.add(tower);
  }
  return game.towers.filter(t=>t.placed!==false&&(candidates.has(t)||t.state==='active'&&!recipe.currentRoundOnly));
}
export function missingBasicFrontier(tree,data){
  const totals=new Map();
  const visit=node=>{
    if(node.coveredBy||node.ownedCount||node.draftCount)return;
    if(node.children.length){node.children.forEach(visit);return;}
    if(data.towers[node.family].advanced)return;
    const key=`${node.family}:${node.tier}`,item=totals.get(key)||{family:node.family,tier:node.tier,count:0,...recipeIngredientPresentation(node,data)};
    item.count++;totals.set(key,item);
  };
  tree.forEach(visit);
  const items=[...totals.values()].map(item=>({...item,label:`${item.count===1?'':`${item.count}x `}${item.code}`}));
  return {items,total:items.reduce((sum,item)=>sum+item.count,0),summary:items.map(item=>item.label).join(', ')||'None'};
}
export function pinnedMissingBasicSummary(game,recipe=game.pinned){
  const target=game.recipes.find(entry=>entry.id===(typeof recipe==='object'?recipe?.id:recipe));
  return target?missingBasicFrontier(recipeTreeProgress(target,recipeDisplayInventory(game,target),game.data),game.data):{items:[],total:0,summary:'None'};
}

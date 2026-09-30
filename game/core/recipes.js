export const recipeFamily=recipe=>recipe.resultFamily||recipe.id;
export const recipeTier=recipe=>recipe.resultTier||1;
export function rankLabel(tier){
  const values=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let label='',remaining=tier;for(const [n,s]of values)while(remaining>=n){label+=s;remaining-=n;}return label;
}
export function recipeLabel(recipe,data){const name=data.towers[recipeFamily(recipe)].name;return recipeTier(recipe)>1?`${name} · Ascension ${rankLabel(recipeTier(recipe))}`:name;}
export function ascensionRecipe(family,tier){return {id:`ascend-${family}-${tier}`,resultFamily:family,resultTier:tier+1,ascension:true,level:1,stage:'Ascension',ingredients:Array.from({length:3},()=>({family,tier}))};}
export function allRecipes(data,towers=[]){
  const ranks=new Map(Object.entries(data.towers).filter(([,s])=>s.advanced).map(([family])=>[family,new Set([1])]));
  for(const t of towers)if(t.state!=='ruin'&&ranks.has(t.family))ranks.get(t.family).add(t.tier);
  return [...data.recipes,...[...ranks].flatMap(([family,tiers])=>[...tiers].map(tier=>ascensionRecipe(family,tier)))];
}
export function recipesUsing(tower,recipes) {
  return tower&&tower.state!=='ruin'?recipes.filter(r=>r.ingredients.some(i=>i.family===tower.family&&i.tier===tower.tier)):[];
}
export function matchingIngredients(recipe, towers, requiredAnchor = null) {
  const pool=towers.filter(t=>t.state!=='ruin');
  if(requiredAnchor&&!pool.some(t=>t.id===requiredAnchor.id))return null;
  // Try every matching slot for the anchor: recipes may contain duplicate ingredients.
  const anchors=requiredAnchor ? recipe.ingredients.map((r,i)=>r.family===requiredAnchor.family&&r.tier===requiredAnchor.tier?i:-1).filter(i=>i>=0) : [-1];
  for(const slot of anchors) {
    const used=new Set(), matches=[];
    if(requiredAnchor) used.add(requiredAnchor.id);
    let valid=true;
    for(let i=0;i<recipe.ingredients.length;i++) {
      if(i===slot) {matches.push(requiredAnchor);continue;}
      const ingredient=recipe.ingredients[i];
      const t=pool.find(t=>!used.has(t.id)&&t.family===ingredient.family&&t.tier===ingredient.tier);
      if(!t) {valid=false;break;}
      used.add(t.id);matches.push(t);
    }
    if(valid) return matches;
  }
  return null;
}
export function recipeProgress(recipe,towers) {
  const used=new Set();
  return recipe.ingredients.map(r=>{
    const t=towers.find(t=>t.state!=='ruin'&&!used.has(t.id)&&t.family===r.family&&t.tier===r.tier);
    if(t)used.add(t.id);
    return {...r,owned:!!t};
  });
}
export function mergePartner(tower,towers,data) {
  if(!tower || tower.state!=='draft' || !Number.isInteger(tower.round) || tower.tier>=data.balance.tiers.length || data.towers[tower.family].advanced)return null;
  return towers.find(t=>t.id!==tower.id&&t.state==='draft'&&t.round===tower.round&&t.family===tower.family&&t.tier===tower.tier) || null;
}

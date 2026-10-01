export const recipeFamily=recipe=>recipe.resultFamily||recipe.id;
export const recipeTier=recipe=>recipe.resultTier||1;
export function rankLabel(tier){
  const values=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let label='',remaining=tier;for(const [n,s]of values)while(remaining>=n){label+=s;remaining-=n;}return label;
}
export const recipeLabel=(recipe,data)=>data.towers[recipeFamily(recipe)].name;
export const allRecipes=data=>data.recipes.filter(recipe=>recipeTier(recipe)===1);

function baseIngredientTree(recipe,data){
  if(recipeTier(recipe)!==1)throw new Error('Only fixed champion recipes can be expanded.');
  const key=ingredient=>`${ingredient.family}:${ingredient.tier}`;
  const fixed=new Map();
  for(const entry of allRecipes(data)){
    const result=key({family:recipeFamily(entry),tier:recipeTier(entry)});
    if(fixed.has(result))throw new Error(`Multiple fixed recipes produce ${result}.`);
    fixed.set(result,entry);
  }
  const expand=(ingredient,path)=>{
    const {family,tier}=ingredient,node={family,tier};
    if(!Object.hasOwn(data.towers,family))throw new Error(`Unknown ingredient family: ${family}.`);
    if(!Number.isInteger(tier)||tier<1)throw new Error(`Invalid ingredient rank: ${family} ${tier}.`);
    if(!data.towers[family].advanced)return node;
    const id=key(ingredient);
    if(path.has(id))throw new Error(`Cyclic champion recipe: ${id}.`);
    const component=fixed.get(id);
    if(!component)throw new Error(`Missing fixed recipe for ${id}.`);
    const next=new Set(path);next.add(id);
    node.children=component.ingredients.map(piece=>expand(piece,next));
    return node;
  };
  const path=new Set([key({family:recipeFamily(recipe),tier:recipeTier(recipe)})]);
  return recipe.ingredients.map(ingredient=>expand(ingredient,path));
}

function aggregateBaseLeaves(nodes){
  const totals=new Map();
  const visit=(node,covered=false)=>{
    covered||=!!node.covered;
    if(node.children){node.children.forEach(child=>visit(child,covered));return;}
    const key=`${node.family}:${node.tier}`;
    if(!totals.has(key))totals.set(key,{family:node.family,tier:node.tier,count:0,ownedCount:0});
    const row=totals.get(key);row.count++;if(covered)row.ownedCount++;
  };
  nodes.forEach(node=>visit(node));
  return [...totals.values()];
}

// Expand fixed champion ingredients recursively and aggregate exact basic family/rank pairs.
export function expandRecipeToBasics(recipe,data){
  return aggregateBaseLeaves(baseIngredientTree(recipe,data)).map(({ownedCount,...row})=>row);
}

// A ready ingredient champion satisfies its entire subtree. Its consumed recruits
// are counted only there; each real inventory unit can satisfy one requested node.
export function expandedRecipeProgress(recipe,towers,data){
  const nodes=baseIngredientTree(recipe,data);
  const identities=new Set();
  const inventory=towers.filter(tower=>{
    if(tower.state!=='active'&&tower.state!=='draft')return false;
    const identity=tower.id??tower;if(identities.has(identity))return false;
    identities.add(identity);return true;
  });
  const used=new Set();
  const visit=node=>{
    const index=inventory.findIndex((tower,index)=>!used.has(index)&&tower.family===node.family&&tower.tier===node.tier);
    if(index>=0){used.add(index);node.covered=true;return;}
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return aggregateBaseLeaves(nodes);
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

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
  let nodeCount=0;
  const expand=(ingredient,path,depth=1)=>{
    if(depth>16||++nodeCount>4096)throw new Error('Champion recipe expansion exceeds the finite display limit.');
    const {family,tier}=ingredient,node={family,tier};
    if(!Object.hasOwn(data.towers,family))throw new Error(`Unknown ingredient family: ${family}.`);
    if(!Number.isInteger(tier)||tier<1)throw new Error(`Invalid ingredient rank: ${family} ${tier}.`);
    if(!data.towers[family].advanced)return node;
    const id=key(ingredient);
    if(path.has(id))throw new Error(`Cyclic champion recipe: ${id}.`);
    const component=fixed.get(id);
    if(!component)throw new Error(`Missing fixed recipe for ${id}.`);
    const next=new Set(path);next.add(id);
    node.children=component.ingredients.map(piece=>expand(piece,next,depth+1));
    return node;
  };
  const path=new Set([key({family:recipeFamily(recipe),tier:recipeTier(recipe)})]);
  return recipe.ingredients.map(ingredient=>expand(ingredient,path));
}

function aggregateBaseLeaves(nodes){
  const totals=new Map();
  const visit=(node,coverage=null)=>{
    coverage=node.coverage||coverage;
    if(node.children){node.children.forEach(child=>visit(child,coverage));return;}
    const key=`${node.family}:${node.tier}`;
    if(!totals.has(key))totals.set(key,{family:node.family,tier:node.tier,count:0,ownedCount:0,draftCount:0});
    const row=totals.get(key);row.count++;if(coverage==='owned')row.ownedCount++;else if(coverage==='draft')row.draftCount++;
  };
  nodes.forEach(node=>visit(node));
  return [...totals.values()];
}

// Expand fixed champion ingredients recursively and aggregate exact basic family/rank pairs.
export function expandRecipeToBasics(recipe,data){
  return aggregateBaseLeaves(baseIngredientTree(recipe,data)).map(({ownedCount,draftCount,...row})=>row);
}

// A ready ingredient champion satisfies its entire subtree. Its consumed recruits
// are counted only there; each real inventory unit can satisfy one requested node.
function allocatedRecipeTree(recipe,towers,data){
  const nodes=baseIngredientTree(recipe,data);
  const eligible=new Set(recipeInventory(recipe,towers));
  const identities=new Set();
  const inventory=[];
  towers.forEach((tower,index)=>{
    if(!eligible.has(tower)||tower.placed===false||!['active','draft'].includes(tower.state))return;
    const identity=tower.id??tower;if(identities.has(identity))return;
    identities.add(identity);inventory.push({tower,index});
  });
  const used=new Set();
  const visit=(node,state)=>{
    if(node.coverage==='owned')return;
    const index=inventory.findIndex(({tower},index)=>!used.has(index)&&tower.state===state&&tower.family===node.family&&tower.tier===node.tier);
    if(index>=0){
      used.add(index);node.coverage=state==='active'?'owned':'draft';
      node.inventoryIndex=inventory[index].index;node.towerId=inventory[index].tower.id??null;return;
    }
    node.children?.forEach(child=>visit(child,state));
  };
  // Retained ingredients own their leaves. Placed candidates are tracked in a
  // separate pass and only cover the remaining requirements provisionally.
  nodes.forEach(node=>visit(node,'active'));
  nodes.forEach(node=>visit(node,'draft'));
  return nodes;
}
export function expandedRecipeProgress(recipe,towers,data){
  return aggregateBaseLeaves(allocatedRecipeTree(recipe,towers,data));
}

// Physical ownership belongs to the matched node only. Descendants of an
// available champion remain visible as its recipe, but do not claim extra units.
export function recipeTreeProgress(recipe,towers,data){
  const describe=(node,ancestor=null)=>{
    const own=node.coverage==='owned',draft=node.coverage==='draft';
    const coverage=node.coverage?{family:node.family,tier:node.tier,state:own?'active':'draft'}:ancestor;
    return {family:node.family,tier:node.tier,count:1,ownedCount:own?1:0,draftCount:draft?1:0,
      towerId:node.towerId??null,inventoryIndex:node.inventoryIndex??null,
      coveredBy:node.coverage?null:ancestor,
      children:node.children?.map(child=>describe(child,coverage))||[]};
  };
  return allocatedRecipeTree(recipe,towers,data).map(node=>describe(node));
}
export function recipesUsing(tower,recipes) {
  return tower&&tower.state!=='ruin'?recipes.filter(r=>(!r.currentRoundOnly||tower.state==='draft')&&r.ingredients.some(i=>i.family===tower.family&&i.tier===tower.tier)):[];
}
// Secret progress never claims previously retained units. Game supplies the
// authoritative current round when deciding whether the recipe can be crafted.
function recipeInventory(recipe,towers,round=null){
  if(!recipe.currentRoundOnly)return towers;
  const current=round??Math.max(0,...towers.map(t=>Number.isInteger(t.round)?t.round:0));
  return towers.filter(t=>t.state==='draft'&&t.placed!==false&&t.round===current);
}
export function matchingIngredients(recipe, towers, requiredAnchor = null, context = null) {
  let pool=towers.filter(t=>t.state!=='ruin');
  if(recipe.currentRoundOnly){
    if(context?.phase!=='select'||!Number.isInteger(context.round)||recipe.ingredients.length!==3||!requiredAnchor)return null;
    pool=recipeInventory(recipe,pool,context.round);
    if(pool.length!==5||new Set(pool.map(t=>t.id)).size!==5||!pool.includes(requiredAnchor))return null;
  }
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
  towers=recipeInventory(recipe,towers);
  const used=new Set();
  return recipe.ingredients.map(r=>{
    const matches=t=>t.placed!==false&&!used.has(t.id??t)&&t.family===r.family&&t.tier===r.tier;
    const t=towers.find(t=>t.state==='active'&&matches(t))||towers.find(t=>t.state==='draft'&&matches(t));
    if(t)used.add(t.id??t);
    return {...r,owned:t?.state==='active',draft:t?.state==='draft',available:!!t};
  });
}
export function mergePartner(tower,towers,data) {
  if(!tower || tower.state!=='draft' || !Number.isInteger(tower.round) || tower.tier>=data.balance.tiers.length || data.towers[tower.family].advanced)return null;
  return towers.find(t=>t.id!==tower.id&&t.state==='draft'&&t.round===tower.round&&t.family===tower.family&&t.tier===tower.tier) || null;
}

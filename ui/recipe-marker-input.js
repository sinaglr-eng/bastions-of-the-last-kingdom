// A portrait first previews the exact recipe at this foundation. A second
// accepted pointer release confirms only that unchanged preview and inventory.
const signature=(game,recipe,tower)=>{
  const pieces=game.recipePieces(recipe,tower);
  return pieces?JSON.stringify([game.round,game.phase,tower.id,tower.x,tower.z,
    pieces.map(p=>[p.id,p.family,p.tier,p.state,p.round,p.x,p.z])]):null;
};
export class RecipeMarkerActivation {
  constructor(now=()=>performance.now()){this.now=now;this.last=null;}
  activate(game,towerId,recipeId,event=null){
    const hint=game.combinationHints.find(h=>h.tower.id===towerId&&h.recipe.id===recipeId&&h.role!=='discarded');
    if(!hint){this.clear();return false;}
    const {tower,recipe}=hint,current=signature(game,recipe,tower),last=this.last,now=this.now();
    const pointer=event&&['mouse','touch','pen'].includes(event.pointerType)&&event.button===0&&
      Number.isFinite(event.clientX)&&Number.isFinite(event.clientY);
    const confirm=pointer&&current&&game.selected===tower.id&&game.recipePreview?.recipe.id===recipe.id&&
      game.recipePreview?.anchor.id===tower.id&&last?.signature===current&&last.recipeId===recipe.id&&
      last.pointerType===event.pointerType&&now-last.time>=0&&now-last.time<=(event.pointerType==='touch'?450:500)&&
      Math.hypot(event.clientX-last.x,event.clientY-last.y)<=24;
    if(confirm){this.clear();return game.craft(recipe.id);}
    game.select(tower.id);
    if(!game.previewRecipe(recipe.id)){this.clear();return false;}
    this.last=pointer?{signature:signature(game,recipe,tower),recipeId:recipe.id,
      pointerType:event.pointerType,time:now,x:event.clientX,y:event.clientY}:null;
    return false;
  }
  clear(){this.last=null;}
}

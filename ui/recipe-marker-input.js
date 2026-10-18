import {craftRecipeKey,craftRecipeFromDock} from './crafting-dock.js';

// The first activation selects a real result foundation and inspects its recipe.
// A second accepted pointer activation can create directly, using the same
// exact physical-inventory token as the ordinary Create buttons.
export class RecipeMarkerActivation {
  constructor(now=()=>performance.now()){this.now=now;this.last=null;}
  activate(game,towerId,recipeId,event=null){
    const hint=game.combinationHints.find(h=>h.tower.id===towerId&&h.recipe.id===recipeId&&h.role!=='discarded');
    if(!hint){this.clear();return false;}
    const {tower,recipe}=hint,current=craftRecipeKey(game,recipe.id,tower.id),last=this.last,now=this.now();
    const pointer=event&&['mouse','touch','pen'].includes(event.pointerType)&&event.button===0&&
      Number.isFinite(event.clientX)&&Number.isFinite(event.clientY);
    const confirm=pointer&&current&&game.selected===tower.id&&last?.key===current&&last.recipeId===recipe.id&&
      last.pointerType===event.pointerType&&now-last.time>=0&&now-last.time<=(event.pointerType==='touch'?450:500)&&
      Math.hypot(event.clientX-last.x,event.clientY-last.y)<=24;
    if(confirm){this.clear();return craftRecipeFromDock(game,recipe.id,tower.id,current);}
    game.select(tower.id);
    const key=craftRecipeKey(game,recipe.id,tower.id);if(!key){this.clear();return false;}
    game.emit('recipe-inspect',{recipeId:recipe.id,anchorId:tower.id});
    this.last=pointer&&craftRecipeKey(game,recipe.id,tower.id)===key?{key,recipeId:recipe.id,
      pointerType:event.pointerType,time:now,x:event.clientX,y:event.clientY}:null;
    return false;
  }
  clear(){this.last=null;}
}

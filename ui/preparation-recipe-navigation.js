// This history belongs to recipe planning, not the physical defender. Neither
// changing the viewed rank nor following a champion changes Game selection.
export function togglePreparationRecipeSelection(currentId,clickedId,defaultId=null){
  return (currentId===null||currentId===undefined?defaultId:currentId)===clickedId?false:clickedId;
}

export class PreparationRecipeNavigation{
  constructor(){this.clear();}
  clear(){this.identity=null;this.contextRecipeId=null;this.selectedRecipeId=null;this.history=[];}
  sync(tower,displayedTower=tower){
    const identity=tower?`${tower.id}:${tower.family}:${tower.tier}:${displayedTower.family}:${displayedTower.tier}`:null;
    if(identity!==this.identity){this.clear();this.identity=identity;}
    return {contextRecipeId:this.contextRecipeId,selectedRecipeId:this.selectedRecipeId,canBack:this.history.length>0};
  }
  toggle(id,defaultId){this.selectedRecipeId=togglePreparationRecipeSelection(this.selectedRecipeId,id,defaultId);return this.selectedRecipeId;}
  enter(id,selectedRecipeId=null){
    if(!id||id===this.contextRecipeId)return false;
    this.history.push({contextRecipeId:this.contextRecipeId,selectedRecipeId:this.selectedRecipeId});
    this.contextRecipeId=id;this.selectedRecipeId=selectedRecipeId;return true;
  }
  back(){const previous=this.history.pop();if(!previous)return false;Object.assign(this,previous);return true;}
}

// Presentation state is separate from the existing placement-first draft.
// Opening intelligence never reveals a recruit or advances the seeded generator.
export function previewDisclosureOpen({index,previousIndex,pending,previousPending,open}){
  if(pending&&!previousPending)return true;
  return index===previousIndex?!!open:pending;
}

export class WavePreviewFlow {
  constructor(){this.opened=new WeakMap();this.scenes=new WeakSet();}
  pending(game){
    return !!game&&!this.scenes.has(game)&&game.phase==='build'&&this.opened.get(game)!==game.round&&
      game.draft.draws.every(draw=>!draw.placed||draw.fixedPosition);
  }
  open(game){
    if(!this.pending(game))return false;
    this.opened.set(game,game.round);return true;
  }
  reset(game){this.opened.delete(game);}
  // Existing DEV scene builders may perform real placements before UI review.
  runScene(game,callback){this.scenes.add(game);try{return callback();}finally{this.scenes.delete(game);}}
  nextIndex(game){
    if(!game||['won','lost'].includes(game.phase))return null;
    const index=game.phase==='combat'?game.round:game.round-1;
    return index>=game.waveLimit?null:index;
  }
}

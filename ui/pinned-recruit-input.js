import {DraftCardActivation,drawKeeperKey,eligibleDrawKeeper} from './draft-input.js';
import {pinnedRecipeHighlightIds} from './crafting-dock.js';

function candidate(game,towerId){
  if(!game||!['build','select'].includes(game.phase)||game.draft.resolved||game.draft.draws.length!==5||game.moveSelection||game.commandMove.active)return null;
  if(game.phase==='select'&&game.draft.draws.some(draw=>!draw.placed))return null;
  const index=game.draft.draws.findIndex(draw=>draw.towerId===towerId&&draw.placed&&!draw.reservedForNextDraft);
  const tower=game.towers.find(t=>t.id===towerId&&t.state==='draft'&&t.round===game.round&&t.placed!==false);
  return index>=0&&tower&&pinnedRecipeHighlightIds(game).has(towerId)?{index,tower}:null;
}
const signature=(game,index)=>JSON.stringify([game.round,game.phase,game.selected,game.pinned,game.previewRecipeId??null,index,
  !!game.commandMove.active,game.draft.resolved,game.draft.rerollsUsed||0,game.draft.reserveSelection?.index??null,
  game.draft.draws.map(draw=>[draw.towerId??null,!!draw.placed,!!draw.reservedForNextDraft,!!draw.fixedPosition]),
  game.towers.map(tower=>[tower.id,tower.family,tower.tier,tower.state,tower.round,tower.x,tower.z,tower.placed!==false])]);

// Standalone pinned badges are draft-selection surfaces. Their accepted pair
// delegates to the same Keep action as a draw card, with no replacement roll.
export class PinnedRecruitActivation {
  constructor(now=()=>performance.now()){this.activation=new DraftCardActivation(now);}
  capture(game,towerId){
    const current=candidate(game,towerId);
    return current?{game,towerId,index:current.index,key:drawKeeperKey(game,current.index),signature:signature(game,current.index)}:null;
  }
  activate(game,towerId,event=null,press=null){
    const current=candidate(game,towerId);
    if(!current){this.clear();return false;}
    if(event&&(!press||press.game!==game||press.towerId!==towerId||press.index!==current.index||press.key!==drawKeeperKey(game,current.index)||press.signature!==signature(game,current.index))){this.clear();return false;}
    if(game.phase==='select'&&!eligibleDrawKeeper(game,current.index,towerId)){this.clear();return false;}
    return this.activation.activate(game,current.index,event);
  }
  clear(){this.activation.clear();}
}

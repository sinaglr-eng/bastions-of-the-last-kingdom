export function drawnTower(game,index){
  if(!Number.isInteger(index)||index<0)return null;
  const draw=game.draft.draws[index];
  return draw?.placed&&!draw.reservedForNextDraft?game.towers.find(tower=>tower.id===draw.towerId)||null:null;
}

export function eligibleDrawKeeper(game,index,expectedId){
  const tower=drawnTower(game,index);
  return !!tower&&!game.moveSelection&&game.phase==='select'&&tower.state==='draft'&&tower.round===game.round&&
    (expectedId===undefined||tower.id===expectedId);
}

export function drawKeeperKey(game,index){
  const tower=drawnTower(game,index);
  if(!eligibleDrawKeeper(game,index,tower?.id))return null;
  if(!mergeGameIds.has(game))mergeGameIds.set(game,nextMergeGameId++);
  return encodeURIComponent(JSON.stringify([mergeGameIds.get(game),game.round,index,tower.id,tower.family,tower.tier,tower.x,tower.z,
    game.draft.rerollsUsed||0,game.draft.reserveSelection?.index??null,
    game.draft.draws.map(draw=>[draw.towerId,!!draw.reservedForNextDraft,!!draw.fixedPosition])]));
}

// Revalidate the card against current game state; a stale card cannot keep a
// different recruit after a merge, a wave change or a rerender.
export function keepDrawKeeper(game,index,expectedId,expectedKey){
  const tower=drawnTower(game,index);
  if(!eligibleDrawKeeper(game,index,expectedId)||game.selected!==tower.id||
    (expectedKey!==undefined&&drawKeeperKey(game,index)!==expectedKey))return false;
  return game.keep();
}

const mergeGameIds=new WeakMap();let nextMergeGameId=1;
// A visible merge button describes a specific current-round inventory. Keep
// that description with the request so a stale card or pointer release cannot
// merge a changed pair or use a different result foundation.
export function mergeTowerKey(game,towerId){
  if(game.moveSelection||game.phase!=='select'||game.draft.draws.length!==5||game.draft.draws.some(draw=>!draw.placed))return null;
  const candidates=game.roundCandidates.map(candidate=>candidate.tower),tower=candidates.find(candidate=>candidate.id===towerId);
  const expected=game.draft.draws.filter(draw=>!draw.reservedForNextDraft).length;
  if(candidates.length!==expected||new Set(candidates.map(candidate=>candidate.id)).size!==expected||!tower)return null;
  const partner=game.mergePartner(tower);if(!partner)return null;
  if(!mergeGameIds.has(game))mergeGameIds.set(game,nextMergeGameId++);
  return encodeURIComponent(JSON.stringify([mergeGameIds.get(game),game.round,tower.id,partner.id,game.draft.rerollsUsed||0,
    candidates.map(candidate=>[candidate.id,candidate.family,candidate.tier,candidate.state,candidate.round,candidate.x,candidate.z]),
    game.draft.draws.map(draw=>draw.towerId)]));
}

export function mergeTowerFromBadge(game,towerId,expectedKey){
  if(!expectedKey||mergeTowerKey(game,towerId)!==expectedKey)return false;
  game.select(towerId);
  // select() notifies listeners. Recheck before delegating the mutation to the
  // same core action used by the selected defender's command panel.
  if(mergeTowerKey(game,towerId)!==expectedKey||game.selected!==towerId)return false;
  return game.merge();
}

// Actual accepted pointer releases call this method. Keyboard activation only
// selects; keeping remains available through the adjacent button or Space.
export class DraftCardActivation {
  constructor(now=()=>performance.now()){this.now=now;this.last=null;}
  activate(game,index,event=null){
    const tower=drawnTower(game,index);
    if(!tower){this.clear();return false;}
    const pointer=event&&['mouse','touch'].includes(event.pointerType)&&event.button===0&&
      Number.isFinite(event.clientX)&&Number.isFinite(event.clientY);
    const eligible=eligibleDrawKeeper(game,index,tower.id),key=drawKeeperKey(game,index),now=this.now(),last=this.last;
    const confirm=pointer&&eligible&&game.selected===tower.id&&last?.towerId===tower.id&&
      last.round===game.round&&last.key===key&&last.pointerType===event.pointerType&&now-last.time>=0&&
      now-last.time<=(event.pointerType==='touch'?450:500)&&
      Math.hypot(event.clientX-last.x,event.clientY-last.y)<=24;
    if(confirm){this.clear();return keepDrawKeeper(game,index,tower.id,key);}
    this.last=pointer&&eligible?{towerId:tower.id,key,round:game.round,pointerType:event.pointerType,time:now,x:event.clientX,y:event.clientY}:null;
    game.select(tower.id);return false;
  }
  clear(){this.last=null;}
}

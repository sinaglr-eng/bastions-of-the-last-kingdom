export function drawnTower(game,index){
  if(!Number.isInteger(index)||index<0)return null;
  const draw=game.draft.draws[index];
  return draw?.placed?game.towers.find(tower=>tower.id===draw.towerId)||null:null;
}

export function eligibleDrawKeeper(game,index,expectedId){
  const tower=drawnTower(game,index);
  return !!tower&&game.phase==='select'&&tower.state==='draft'&&tower.round===game.round&&
    (expectedId===undefined||tower.id===expectedId);
}

// Revalidate the card against current game state; a stale card cannot keep a
// different recruit after a merge, a wave change or a rerender.
export function keepDrawKeeper(game,index,expectedId){
  const tower=drawnTower(game,index);
  if(!eligibleDrawKeeper(game,index,expectedId)||game.selected!==tower.id)return false;
  return game.keep();
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
    const eligible=eligibleDrawKeeper(game,index,tower.id),now=this.now(),last=this.last;
    const confirm=pointer&&eligible&&game.selected===tower.id&&last?.towerId===tower.id&&
      last.round===game.round&&last.pointerType===event.pointerType&&now-last.time>=0&&
      now-last.time<=(event.pointerType==='touch'?450:500)&&
      Math.hypot(event.clientX-last.x,event.clientY-last.y)<=24;
    if(confirm){this.clear();return keepDrawKeeper(game,index,tower.id);}
    this.last=pointer&&eligible?{towerId:tower.id,round:game.round,pointerType:event.pointerType,time:now,x:event.clientX,y:event.clientY}:null;
    game.select(tower.id);return false;
  }
  clear(){this.last=null;}
}

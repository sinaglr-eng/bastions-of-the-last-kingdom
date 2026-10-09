import {PointerTapGesture} from '../game/render/touch-input.js';

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

const drawCard=target=>target?.closest?.('[data-action="draw"]')||null;
function drawIdentity(game,index){
  const draw=game.draft.draws[index];if(!draw)return null;
  const tower=drawnTower(game,index);
  // Latent draws stay latent: only a placed defender contributes its identity.
  return JSON.stringify([game.round,index,!!draw.placed,draw.towerId??null,!!draw.reservedForNextDraft,
    game.draft.rerollsUsed||0,game.draft.reserveSelection?.index??null,
    tower?[tower.id,tower.family,tower.tier,tower.state,tower.round,tower.x,tower.z]:null]);
}

// Pointer capture can retarget a touch release away from its visible card.
// Resolve the release by its viewport position, then consume its compatibility
// click. A click-only browser/accessibility action selects without confirming.
export class DraftCardPointerInput {
  constructor({now=()=>performance.now(),hitTest=null,activate,clearActivation=()=>{}}={}){
    this.now=now;this.hitTest=hitTest;this.activate=activate;this.clearActivation=clearActivation;
    this.gesture=new PointerTapGesture(now);this.origins=new Map();this.lastRelease=-Infinity;
  }
  start(game,event){
    this.gesture.start(event);const card=drawCard(event.target),index=Number(card?.dataset.index);
    if(card&&!card.disabled&&card.isConnected!==false&&Number.isInteger(index)){
      const identity=drawIdentity(game,index);
      if(identity)this.origins.set(event.pointerId,{game,index,identity,button:event.button,type:event.pointerType});
    }
    if(this.gesture.navigating(event.pointerId))this.clearActivation();
  }
  move(event){this.gesture.move(event);if(this.gesture.navigating(event.pointerId))this.clearActivation();}
  valid(game,origin,card){
    return !!origin&&origin.game===game&&!!card&&!card.disabled&&card.isConnected!==false&&
      Number(card.dataset.index)===origin.index&&drawIdentity(game,origin.index)===origin.identity;
  }
  end(game,event){
    const origin=this.origins.get(event.pointerId),active=this.gesture.active(event.pointerId),tap=this.gesture.end(event);
    this.origins.delete(event.pointerId);if(active)this.lastRelease=this.now();
    const card=drawCard(this.hitTest?this.hitTest(event.clientX,event.clientY):event.target);
    if(!tap||!this.valid(game,origin,card)){this.clearActivation();return false;}
    this.activate(origin.index,{pointerType:origin.type,button:origin.button,clientX:event.clientX,clientY:event.clientY});return true;
  }
  click(game,event){
    const card=drawCard(event.target),index=Number(card?.dataset.index);
    if(!card||card.disabled||card.isConnected===false||!Number.isInteger(index)||!drawIdentity(game,index))return false;
    const physical=event.detail>0||event.pointerType==='touch'||event.sourceCapabilities?.firesTouchEvents;
    if(physical){
      // A pending primary press must still be unchanged and unmoved. Without
      // a pointer stream, a native click remains a selection-only fallback.
      const pending=[...this.origins.entries()].find(([,origin])=>origin.index===index);
      if(pending){
        const [pointerId,origin]=pending;
        const tap=this.gesture.end({pointerId,clientX:event.clientX,clientY:event.clientY});this.origins.delete(pointerId);this.lastRelease=this.now();
        if(!tap||!this.valid(game,origin,card)){this.clearActivation();return false;}
      }else if(this.now()-this.lastRelease<800)return false;
    }
    this.activate(index,null);return true;
  }
  cancel(event){
    if(this.gesture.active(event.pointerId))this.lastRelease=this.now();
    this.gesture.cancel(event);this.origins.delete(event.pointerId);this.clearActivation();
  }
  lostCapture(event){if(this.gesture.active(event.pointerId)||this.origins.has(event.pointerId))this.cancel(event);}
  clear(){
    if(this.gesture.pointers.size||this.origins.size)this.lastRelease=this.now();
    this.gesture.clear();this.origins.clear();this.clearActivation();
  }
}

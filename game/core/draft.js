import {weightedIndex} from './math.js';
import {CommandPoints} from './command-points.js';
import {recruitSlot} from './recruit-slots.js';

const defenderIdentity=defender=>{
  const {x,z,state,round,...identity}=defender;
  return structuredClone(identity);
};
const reserveIdentity=defender=>{
  const {state,round,...identity}=defender;
  return structuredClone(identity);
};

export class DraftManager {
  constructor(data,rng,commandPoints=new CommandPoints(data.balance)) {
    this.data=data;this.rng=rng;this.commandPoints=commandPoints;this.draws=[];this.forced=null;
    this.rerollsUsed=0;this.carriedReserve=null;this.reserveSelection=null;this.reservedDefender=null;this.finalSelection=null;this.finalDefender=null;this.resolved=false;
  }
  roll(mastery) {
    this.mastery=mastery;
    this.roundForced=this.forced?{...this.forced}:null;
    this.carriedReserve=this.reservedDefender?reserveIdentity(this.reservedDefender):null;
    this.reservedDefender=null;this.reserveSelection=null;this.finalSelection=null;this.finalDefender=null;this.rerollsUsed=0;this.resolved=false;this.closedEarly=false;
    this.draws=Array.from({length:this.data.balance.drawsPerRound},(_,index)=>({index,placed:false,fixedPosition:false,origin:'random',protectedFromReroll:false,reservedForNextDraft:false}));
    if(this.carriedReserve)Object.assign(this.draws[0],{family:this.carriedReserve.family,tier:this.carriedReserve.tier,identity:reserveIdentity(this.carriedReserve),towerId:this.carriedReserve.id,placed:true,fixedPosition:true,origin:'reserve',protectedFromReroll:true});
    return this.draws;
  }
  reveal(index) {
    const draw=this.draws[index];
    if(!draw||draw.placed)return null;
    if(draw.family)return draw;
    return this.generate(draw);
  }
  generate(draw) {
    const families=Object.entries(this.data.towers).filter(([,t])=>!t.advanced);
    if(this.data.factionId&&this.roundForced?.family&&(!Object.hasOwn(this.data.towers,this.roundForced.family)||this.data.towers[this.roundForced.family].advanced))throw Error('Invalid faction draft family.');
    let weights=families.map(([,t])=>t.weight);
    if(this.focus){const sum=weights.reduce((a,b)=>a+b,0),at=families.findIndex(([id])=>recruitSlot(id)===this.focus.slot);if(at>=0){const old=weights[at]/sum,next=Math.min(.999,old+this.focus.bonus);weights=weights.map((w,i)=>i===at?next:w/sum*(1-next)/(1-old));}}
    draw.family=this.roundForced?.family || families[weightedIndex(weights,this.rng)][0];
    draw.tier=this.roundForced?.tier || weightedIndex(this.data.balance.mastery[this.mastery].weights,this.rng)+1;
    return draw;
  }
  get rerollReason(){
    if(this.resolved)return 'This draft is already resolved.';
    if(!this.closedEarly&&(this.draws.length!==this.data.balance.drawsPerRound||this.draws.some(draw=>!draw.placed)))return 'Place all five defenders before rerolling.';
    if(!this.draws.some(draw=>draw.placed))return 'No recruits to reroll.';
    if(this.rerollsUsed>=this.commandPoints.config.maxRerollsPerDraft)return 'Reroll already used in this draft.';
    if(this.reserveSelection)return 'Reserve is confirmed. Reroll before reserving a defender.';
    if(!this.commandPoints.canSpend('reroll'))return `Reroll requires ${this.commandPoints.cost('reroll')} CP.`;
    return '';
  }
  canReroll(){return !this.rerollReason;}
  reroll(){
    if(!this.canReroll()||!this.commandPoints.spend('reroll'))return false;
    for(const draw of this.draws)if((!this.closedEarly||draw.placed)&&!draw.protectedFromReroll)this.generate(draw);
    this.rerollsUsed++;return true;
  }
  reserveReason(index){
    const draw=this.draws[index];
    if(this.resolved)return 'This draft is already resolved.';
    if(!this.closedEarly&&(this.draws.length!==this.data.balance.drawsPerRound||this.draws.some(candidate=>!candidate.placed)))return 'Place all five defenders before reserving.';
    if(!draw?.placed||!draw.family)return 'Select a defender from this draft.';
    if(this.closedEarly&&this.draws.filter(candidate=>candidate.placed&&!candidate.reservedForNextDraft).length<2)return 'Keep the last available candidate; Reserve needs another candidate to keep.';
    if(this.reserveSelection)return 'One defender is already reserved for the next draft.';
    if(!this.commandPoints.canSpend('reserve'))return `Reserve requires ${this.commandPoints.cost('reserve')} CP.`;
    return '';
  }
  canReserve(index){return !this.reserveReason(index);}
  reserve(index,identity){
    if(!this.canReserve(index)||!identity||!Number.isSafeInteger(identity.id)||identity.id<=0||!this.data.towers[identity.family]||!Number.isSafeInteger(identity.tier)||identity.tier<1||identity.tier>this.data.balance.tiers.length||!Number.isSafeInteger(identity.x)||!Number.isSafeInteger(identity.z))return false;
    const draw=this.draws[index];
    if(draw.towerId!==identity.id)return false;
    // Reserve keeps the actual defender's fixed map position. Its dormant
    // state and next round belong to Game, while its identity remains intact.
    const defender=reserveIdentity(identity);
    if(!this.commandPoints.spend('reserve'))return false;
    this.reserveSelection={index,defender};draw.reservedForNextDraft=true;
    if(this.carriedReserve&&index!==0)this.draws[0].protectedFromReroll=false;
    return defender;
  }
  finalize(index,finalDefender=null){
    const draw=this.draws[index];
    if(this.resolved||!draw?.placed||draw.reservedForNextDraft||!this.closedEarly&&this.draws.some(candidate=>!candidate.placed))return false;
    // A recipe may keep its result on an older retained foundation. The draw
    // index still identifies the new ingredient that resolved this draft.
    const final=finalDefender||{...draw.identity,id:draw.towerId,family:draw.family,tier:draw.tier};
    if(!Number.isSafeInteger(final.id)||final.id<=0||!this.data.towers[final.family]||!Number.isSafeInteger(final.tier)||final.tier<1||final.tier>this.data.balance.tiers.length)return false;
    this.finalDefender=defenderIdentity(final);this.finalSelection=index;this.reservedDefender=this.reserveSelection?reserveIdentity(this.reserveSelection.defender):null;this.resolved=true;return true;
  }
  discardReserve(){
    this.carriedReserve=null;this.reserveSelection=null;this.reservedDefender=null;
    for(const draw of this.draws){draw.protectedFromReroll=false;draw.reservedForNextDraft=false;draw.fixedPosition=false;delete draw.identity;}
  }
}

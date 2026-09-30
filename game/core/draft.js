import {weightedIndex} from './math.js';
export class DraftManager {
  constructor(data,rng) {this.data=data;this.rng=rng;this.draws=[];this.forced=null;}
  roll(mastery) {
    this.mastery=mastery;
    this.roundForced=this.forced?{...this.forced}:null;
    this.draws=Array.from({length:this.data.balance.drawsPerRound},(_,index)=>({index,placed:false}));
    return this.draws;
  }
  reveal(index) {
    const draw=this.draws[index];
    if(!draw||draw.placed)return null;
    if(draw.family)return draw;
    const families=Object.entries(this.data.towers).filter(([,t])=>!t.advanced);
    draw.family=this.roundForced?.family || families[weightedIndex(families.map(([,t])=>t.weight),this.rng)][0];
    draw.tier=this.roundForced?.tier || weightedIndex(this.data.balance.mastery[this.mastery].weights,this.rng)+1;
    return draw;
  }
}

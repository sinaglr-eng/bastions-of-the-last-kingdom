export class EconomyManager {
  constructor(balance) {this.balance=balance;this.gold=balance.startingGold;this.xp=0;this.rerolls=0;}
  get level(){return 1+Math.floor(this.xp/this.balance.xpPerLevel);}
  get mastery(){return Math.min(this.balance.mastery.length-1,Math.max(0,this.level-1));}
  spend(cost) {if(!Number.isFinite(cost)||cost<0||this.gold<cost)return false;this.gold-=cost;return true;}
  reward(gold,xp=0) {this.gold+=gold;this.xp+=xp;}
  nextMastery() {return this.balance.mastery[this.mastery+1] || null;}
  upgradeMastery() {return false;}
  get rerollCost(){return this.balance.rerollCosts[Math.min(this.rerolls,this.balance.rerollCosts.length-1)];}
}

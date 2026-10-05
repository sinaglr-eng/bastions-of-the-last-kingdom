export const CONSTRUCTION_MASTERY_TARGET_ROUND=25;

// Construction round 25 already uses the maximum row before any invader
// spawns. Kingdom XP remains a separate recipe-unlock progression.
export function constructionMasteryForRound(round,balance){
  if(!Number.isSafeInteger(round)||round<1)throw new RangeError('Construction round must be a positive integer');
  const maximum=Math.min(balance.mastery.length-1,balance.masteryLevelCap??balance.mastery.length-1);
  return Math.floor((Math.min(round,CONSTRUCTION_MASTERY_TARGET_ROUND)-1)*maximum/(CONSTRUCTION_MASTERY_TARGET_ROUND-1));
}

export class EconomyManager {
  constructor(balance) {this.balance=balance;this.gold=balance.startingGold;this.xp=0;this.rerolls=0;this.constructionRound=1;}
  get level(){return 1+Math.floor(this.xp/this.balance.xpPerLevel);}
  get mastery(){return constructionMasteryForRound(this.constructionRound,this.balance);}
  setConstructionRound(round){
    constructionMasteryForRound(round,this.balance);
    this.constructionRound=Math.max(this.constructionRound,round);return this.mastery;
  }
  spend(cost) {if(!Number.isFinite(cost)||cost<0||this.gold<cost)return false;this.gold-=cost;return true;}
  reward(gold,xp=0) {this.gold+=gold;this.xp+=xp;}
  nextMastery() {return this.balance.mastery[this.mastery+1] || null;}
  upgradeMastery() {return false;}
  get rerollCost(){return this.balance.rerollCosts[Math.min(this.rerolls,this.balance.rerollCosts.length-1)];}
}

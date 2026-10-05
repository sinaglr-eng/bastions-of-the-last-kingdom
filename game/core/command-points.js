// Run-local tactical currency. All amounts belong to the existing balance data.
export class CommandPoints {
  constructor(balance) {
    const config=balance.commandPoints;
    if(!config||!Number.isSafeInteger(config.starting)||config.starting<0||!Number.isSafeInteger(config.bossReward)||config.bossReward<0||config.maxReserveCount!==1||config.maxRerollsPerDraft!==1)throw new Error('Invalid Command Points configuration');
    for(const action of ['reroll','reserve','move'])if(!Number.isSafeInteger(config.costs?.[action])||config.costs[action]<0)throw new Error(`Invalid Command Points cost: ${action}`);
    this.config=structuredClone(config);this.costs=this.config.costs;this.reset();
  }
  reset(){this.value=this.config.starting;this.rewardedBosses=new Set();}
  cost(action){return this.costs[action];}
  canSpend(action){const cost=this.cost(action);return Number.isSafeInteger(cost)&&cost>=0&&Number.isSafeInteger(this.value)&&this.value>=cost;}
  spend(action){if(!this.canSpend(action))return false;this.value-=this.cost(action);return true;}
  rewardBoss(enemy){
    if(!enemy?.boss||enemy.dead!==true||!(enemy.hp<=0)||!Number.isSafeInteger(enemy.id)||enemy.id<=0||this.rewardedBosses.has(enemy.id))return 0;
    const next=this.value+this.config.bossReward;
    if(!Number.isSafeInteger(next)||next<0)return 0;
    this.rewardedBosses.add(enemy.id);this.value=next;return this.config.bossReward;
  }
}

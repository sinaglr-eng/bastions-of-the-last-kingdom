export const MVP_RULES=Object.freeze({maxLevel:10,damagePerLevel:.05});
export const mvpLevel=tower=>Math.max(0,Math.min(MVP_RULES.maxLevel,Math.floor(Number.isFinite(tower?.mvpLevel)?tower.mvpLevel:0)));
export const mvpDamageBonus=tower=>mvpLevel(tower)*MVP_RULES.damagePerLevel;
// Compatibility exports for archived integrations. MVP has only a personal bonus.
export const mvpArmorReduction=()=>0;
export const mvpAllyDamageBonus=()=>0;
export const inheritedMvpLevel=towers=>towers.reduce((level,tower)=>Math.max(level,mvpLevel(tower)),0);

export class MvpManager{
  constructor(game){this.game=game;this.damage=new Map();this.awardedRound=null;game.on((type,hit)=>{if(type==='hit')this.recordHit(hit);});}
  startWave(){this.damage.clear();this.awardedRound=null;}
  damageFor(towerOrId){return this.damage.get(typeof towerOrId==='object'?towerOrId?.id:towerOrId)||0;}
  setLevel(tower,level){
    if(!this.game.towers.includes(tower)||tower.state==='ruin'||!Number.isFinite(level))return false;
    tower.mvpLevel=mvpLevel({mvpLevel:level});this.game.emit('change');return true;
  }
  recordHit(hit){
    const tower=hit.source,amount=hit.effectiveDamage;
    if(this.game.phase!=='combat'||!this.game.towers.includes(tower)||tower.state!=='active'||!Number.isFinite(amount)||amount<=0)return;
    this.damage.set(tower.id,this.damageFor(tower)+amount);
  }
  awardWave(){
    if(this.game.phase!=='combat'||this.awardedRound===this.game.round)return null;
    this.awardedRound=this.game.round;
    const eligible=this.game.towers.map((tower,index)=>({tower,index,damage:this.damageFor(tower)})).filter(({tower,damage})=>tower.state==='active'&&mvpLevel(tower)<MVP_RULES.maxLevel&&damage>0);
    eligible.sort((a,b)=>b.damage-a.damage||mvpLevel(b.tower)-mvpLevel(a.tower)||(a.tower.id-b.tower.id)||a.index-b.index);
    const winner=eligible[0];if(!winner)return null;
    winner.tower.mvpLevel=mvpLevel(winner.tower)+1;
    const award={tower:winner.tower,level:winner.tower.mvpLevel,damage:winner.damage,round:this.game.round};
    this.game.emit('mvp-awarded',award);return award;
  }
}

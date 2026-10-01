import {readFileSync,writeFileSync} from 'node:fs';
const balance=JSON.parse(readFileSync('data/balance.json','utf8'));
// Sixteen quality tables follow Kingdom levels 1 through 16 automatically.
const tableCount=16;
const anchors=[[100,0,0,0,0,0],[75,25,0,0,0,0],[60,30,10,0,0,0],[45,35,20,0,0,0],[30,35,25,10,0,0],[20,30,30,20,0,0],[10,25,35,25,5,0],[5,20,30,35,10,0]];
balance.mastery=Array.from({length:tableCount},(_,i)=>{
  const at=i===0?0:1+(i-1)*6/14,lo=Math.floor(at),hi=Math.ceil(at);
  const weights=anchors[lo].map((w,j)=>Math.round(w*(1-at+lo)+anchors[hi][j]*(at-lo)));
  weights[0]+=100-weights.reduce((a,b)=>a+b,0);
  return {level:i+1,weights};
});
balance.masteryLevelCap=tableCount-1;balance.downgradeCost=200;balance.removalCost=0;
delete balance.specialUpgradeCost;
delete balance.specialUpgradeMultiplier;
delete balance.repairCost;delete balance.repairLives;
writeFileSync('data/balance.json',JSON.stringify(balance,null,2)+'\n');
console.log('Automatic Kingdom-based mastery; downgrade 200 gold; demolition free.');

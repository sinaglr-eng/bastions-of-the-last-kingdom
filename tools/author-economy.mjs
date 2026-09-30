import {readFileSync,writeFileSync} from 'node:fs';
const balance=JSON.parse(readFileSync('data/balance.json','utf8'));
// 6,500 gold: perfect campaign income is 6,177 after wave 29 and 6,599 after 30.
const costs=[0,65,90,125,170,220,280,340,400,460,520,590,670,760,850,960];
const anchors=[[100,0,0,0,0,0],[75,25,0,0,0,0],[60,30,10,0,0,0],[45,35,20,0,0,0],[30,35,25,10,0,0],[20,30,30,20,0,0],[10,25,35,25,5,0],[5,20,30,35,10,0]];
balance.mastery=costs.map((cost,i)=>{
  const at=i===0?0:1+(i-1)*6/14,lo=Math.floor(at),hi=Math.ceil(at);
  const weights=anchors[lo].map((w,j)=>Math.round(w*(1-at+lo)+anchors[hi][j]*(at-lo)));
  weights[0]+=100-weights.reduce((a,b)=>a+b,0);
  return {cost,level:i===0?1:1+Math.floor((i-1)*1.2),weights};
});
balance.masteryLevelCap=costs.length-1;balance.downgradeCost=200;
delete balance.repairCost;delete balance.repairLives;
writeFileSync('data/balance.json',JSON.stringify(balance,null,2)+'\n');
console.log('15 mastery upgrades; total cost 6,500 gold. Downgrade 200 gold. Keep health is permanent.');

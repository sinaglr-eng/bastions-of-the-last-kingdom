import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {seededRandom,weightedIndex,towerStats,damageAfterDefense,distance} from '../game/core/math.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const rows=[];
for(const [family,stats]of Object.entries(data.towers))for(let tier=1;tier<=(stats.advanced?1:data.balance.tiers.length);tier++){
 const t=towerStats({family,tier},data),dps=t.damage/t.interval;
 rows.push({tower:stats.name,tier,DPS:+dps.toFixed(1),DPS_vs_40_armor:+(damageAfterDefense(t.damage,t.type,{armor:40},{penetration:t.penetration||0},data.balance)/t.interval).toFixed(1),DPS_vs_40_magic:+(damageAfterDefense(t.damage,t.type,{resists:{magic:.4}},t,data.balance)/t.interval).toFixed(1),range:t.range,equivalent_value:stats.advanced?'recipe':2**(tier-1),effects:['cleave','slow','burnAura','poisonDps','shred','freeze','multishot','aura'].filter(k=>t[k]).join(';')});
}
mkdirSync('artifacts',{recursive:true});const headers=Object.keys(rows[0]);writeFileSync('artifacts/balance.csv',[headers.join(','),...rows.map(r=>headers.map(h=>r[h]).join(','))].join('\n'));
const distributions=data.balance.mastery.map((row,mastery)=>{const rng=seededRandom(714),counts=data.balance.tiers.map(()=>0);for(let i=0;i<100000;i++)counts[weightedIndex(row.weights,rng)]++;return {mastery,expected:row.weights,observed:counts.map(c=>c/1000)};});
writeFileSync('artifacts/probabilities.json',JSON.stringify(distributions,null,2));
console.table(rows);console.log('Wrote artifacts/balance.csv and artifacts/probabilities.json. Base single-target DPS excludes auras, splash and damage over time.');
if(process.argv.includes('--campaign')){
 const results=[];
 for(const seed of [42,123,807]){
  const g=new Game(data,{seed});let steps=0;
  while(!['lost','won'].includes(g.phase)&&steps<250000){
   if(g.phase==='build'){
    while(g.economy.nextMastery()&&g.economy.level>=g.economy.nextMastery().level&&g.economy.gold>=g.economy.nextMastery().cost)g.mastery();
    // A simple greedy placement/keep policy: no maze optimization, reroll fishing or emergency repairs.
    for(let i=0;i<5;i++){
     const candidates=[];
     for(let z=3;z<g.grid.size-2;z+=2)for(let x=3;x<g.grid.size-2;x+=2)if(g.grid.type(x,z)==='buildable'){
      const score=g.grid.route.filter(p=>distance({x,z},p)<4.5).length-g.towers.filter(t=>t.state==='active'&&distance({x,z},t)<3).length*3;
      candidates.push({x,z,score});
     }
     candidates.sort((a,b)=>b.score-a.score);
     const cell=candidates.find(p=>g.grid.canPlace(p.x,p.z).ok);if(!cell)throw Error('Bot ran out of buildable cells');g.place(cell.x,cell.z);
    }
   }else if(g.phase==='select'){
    const fresh=g.towers.filter(t=>t.state==='draft');
    fresh.sort((a,b)=>{const dps=t=>{const s=towerStats(t,data);return s.damage/s.interval*(1+(s.cleave||0)*2)*(s.multishot||1)+(s.poisonDps||0)+(s.burnAura||0)*2;};return dps(b)-dps(a);});
    let crafted=false;for(const t of fresh){g.select(t.id);const r=g.availableRecipes()[0];if(r){g.craft(r.id);crafted=true;break;}}
    if(!crafted){g.select(fresh[0].id);if(!g.merge())g.keep();}
   }else if(g.phase==='ready')g.startCombat();else if(g.phase==='reward')g.nextRound();else g.tick(.1);
   steps++;
  }
  results.push({seed,outcome:g.phase,wave:g.round,lives:g.lives,kills:g.kills,mastery:g.economy.mastery,steps});
 }
 console.table(results);writeFileSync('artifacts/campaign-simulation.json',JSON.stringify(results,null,2));
}

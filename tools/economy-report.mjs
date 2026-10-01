import {readFileSync,writeFileSync} from 'node:fs';
import {EconomyManager} from '../game/core/progression.js';
const data=Object.fromEntries(['balance','waves','enemies'].map(k=>[k,JSON.parse(readFileSync(`data/${k}.json`,'utf8'))]));
const eco=new EconomyManager(data.balance),rows=[];let earned=eco.gold;
rows.push({wave:0,earned,mastery:eco.mastery,kingdom:eco.level,xp:eco.xp,gold:eco.gold});
for(const [i,wave] of data.waves.entries()){
  for(const group of wave.groups){const e=data.enemies[group.type];eco.reward(0,e.xp*group.count);}
  const reward=wave.boss?200:50;earned+=reward;eco.reward(reward,15);
  rows.push({wave:i+1,earned,mastery:eco.mastery,kingdom:eco.level,xp:eco.xp,gold:eco.gold});
}
const first=rows.find(r=>r.mastery===data.balance.mastery.length-1);
writeFileSync('artifacts/economy-report.json',JSON.stringify({firstMaxWave:first?.wave,rows},null,2));
writeFileSync('docs/ECONOMY_BALANCE.md',`# Campaign economy and difficulty

Construction mastery follows Kingdom level automatically: mastery = min(Kingdom level − 1, 15). Each 90 XP advances Kingdom. Kills award XP and score; completed waves award 15 XP. Current-round draw odds are frozen at its start. Reaching a Kingdom level during combat changes the next round's draw odds, without a purchase.

Normal waves award 50 gold on completion; boss waves award 200 gold. These completion payouts happen once, including the finale. Kills and champion attacks award no gold. Starting gold remains 90. In a full campaign with no theft, total gold is 3,340. Enemy theft remains an enemy ability.

Gold is spent only on the 200-gold candidate downgrade. It lowers one basic current candidate by exactly one rank and immediately keeps it; the other four become walls. Castle-wall demolition is free and does not refund a construction draw. Paid mastery and champion enhancements are unavailable. Keep health cannot be bought.

With every enemy killed, maximum mastery first applies after wave ${first?.wave}. This timing depends on XP, not on gold spending or theft. Tier VI requires merging two Tier V candidates in the same round.

Every 50-wave campaign grants 250 placements. The three new curated plans use no more than 150 occupied cells; user-provided layouts keep their original geometry. The planner counts the union of planned and existing walls and defenders.

| After wave | Kingdom | Mastery | XP | Total gold before downgrades or theft |
|---:|---:|---:|---:|---:|
`+rows.filter(r=>[0,3,5,10,15,20,25,30,35,50].includes(r.wave)).map(r=>`| ${r.wave} | ${r.kingdom} | ${r.mastery}/15 | ${r.xp} | ${r.gold} |`).join('\n')+`

Only the first patrol is introductory, with 9 HP, speed 1.3, zero armor and 2.4-second spawn intervals. Waves 2–50 retain their existing normal combat tuning, movement classes and abilities. Reproduce with \`node tools/author-economy.mjs\`, \`node tools/author-campaign.mjs\` and \`node tools/economy-report.mjs\`.
`);
console.log({firstMaxWave:first?.wave,totalGold:eco.gold});

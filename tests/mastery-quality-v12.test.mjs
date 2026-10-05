import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DraftManager} from '../game/core/draft.js';
import {EconomyManager} from '../game/core/progression.js';
import {weightedIndex} from '../game/core/math.js';
import {masteryPanelMarkup} from '../ui/mastery-panel.js';

const data=Object.fromEntries(['balance','towers'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));

test('quality reaches 20% Royal at construction mastery15 while preserving costs, XP and all balance settings',()=>{
  const {mastery}=data.balance;
  // Pre-V12 settings, including damage/range, fees, XP, cap, seed and row levels.
  // Restore original key order when hashing so only weight changes are excluded.
  const {commandPoints,wavePreview,...existingBalance}=data.balance;
  assert.ok(wavePreview&&wavePreview.fullPreviewWavesAhead===1,'preview settings are additive and do not alter historical combat balance');
  assert.deepEqual(commandPoints,{starting:3,bossReward:5,costs:{reroll:1,reserve:1,move:2},maxReserveCount:1,maxRerollsPerDraft:1});
  const canonical={...existingBalance,mastery:mastery.map(({weights,...row})=>row)};
  assert.equal(createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
    'aec31935eee9ab73c57b03d40df8d0bf44894f27721cd8dc162308168df88c0c');
  assert.deepEqual(mastery[0].weights,[100,0,0,0,0,0]);
  assert.equal(mastery.length,16);assert.equal(mastery.at(-1).weights[4],20);
  assert.equal(mastery.findIndex(row=>row.weights[4]>0),11,'Royal unlock remains mastery11');
  assert.equal(mastery.findIndex(row=>row.weights[3]>0),6,'Elite unlock milestone is unchanged');
  assert.equal(mastery.findIndex(row=>row.weights[2]>0),2,'Veteran unlock milestone is unchanged');
  const economy=new EconomyManager(data.balance),initialGold=economy.gold;
  economy.reward(0,15*data.balance.xpPerLevel);assert.equal(economy.level,16);assert.equal(economy.mastery,0);
  economy.setConstructionRound(24);assert.equal(economy.mastery,14);
  economy.setConstructionRound(25);assert.equal(economy.mastery,15);assert.equal(economy.gold,initialGold);
  economy.reward(0,10000);assert.equal(economy.mastery,15);assert.equal(economy.nextMastery(),null);
});

test('each distribution totals 100% and every upgrade improves high-rank odds without premature Royal or random Mythic draws',()=>{
  const rows=data.balance.mastery;
  for(const [index,row] of rows.entries()){
    assert.equal(row.level,index+1);assert.equal(row.weights.length,6);
    assert.ok(row.weights.every(w=>Number.isInteger(w)&&w>=0));
    assert.equal(row.weights.reduce((sum,w)=>sum+w,0),100);assert.equal(row.weights[5],0);
    if(index<11)assert.equal(row.weights[4],0);
    if(index){
      for(let threshold=1;threshold<5;threshold++)assert.ok(
        row.weights.slice(threshold).reduce((sum,w)=>sum+w,0)>=rows[index-1].weights.slice(threshold).reduce((sum,w)=>sum+w,0),
        `Mastery ${index} cannot reduce the chance of rank ${threshold+1} or higher`);
      const royalStep=row.weights[4]-rows[index-1].weights[4];assert.ok(royalStep>=0&&royalStep<=5);
    }
    const html=masteryPanelMarkup({mastery:index},data.balance);
    assert.deepEqual([...html.matchAll(/width:(\d+)%/g)].map(match=>Number(match[1])),row.weights);
    assert.deepEqual([...html.matchAll(/<em>(\d+)%<\/em>/g)].map(match=>Number(match[1])),row.weights.slice(0,5));
    assert.match(html,/<b>VI<\/b><em>Merge<\/em>/);
  }
});

test('real DraftManager reveals exactly the advertised distribution under uniform stratified draws and never rerolls cached reveals',()=>{
  const before=JSON.stringify(data);
  for(const [mastery,row] of data.balance.mastery.entries()){
    let calls=0,sample=0;
    const rng=()=>++calls%2===1?.35:(sample+++.5)/100;
    const draft=new DraftManager(data,rng),counts=Array(6).fill(0);
    for(let round=0;round<20;round++){
      draft.roll(mastery);
      for(let index=0;index<5;index++){
        const draw=draft.reveal(index),afterReveal=calls;
        assert.ok(draw.tier>=1&&draw.tier<=5);assert.ok(!data.towers[draw.family].advanced);
        counts[draw.tier-1]++;
        assert.equal(draft.reveal(index),draw);assert.equal(calls,afterReveal,'A cached visible draw spends no more RNG');
        draw.placed=true;assert.equal(draft.reveal(index),null);
      }
    }
    assert.deepEqual(counts,row.weights,`Actual mastery ${mastery} reveal counts must match each percentage`);
    assert.equal(calls,200);assert.equal(counts[5],0);
  }
  assert.equal(JSON.stringify(data),before);
  const final=data.balance.mastery.at(-1).weights;
  assert.equal(weightedIndex(final,()=>.8-1e-8),3);
  assert.equal(weightedIndex(final,()=>.8),4);
  assert.equal(weightedIndex(final,()=>1-Number.EPSILON),4);
});

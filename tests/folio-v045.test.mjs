import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {rankLabel} from '../game/core/recipes.js';

const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
function lineup(){
  const game=new Game(data,{seed:4506});
  for(const tier of [1,2,2,4,4,4,6]){
    game.draft.roundForced={family:'stormcaller',tier};
    for(let index=0;index<5;index++)assert.equal(game.place(4+index,2+game.round),true);
    game.select(game.roundCandidates[0].tower.id);assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);game.completeWave();
  }
  game.draft.roundForced={family:'stormcaller',tier:1};assert.equal(game.place(4,2+game.round),true);game.select(game.roundCandidates[0].tower.id);
  return game;
}

test('viewed-rank counts follow every rank across a mixed real kept lineup without counting walls, paused state or the new candidate',()=>{
  const game=lineup(),control=lineup(),candidate=game.selection,preview=new DefenderRankPreview();
  assert.equal(game.setTowerAttackPaused(game.towers.find(tower=>tower.state==='active'&&tower.tier===4).id,true),true);
  const before=JSON.stringify({towers:game.towers,draws:game.draft.draws,selected:game.selected,phase:game.phase,gold:game.economy.gold,cp:game.commandPoints.value});
  for(const [tier,count]of [[1,1],[2,2],[3,0],[4,3],[5,0],[6,1],[1,1]]){
    assert.equal(preview.select(candidate,tier,data),true);
    const html=defenderPanelMarkup(game,candidate,{rankPreview:preview});
    assert.match(html,new RegExp(`<p class="defender-built-count">${count} built at rank ${rankLabel(tier)}</p>`));
    assert.match(html,/Actual rank I · Candidate/);assert.equal(candidate.tier,1);
  }
  assert.equal(JSON.stringify({towers:game.towers,draws:game.draft.draws,selected:game.selected,phase:game.phase,gold:game.economy.gold,cp:game.commandPoints.value}),before);
  assert.equal(game.rng(),control.rng());
});

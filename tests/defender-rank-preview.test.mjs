import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats} from '../game/core/math.js';
import {DefenderRankPreview,defenderRankPreviewMarkup} from '../ui/defender-rank-preview.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const basics=Object.entries(data.towers).filter(([,stats])=>!stats.advanced).map(([family])=>family);
function candidates(){
  const game=new Game(data,{seed:42});game.economy.gold=500;
  game.draft.roundForced={family:'druid',tier:3};
  for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);
  game.select(game.towers[0].id);return game;
}

test('all six ranks of every basic defender use actual rank stats without changing the unit',()=>{
  const preview=new DefenderRankPreview();
  for(const family of basics){
    const tower={id:family,family,tier:3,state:'active',priority:'first',kills:17};
    const before=structuredClone(tower);
    for(let tier=1;tier<=6;tier++){
      assert.equal(preview.select(tower,tier,data),true);
      const view=preview.view(tower,data);
      assert.notEqual(view,tower);assert.equal(view.tier,tier);
      assert.deepEqual(towerStats(view,data),towerStats({...tower,tier},data));
      assert.deepEqual(tower,before);
    }
  }
});

test('rank comparisons preserve draft rolls, gold, selection and the actual merge result',()=>{
  const game=candidates(),control=candidates(),preview=new DefenderRankPreview();
  const before=JSON.stringify({towers:game.towers,draws:game.draft.draws,gold:game.economy.gold,selected:game.selected,phase:game.phase});
  for(const tier of [6,1,5,2,4])assert.equal(preview.select(game.selection,tier,data),true);
  assert.equal(JSON.stringify({towers:game.towers,draws:game.draft.draws,gold:game.economy.gold,selected:game.selected,phase:game.phase}),before);
  assert.equal(game.rng(),control.rng(),'preview consumes no combat or draft randomness');
  assert.equal(game.merge(),true);assert.equal(game.selection.tier,4);
  assert.equal(preview.view(game.selection,data).tier,4,'actual upgrade resets the comparison');
});

test('downgrade uses the real selected rank even while Tier VI is displayed',()=>{
  const game=candidates(),preview=new DefenderRankPreview();
  preview.select(game.selection,6,data);assert.equal(game.downgrade(),true);
  assert.equal(game.selection.tier,2);assert.equal(game.economy.gold,300);
  assert.equal(game.selection.state,'active');assert.equal(preview.view(game.selection,data).tier,2);
});

test('new selections and transformed units reset previews; champions, walls and invalid ranks cannot acquire one',()=>{
  const preview=new DefenderRankPreview(),tower={id:1,family:'druid',tier:3,state:'active'};
  preview.select(tower,6,data);
  assert.equal(preview.view({...tower,id:2},data).tier,3);
  preview.select(tower,6,data);assert.equal(preview.view({...tower,family:'archer'},data).tier,3);
  for(const tier of [0,7,2.5,NaN,'3'])assert.equal(preview.select(tower,tier,data),false);
  for(const other of [{...tower,state:'ruin'},{...tower,family:'highking'},null]){
    assert.equal(preview.select(other,6,data),false);
    assert.equal(defenderRankPreviewMarkup(other,other,data),'');
    assert.equal(preview.view(other,data),other);
  }
  assert.equal(preview.view(tower,data).tier,3);
});

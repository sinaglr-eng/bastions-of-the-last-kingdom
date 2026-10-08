import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {towerStats} from '../game/core/math.js';
import {DefenderRankPreview,defenderRankPreviewMarkup} from '../ui/defender-rank-preview.js';
import {campaignTowers,campaignRecipes} from '../game/core/campaign-roster.js';
import {recipeProgress,recipesUsing,recipeLabel,rankLabel} from '../game/core/recipes.js';
import {builtTowerCount} from '../game/core/warband-info.js';
import {defenderCode} from '../game/core/unit-label.js';
import {championClassification} from '../game/render/champion-classification.js';
import {rankColor} from '../game/render/ranks.js';
import {ROMAN,abilityLines,baseAttackDps,formatTowerNumber,damageTypeName} from '../ui/grimoire.js';
import {selectedSupportMarkup} from '../ui/support-guide.js';
import {icon} from '../ui/icons.js';

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

// Exercise the actual sidebar renderer, without booting WebGL, the animation
// loop or command delegation. This catches a renderer that still uses field rank.
const mainSource=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const panelStart=mainSource.indexOf('function towerPanel(t)'),panelEnd=mainSource.indexOf('function enemyInspectionOptions');
assert.ok(panelStart>=0&&panelEnd>panelStart,'production tower panel has an explicit following function boundary');
const panelSource=mainSource.slice(panelStart,panelEnd);
const qualitySource=mainSource.slice(mainSource.indexOf('function quality(t)'),mainSource.indexOf('function notice('));
const campaignData={...data,towers:campaignTowers(data.towers),recipes:campaignRecipes(data.recipes)};
function productionPanel(game,preview){
  assert.ok(panelSource.startsWith('function towerPanel(t)'));
  return runInNewContext(`${qualitySource}\n${panelSource}\ntowerPanel`,{
    game,rankPreview:preview,data:campaignData,towers:campaignData.towers,balance:data.balance,
    images:{},roman:ROMAN,icon,towerStats,rankColor,defenderCode,championClassification,
    defenderRankPreviewMarkup,builtTowerCount,rankLabel,abilityLines,formatTowerNumber,baseAttackDps,
    damageTypeName,selectedSupportMarkup,recipeProgress,recipesUsing,recipeLabel,wavePreview:()=>'',
  });
}
function recipePanelGame(){
  const game=new Game(campaignData,{seed:731});
  const placeRound=pieces=>pieces.forEach((piece,index)=>{
    game.draft.roundForced=piece;assert.equal(game.place(3+index,2+game.round),true);
  });
  const advance=()=>{assert.equal(game.startCombat(),true);game.completeWave();};
  placeRound(['soldier','mage','druid','runebreaker','stormcaller'].map(family=>({family,tier:1})));
  game.select(game.towers[0].id);assert.equal(game.keep(),true);advance();
  placeRound(['cleric','druid','archer','mage','frostwarden'].map(family=>({family,tier:1})));
  game.select(game.roundCandidates[0].tower.id);assert.equal(game.craft('thornwarden'),true);advance();
  placeRound([{family:'stormcaller',tier:3},...['mage','frostwarden','runebreaker','cleric'].map(family=>({family,tier:1}))]);
  game.select(game.towers.find(t=>t.family==='soldier'&&t.state==='active').id);
  return game;
}
const potentialIds=html=>[...html.matchAll(/data-action="recipe-open" data-id="([^"]+)"/g)].map(match=>match[1]);
const panelGameSnapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,gold:game.economy.gold,xp:game.economy.xp,phase:game.phase,selected:game.selected,round:game.round,occupied:[...game.grid.occupied],discoveries:[...game.discoveries]});

test('production sidebar potential combinations follow the displayed I→II rank and reset to the real selection',()=>{
  const game=recipePanelGame(),preview=new DefenderRankPreview(),render=productionPanel(game,preview),tower=game.selection;
  const rankI=potentialIds(render(tower));assert.ok(rankI.includes('rimewatch'));assert.ok(!rankI.includes('verdantguard'));
  assert.equal(preview.select(tower,2,campaignData),true);
  const rankII=potentialIds(render(tower));assert.ok(rankII.includes('verdantguard'));assert.ok(!rankII.includes('rimewatch'));
  assert.notDeepEqual(rankII,rankI);assert.equal(tower.tier,1);
  assert.equal(preview.select(tower,1,campaignData),true);assert.deepEqual(potentialIds(render(tower)),rankI);
  preview.select(tower,2,campaignData);
  const other=game.towers.find(t=>t.family==='cleric'&&t.state==='draft');game.select(other.id);
  assert.deepEqual(potentialIds(render(other)),recipesUsing(other,game.recipes).map(recipe=>recipe.id));
  assert.equal(preview.view(other,campaignData).tier,other.tier);
});

test('preview recipes count actual retained and placed ingredients without inventing the displayed rank or enabling its craft',()=>{
  const game=recipePanelGame(),control=recipePanelGame(),preview=new DefenderRankPreview(),render=productionPanel(game,preview);
  const before=panelGameSnapshot(game),dataBefore=JSON.stringify(campaignData),tower=game.selection;
  preview.select(tower,2,campaignData);const html=render(tower);
  const verdantButton=html.match(/<button[^>]*data-action="recipe-open" data-id="verdantguard"[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(verdantButton);
  assert.match(verdantButton,/1\/3 <small class="draft-progress">\+1 this round<\/small>/,
    'Only real Thornwarden is owned; real Stormcaller III is provisional; the displayed Soldier II is still missing');
  assert.ok(!game.towers.some(t=>t.family==='soldier'&&t.tier===2&&t.state!=='ruin'));
  assert.doesNotMatch(html,/data-action="craft" data-id="verdantguard"/);
  assert.ok(!game.availableRecipes(tower).some(recipe=>recipe.id==='verdantguard'));
  assert.equal(panelGameSnapshot(game),before);assert.equal(JSON.stringify(campaignData),dataBefore);
  assert.equal(game.rng(),control.rng(),'Rendering recipe previews consumes no RNG');
});

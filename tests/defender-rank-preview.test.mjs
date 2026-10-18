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
import {displayDefenderCode as defenderCode} from '../ui/recipe-navigation.js';
import {CommandPointerInput} from '../ui/command-pointer-input.js';
import {championClassification} from '../game/render/champion-classification.js';
import {rankColor} from '../game/render/ranks.js';
import {ROMAN,abilityLines,baseAttackDps,formatTowerNumber,damageTypeName} from '../ui/grimoire.js';
import {selectedSupportMarkup} from '../ui/support-guide.js';
import {mvpDetailsMarkup} from '../ui/mvp-details.js';
import {mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';
import {icon} from '../ui/icons.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DpsMeasurement} from '../ui/dps-measurement.js';
import {TowerDpsTracker} from '../game/core/tower-dps.js';
import {PreparationRecipeNavigation} from '../ui/preparation-recipe-navigation.js';

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

test('production downgrade-and-keep stays beside the actual heading before optional details and follows actual rank, gold and reserve guards',()=>{
  const game=candidates(),preview=new DefenderRankPreview(),render=productionPanel(game,preview),tower=game.selection;
  preview.select(tower,6,campaignData);game.economy.gold=data.balance.downgradeCost-1;
  let html=render(tower),button=html.match(/<button[^>]*data-action="downgrade"[^>]*>/)?.[0];assert.ok(button);
  assert.match(html,/Actual rank III · Candidate/);assert.ok(html.indexOf('data-action="downgrade"')>html.indexOf('class="tower-name"'));assert.ok(html.indexOf('data-action="downgrade"')<html.indexOf('class="defender-core"'));assert.ok(html.indexOf('data-action="downgrade"')<html.indexOf('class="rank-preview"'));
  assert.match(button,/disabled/);assert.match(html,/Downgrade to Tier II &amp; keep/);
  assert.equal((html.match(/data-action="downgrade"/g)||[]).length,1);assert.equal(game.downgrade(),false);assert.equal(tower.tier,3);assert.equal(tower.state,'draft');
  game.economy.gold=data.balance.downgradeCost;html=render(tower);button=html.match(/<button[^>]*data-action="downgrade"[^>]*>/)[0];assert.doesNotMatch(button,/disabled/);
  assert.equal(game.downgrade(),true);assert.equal(tower.tier,2);assert.equal(tower.state,'active');assert.equal(game.economy.gold,0);assert.doesNotMatch(render(tower),/data-action="downgrade"/);
  const reserved=candidates(),reservedTower=reserved.selection;assert.equal(reserved.reserve(),true);assert.doesNotMatch(productionPanel(reserved,new DefenderRankPreview())(reservedTower),/data-action="downgrade"/);
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
function productionPanel(game,preview,planningNavigation=new PreparationRecipeNavigation()){
  assert.ok(panelSource.startsWith('function towerPanel(t)'));
  return runInNewContext(`${qualitySource}\n${panelSource}\ntowerPanel`,{
    game,rankPreview:preview,folioRecipeId:null,preparationNavigation:planningNavigation,data:campaignData,towers:campaignData.towers,balance:data.balance,
    defenderPanelMarkup,dpsMeasurement:new DpsMeasurement(),dpsTracker:new TowerDpsTracker(),
    images:{},roman:ROMAN,icon,towerStats,rankColor,defenderCode,championClassification,
    defenderRankPreviewMarkup,builtTowerCount,rankLabel,abilityLines,formatTowerNumber,baseAttackDps,
    damageTypeName,selectedSupportMarkup,mvpDetailsMarkup,mergeTowerKey,recipeProgress,recipesUsing,recipeLabel,wavePreview:()=>'',
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
const potentialIds=html=>[...html.matchAll(/data-action="folio-recipe" data-id="([^"]+)"/g)].map(match=>match[1]);
const panelGameSnapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,gold:game.economy.gold,xp:game.economy.xp,phase:game.phase,selected:game.selected,round:game.round,occupied:[...game.grid.occupied],discoveries:[...game.discoveries]});

test('production sidebar potential combinations follow the displayed rank and reset to the real selection',()=>{
  const game=recipePanelGame(),preview=new DefenderRankPreview(),render=productionPanel(game,preview),tower=game.selection;
  const rankI=potentialIds(render(tower));assert.ok(rankI.includes('rimewatch'));assert.ok(!rankI.includes('verdantguard'));
  assert.equal(preview.select(tower,2,campaignData),true);
  const rankII=potentialIds(render(tower));assert.deepEqual(rankII,recipesUsing({...tower,tier:2},game.recipes).map(recipe=>recipe.id));assert.ok(rankII.includes('verdantguard'));assert.ok(!rankII.includes('rimewatch'));assert.equal(tower.tier,1);
  assert.equal(preview.select(tower,1,campaignData),true);assert.deepEqual(potentialIds(render(tower)),rankI);
  preview.select(tower,2,campaignData);
  const other=game.towers.find(t=>t.family==='cleric'&&t.state==='draft');game.select(other.id);
  assert.deepEqual(potentialIds(render(other)),recipesUsing(other,game.recipes).map(recipe=>recipe.id));
  assert.equal(preview.view(other,campaignData).tier,other.tier);
});

test('preview recipes expose actual retained and placed ingredients without inventing the displayed rank or enabling its craft',()=>{
  const game=recipePanelGame(),control=recipePanelGame(),preview=new DefenderRankPreview(),navigation=new PreparationRecipeNavigation(),render=productionPanel(game,preview,navigation);
  const before=panelGameSnapshot(game),dataBefore=JSON.stringify(campaignData),tower=game.selection;
  preview.select(tower,2,campaignData);let html=render(tower);
  assert.doesNotMatch(html,/class="folio-ingredient (?:built|draft)"|class="folio-recipe-detail"/);
  navigation.toggle('verdantguard');html=render(tower);
  assert.ok(!potentialIds(html).includes('rimewatch'));assert.ok(potentialIds(html).includes('verdantguard'));
  assert.match(html,/class="folio-ingredient built"/);assert.match(html,/class="folio-ingredient draft"/);
  assert.ok(!game.towers.some(t=>t.family==='soldier'&&t.tier===2&&t.state!=='ruin'));
  assert.match(html,/Viewed rank II recipes|Planning view/);assert.doesNotMatch(html,/data-action="(?:craft|craft-dock)" data-id="verdantguard"/);
  assert.ok(!game.availableRecipes(tower).some(recipe=>recipe.id==='verdantguard'));
  assert.equal(panelGameSnapshot(game),before);assert.equal(JSON.stringify(campaignData),dataBefore);
  assert.equal(game.rng(),control.rng(),'Rendering recipe previews consumes no RNG');
});

test('production defender panel removes descriptive, Strong/Weak and pause-explanation prose while preserving every rank, abilities and commands',()=>{
  let fallback=false;
  for(const [family,definition]of Object.entries(campaignData.towers)){
    const game=new Game(campaignData,{seed:42});game.draft.roundForced={family,tier:1};for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);
    const tower=game.towers[0];game.select(tower.id);assert.equal(game.keep(),true);game.mvp.setLevel(tower,10);
    const preview=new DefenderRankPreview(),render=productionPanel(game,preview),before=panelGameSnapshot(game);
    for(const tier of definition.advanced?[1]:[1,2,3,4,5,6]){
      if(!definition.advanced)assert.equal(preview.select(tower,tier,campaignData),true);
      const html=render(tower);
      assert.doesNotMatch(html,/<p class="(?:strength|weakness)"|Strong:|Weak:|<small>Pauses new attacks|Support and MVP auras stay active/);
      assert.doesNotMatch(html,/<p class="role">/);if(html.includes('<p>No combination uses this defender at the viewed rank.</p>'))fallback=true;
      assert.match(html,/<h2 class="tower-name">/);assert.match(html,/class="defender-heading folio-identity"/);assert.match(html,/class="tower-effects/);assert.match(html,/Damage \/ hit/);assert.match(html,/Direct DPS/);assert.match(html,/Target priority/);
      assert.match(html,/MVP Level: 10 \/ 10/);assert.match(html,/Own damage \+100%/);assert.match(html,/\+75% damage/);assert.match(html,/data-action="tower-pause" aria-pressed="false" aria-label="Pause unit attacks"/);assert.ok(html.indexOf('data-action="tower-pause"')<html.indexOf('</header>'));assert.ok(html.indexOf('class="rank-preview"')<html.indexOf('Target priority')||definition.advanced);assert.ok(html.indexOf('class="mvp-details"')<html.indexOf('class="selected-support"'));assert.ok(html.indexOf('class="selected-support"')<html.indexOf('Target priority'));
      if(!definition.advanced)assert.equal((html.match(/data-action="preview-rank"/g)||[]).length,6);
    }
    assert.equal(panelGameSnapshot(game),before,'Panel changes and comparisons leave actual towers and draft unchanged');
  }
  assert.equal(fallback,true,'The unrelated missing-recipe explanation remains visible');
});

function retainedVPanelGame(phase){
  const game=new Game(campaignData,{seed:731}),pair=[];
  for(let round=1;round<=2;round++){
    game.draft.roundForced={family:'archer',tier:5};for(let x=3;x<8;x++)assert.equal(game.place(x,2+game.round),true);
    const tower=game.roundCandidates[0].tower;game.select(tower.id);assert.equal(game.keep(),true);pair.push(tower);
    if(round===1){assert.equal(game.startCombat(),true);game.completeWave();}
  }
  if(phase!=='ready'){assert.equal(game.startCombat(),true);game.completeWave();if(phase==='select'){game.draft.roundForced={family:'mage',tier:1};for(let x=3;x<8;x++)assert.equal(game.place(x,2+game.round),true);}}
  game.select(pair[0].id);return {game,pair};
}
function productionMergeClick(game){
  const callbacks=new Map(),captures=new Map(),noop=()=>{},app={addEventListener:(type,fn,options)=>((options===true||options?.capture)?captures:callbacks).set(type,fn)};
  const start=mainSource.indexOf('function handleCommand('),end=mainSource.indexOf('function toggleWorld(',start);assert.ok(start>=0&&end>start);
  runInNewContext(mainSource.slice(start,end),{game,app,CommandPointerInput,window:{addEventListener:noop},document:{addEventListener:noop,elementFromPoint:()=>null},world:{maze:{editing:false},doubleTap:{clear:noop}},audio:{unlock:noop},draftCardActivation:{clear:noop},mergeTowerFromBadge,debug:false,codex:noop,warbands:noop,help:noop,sendWave:noop,closeDialog:noop,cancelRecipePreview:noop,debugPanel:noop});
  return button=>{let stopped=false;const event={target:{closest:()=>button},detail:1,preventDefault:noop,stopImmediatePropagation:()=>{stopped=true;}};captures.get('click')?.(event);if(!stopped)callbacks.get('click')(event);};
}
for(const phase of ['ready','build','select'])test(`production retained Rank V sidebar action works in ${phase} using the actual selected foundation and preserves the pending draft`,()=>{
  const {game,pair:[tower,partner]}=retainedVPanelGame(phase),preview=new DefenderRankPreview(),render=productionPanel(game,preview),click=productionMergeClick(game);
  assert.equal(preview.select(tower,1,campaignData),true);const html=render(tower),tag=html.match(/<button[^>]*data-action="merge"[^>]*>/)?.[0];assert.ok(tag);assert.match(html,/Merge to rank VI/);
  const draft=JSON.stringify(game.draft.draws),resolved=game.draft.resolved,position=[tower.x,tower.z],occupied=[...game.grid.occupied];
  const button={dataset:{action:'merge',towerId:tag.match(/data-tower-id="([^"]+)"/)[1],mergeKey:tag.match(/data-merge-key="([^"]+)"/)[1]},disabled:false};click(button);
  assert.equal(game.selection,tower);assert.equal(tower.tier,6);assert.equal(partner.state,'ruin');assert.deepEqual([tower.x,tower.z],position);assert.deepEqual([...game.grid.occupied],occupied);assert.equal(JSON.stringify(game.draft.draws),draft);assert.equal(game.draft.resolved,resolved);assert.equal(game.phase,phase);
  assert.doesNotMatch(render(tower),/data-action="merge"/);const completed=panelGameSnapshot(game);click(button);assert.equal(panelGameSnapshot(game),completed,'Even a stale native command cannot merge beyond VI');
});

test('a stale selected-panel Merge action cannot change the new selection, changed pair or foundation',()=>{
  for(const change of [game=>game.select(game.towers[5].id),game=>game.towers[5].mvpLevel=8,game=>game.towers[0].x++,game=>game.phase='build']){
    const {game,pair:[tower]}=retainedVPanelGame('ready'),render=productionPanel(game,new DefenderRankPreview()),click=productionMergeClick(game),tag=render(tower).match(/<button[^>]*data-action="merge"[^>]*>/)[0];
    const button={dataset:{action:'merge',towerId:tag.match(/data-tower-id="([^"]+)"/)[1],mergeKey:tag.match(/data-merge-key="([^"]+)"/)[1]},disabled:false};
    change(game);const before=panelGameSnapshot(game);click(button);assert.equal(panelGameSnapshot(game),before);assert.equal(tower.tier,5);
  }
});

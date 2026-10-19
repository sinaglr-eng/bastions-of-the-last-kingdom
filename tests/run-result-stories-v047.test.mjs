import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';
import {DEFEAT_CHRONICLES,runEndingStory} from '../ui/run-result-stories.js';
import {runResultModel,runResultMarkup} from '../ui/run-results.js';

const archived=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...archived,towers:campaignTowers(archived.towers),enemies:campaignEnemies(archived.enemies),recipes:campaignRecipes(archived.recipes),waves:campaignWaves(archived.waves)};
const snapshot=game=>JSON.stringify({round:game.round,phase:game.phase,score:game.score,kills:game.kills,lives:game.lives,towers:game.towers,draws:game.draft.draws,cp:game.commandPoints.value,elapsed:game.elapsedSeconds});

test('all 50 authored defeat chronicles have distinct short English text and the exact current campaign wave identity',()=>{
  assert.equal(DEFEAT_CHRONICLES.length,50);assert.equal(new Set(DEFEAT_CHRONICLES.map(story=>story.id)).size,50);assert.equal(new Set(DEFEAT_CHRONICLES.map(story=>story.title)).size,50);assert.equal(new Set(DEFEAT_CHRONICLES.map(story=>story.text)).size,50);
  for(const [index,story]of DEFEAT_CHRONICLES.entries()){
    assert.equal(story.wave,index+1);assert.equal(story.enemy,data.waves[index].name);assert.equal(runEndingStory({wave:index+1}),story);assert.match(story.text,/Lord Bernhard/);assert.ok(story.text.split(/\s+/).length<=70);assert.ok(story.text.split(/\s+/).length>=25);assert.doesNotMatch(story.text,/\b(?:DPS|damage|weak defense|caused by|your archers|your maze)\b/i);assert.ok(Object.isFrozen(story));
  }
  assert.ok(Object.isFrozen(DEFEAT_CHRONICLES));assert.equal(DEFEAT_CHRONICLES[37].enemy,'Black Marsh Knifemen / Blood-Leech Trolls');assert.match(DEFEAT_CHRONICLES[49].enemy,/Lord Bernhard/);assert.doesNotMatch(DEFEAT_CHRONICLES[49].enemy,/Ghorun/);
});

test('every actual Game loss selects its wave chronicle, explicitly presents fiction and preserves factual score/progress and gameplay RNG',()=>{
  for(let wave=1;wave<=50;wave++){
    const game=new Game(data,{seed:4700+wave}),control=new Game(data,{seed:4700+wave});game.round=control.round=wave;game.score=control.score=12345;game.kills=control.kills=83;game.end(false);control.end(false);const before=snapshot(game),story=DEFEAT_CHRONICLES[wave-1];
    const model=runResultModel(game);assert.equal(model.story,story);assert.equal(model.score,12345);assert.equal(model.kills,83);const html=runResultMarkup(model);
    assert.match(html,/aria-label="Fictional ending chronicle"/);assert.match(html,/Fictional chronicle/);assert.ok(html.includes(`data-story-id="defeat-wave-${wave}"`));assert.ok(html.includes(story.title));assert.ok(html.includes(story.enemy));assert.ok(html.includes(story.text));assert.match(html,/12,345/);assert.match(html,/83/);assert.ok(html.includes(`Defeated on wave ${wave}`));assert.doesNotMatch(html,/Recorded final wave facts|Last leak:|Last recorded invader:|they do not establish why a defense failed/);
    assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());assert.equal(runResultModel(game).story,story,'Reopening results keeps the same authored ending');
  }
});

test('victory has its own ending, including the final Bernhard chapter and historical short-campaign victory',()=>{
  const final=runEndingStory({won:true,wave:50}),border=runEndingStory({won:true,wave:10});assert.equal(final.id,'victory-kingdom');assert.match(final.text,/defenders raise their own colours/);assert.doesNotMatch(final.text,/his long conquest has reached/);assert.equal(border.id,'victory-border');assert.match(border.text,/celebrates its defenders/);assert.notEqual(final.text,border.text);
  for(const limit of [10,50]){const game=new Game(data,{seed:47,waveLimit:limit});game.round=limit;game.end(true);const model=runResultModel(game),html=runResultMarkup(model);assert.equal(model.story,limit===50?final:border);assert.match(html,/Run ended · Victory/);assert.doesNotMatch(html,/data-story-id="defeat/);}
});

test('chronicles never rely on unrecorded last invaders or interpolate raw HTML from model data',()=>{
  const game=new Game(data,{seed:47});game.end(false);const model=runResultModel(game);assert.equal(model.finalWaveLeaks,null);assert.equal(model.lastThreat,null);assert.match(runResultMarkup(model),/The first stolen banner/);
  const unsafe={...model,story:{id:'<svg>',title:'<img src=x onerror=bad()>',enemy:'<b>Invader</b>',text:'<script>bad()</script>'}},html=runResultMarkup(unsafe);assert.match(html,/&lt;img src=x onerror=bad\(\)&gt;/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<img src=x|<script>|data-story-id="<svg>/);
  for(const wave of [0,-1,51,1.5,NaN])assert.equal(runEndingStory({wave}).id,'defeat-unknown');
});

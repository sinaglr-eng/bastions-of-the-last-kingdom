import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats} from '../game/core/math.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {preparationEffects} from '../ui/preparation-folio.js';

const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const snapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,selected:game.selected,phase:game.phase,gold:game.economy.gold,cp:game.commandPoints.value,occupied:[...game.grid.occupied]});
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function candidates(family='runebreaker',tier=1){const game=new Game(data,{seed:844});game.draft.roundForced={family,tier};for(let index=0;index<5;index++)assert.equal(game.place(4+index,4),true);game.select(game.towers[0].id);return game;}

test('unknown recruit question mark and visible map instruction do not consult hidden identities or consume RNG',()=>{
  const game=new Game(data,{seed:844}),control=new Game(data,{seed:844});
  for(const draw of game.draft.draws)for(const field of ['family','tier'])Object.defineProperty(draw,field,{get(){throw Error('Hidden identity read');},configurable:true});
  const before={selected:game.selected,phase:game.phase,activeDraw:game.activeDraw,towers:game.towers.length,cp:game.commandPoints.value};
  for(let pass=0;pass<3;pass++){
    const html=draftCardsMarkup(game,data,{});
    assert.equal((html.match(/class="draw-name">Place a defender on the map</g)||[]).length,5);assert.equal((html.match(/class="mystery-placement"/g)||[]).length,5);assert.equal((html.match(/class="mystery-question"/g)||[]).length,5);assert.doesNotMatch(html,/mystery-figure|placement-tile|placement-arrow/);
    assert.equal((html.match(/aria-label="\d: Place a defender on the map\. Build on an empty tile to reveal\."/g)||[]).length,5);assert.doesNotMatch(html,/Unrevealed defender/);
    assert.equal((html.match(/data-action="draw"/g)||[]).length,5);assert.doesNotMatch(html,/<img|<image|href=|data-action="(?:keep-draw|merge-tower)"/);
  }
  assert.deepEqual({selected:game.selected,phase:game.phase,activeDraw:game.activeDraw,towers:game.towers.length,cp:game.commandPoints.value},before);assert.equal(game.rng(),control.rng());
});

test('Physical, Magical and Holy card labels agree with the actual candidate profile and its displayed-rank label',()=>{
  for(const [family,type]of [['soldier','physical'],['mage','magical'],['cleric','holy']]){
    const game=candidates(family),control=candidates(family),tower=game.selection,preview=new DefenderRankPreview(),before=snapshot(game),cards=draftCardsMarkup(game,data,{});
    assert.equal((cards.match(new RegExp(`class="draw-damage" data-damage-type="${type}"`,'g'))||[]).length,5);
    assert.match(cards,new RegExp(`>${type[0].toUpperCase()+type.slice(1)}</span>`));
    preview.select(tower,6,data);const html=defenderPanelMarkup(game,tower,{rankPreview:preview});
    assert.match(html,new RegExp(`class="damage-tag" data-damage-type="${type}">${type[0].toUpperCase()+type.slice(1)}</span>`));assert.match(html,/Preview rank VI · Actual rank I unchanged/);assert.equal(tower.tier,1);assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
  }
});

test('compact Engineer candidate retains every engine statistic, complete ability line and all six non-mutating rank choices',()=>{
  const game=candidates(),control=candidates(),tower=game.selection,preview=new DefenderRankPreview(),before=snapshot(game);
  for(const tier of [1,6,1]){
    preview.select(tower,tier,data);const view=preview.view(tower,data),stats=towerStats(view,data),html=defenderPanelMarkup(game,tower,{rankPreview:preview});
    assert.match(html,/data-defender-state="draft"/);assert.equal((html.match(/data-action="preview-rank"/g)||[]).length,6);
    for(const [label,value]of [['Damage / hit',stats.damage],['Direct DPS',stats.damage/stats.interval],['Range',stats.range],['Interval',`${stats.interval}s`]])assert.ok(html.includes(`<span>${label}</span><strong>${value}</strong>`),label+' remains visible in the complete profile');
    for(const line of preparationEffects(stats))assert.ok(html.includes(`<li>${escape(line)}</li>`),line);
    assert.equal(tower.tier,1);assert.equal(game.selection,tower);assert.equal(snapshot(game),before);
  }
  assert.equal(game.rng(),control.rng());
});

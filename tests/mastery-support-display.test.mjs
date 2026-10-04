import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EconomyManager} from '../game/core/progression.js';
import {Game} from '../game/core/game.js';
import {masteryPanelMarkup} from '../ui/mastery-panel.js';
import {selectedSupportMarkup,supportEffectsMarkup,supportMapLegendMarkup} from '../ui/support-guide.js';
import {SUPPORT_EFFECT_STYLES} from '../game/render/support-effects.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const unit=(family,id,tier=1,x=10)=>({family,id,tier,state:'active',x,z:10});

test('compact automatic mastery display includes every exact future quality weight without changing economy',()=>{
  const economy=new EconomyManager(data.balance);economy.gold=0;
  for(let rank=0;rank<data.balance.mastery.length;rank++){
    economy.xp=rank*data.balance.xpPerLevel;const before=JSON.stringify(economy),html=masteryPanelMarkup(economy,data.balance);
    assert.match(html,/Future draw odds/);assert.match(html,new RegExp(`${rank} / ${data.balance.mastery.length-1}`));
    const rendered=[...html.matchAll(/<em>(\d+)%<\/em>/g)].map(match=>Number(match[1]));
    assert.deepEqual(rendered,data.balance.mastery[rank].weights.slice(0,5));assert.match(html,/<b>VI<\/b><em>Merge<\/em>/);
    const next=economy.nextMastery();if(next)assert.match(html,new RegExp(`Next odds at Kingdom ${rank+2}`));else assert.match(html,/Maximum mastery reached/);
    assert.doesNotMatch(html,/<button|data-action="mastery"|gold/);
    assert.equal(JSON.stringify(economy),before);
  }
});

test('mastery advances at XP boundaries without gold and clearly applies to next-round draws',()=>{
  const economy=new EconomyManager(data.balance);economy.gold=0;
  economy.reward(0,data.balance.xpPerLevel-1);assert.equal(economy.mastery,0);
  economy.reward(0,1);assert.equal(economy.mastery,1);assert.equal(economy.gold,0);
  assert.match(masteryPanelMarkup(economy,data.balance),/Automatic · Kingdom 2/);
  assert.match(masteryPanelMarkup(economy,data.balance),/New odds apply next round/);
  const game=new Game(data,{seed:42});game.economy.reward(0,90);
  assert.equal(game.economy.mastery,1);assert.equal(game.draft.mastery,0);
  for(let x=10;x<15;x++)assert.ok(game.place(x,10));assert.ok(game.towers.every(t=>t.tier===1));
  game.keep();game.startCombat();game.completeWave();assert.equal(game.draft.mastery,1);
});

test('current friendly effects show exact values and actual named providers alongside different shape icons',()=>{
  const target=unit('mage',1),monk=unit('monk',2),nature=unit('mothernature',3),outOfRange=unit('sunward',4,1,30);
  const stock=[target,monk,nature,outOfRange],before=JSON.stringify({stock,data});
  const html=supportEffectsMarkup(target,stock,data,{phase:'ready'});
  assert.match(html,/Attack speed \+110%/);assert.match(html,/Damage \+50%/);assert.match(html,/From Monk #2/);
  assert.doesNotMatch(html,/#4/);assert.match(html,/data-glyph="clock"/);assert.match(html,/data-glyph="blade"/);
  const provider=selectedSupportMarkup(monk,stock,data,{phase:'ready'});
  assert.match(provider,/Projected by this defender/);assert.match(provider,/Support reach · 5 tiles/);
  assert.equal(JSON.stringify({stock,data}),before);
});

test('negative effects follow the combat clock and never persist in preparation or reveal hidden draft information',()=>{
  const target=unit('archer',1),enemy={id:1,name:'Warlord',type:'host_17',x:11,z:10,untouchable:.4,disarm:true};
  const ruin={...unit('soldier',2),state:'ruin',weakened:2};
  const combat={elapsed:0,enemies:[enemy]},stock=[target,ruin];
  const html=supportEffectsMarkup(target,stock,data,{phase:'combat',combat});
  assert.match(html,/Dread · attack speed −40%/);assert.match(html,/Disarmed · cannot attack/);
  assert.match(html,/Barricade disruption · attack speed −15%/);assert.match(html,/From Warlord #1/);
  assert.match(html,/data-glyph="spiral"/);assert.match(html,/data-glyph="brokenSword"/);assert.match(html,/data-glyph="crack"/);
  const disarmSvg=html.match(/<svg[^>]*data-glyph="brokenSword"[^>]*>(.*?)<\/svg>/)?.[1];
  assert.ok(disarmSvg);assert.match(disarmSvg,/<path/);assert.doesNotMatch(disarmSvg,/<circle/,'Legend shows a broken sword rather than the generic target fallback');
  assert.doesNotMatch(supportEffectsMarkup(target,stock,data,{phase:'ready',combat}),/Warlord|Disarmed|−40%/);
  assert.match(supportEffectsMarkup({...target,state:'draft'},stock,data,{phase:'combat',combat}),/Retain this defender/);
});

test('one provider winning multiple haste groups is named once, while separate tied providers remain visible',()=>{
  const target=unit('mage',1),monk=unit('monk',2),cleric=unit('cleric',3,4),otherMonk=unit('monk',4);
  const html=supportEffectsMarkup(target,[target,monk,cleric,otherMonk],data,{phase:'ready'});
  const haste=html.match(/<li[^>]*data-effect="haste"[\s\S]*?<\/li>/)[0];
  assert.equal((haste.match(/Monk #2/g)||[]).length,1);
  assert.equal((haste.match(/Monk #4/g)||[]).length,1);
  assert.equal((haste.match(/Cleric #3/g)||[]).length,1);
  assert.match(haste,/Attack speed \+110%/);
});

test('a real cloaked disarm invader shows the penalty without exposing its name or identity until revealed',()=>{
  const game=new Game(data,{seed:1}),target=unit('soldier',90,1,20);target.z=20;game.towers=[target];game.phase='combat';
  const enemy=game.combat.spawn('host_18');Object.assign(enemy,{id:71,x:22.5,z:20,cloaked:true});
  game.combat.elapsed=32-enemy.id*.37+.1;
  assert.equal(game.combat.isRevealed(enemy),false);
  const options={phase:game.phase,combat:game.combat},hidden=supportEffectsMarkup(target,game.towers,data,options);
  assert.match(hidden,/Disarmed · cannot attack/);assert.match(hidden,/From Unrevealed invader/);
  assert.doesNotMatch(hidden,/Silent Orc Executioners|host_18|#71/);
  assert.equal(enemy.cloaked,true,'rendering does not reveal the real enemy');
  enemy.x=21.5;assert.equal(game.combat.isRevealed(enemy),true);
  const visible=supportEffectsMarkup(target,game.towers,data,options);
  assert.match(visible,/From Silent Orc Executioners #71/);assert.doesNotMatch(visible,/Unrevealed invader/);
});

test('map legend names every shared support shape so color alone is not necessary',()=>{
  const html=supportMapLegendMarkup();
  for(const [key,style]of Object.entries(SUPPORT_EFFECT_STYLES)){
    assert.ok(html.includes(`data-effect="${key}"`));assert.ok(html.includes(`data-glyph="${style.glyph}"`));assert.ok(html.includes(style.label));
  }
  assert.match(html,/wall color follows the first listed effect; separate symbols show every active effect/);
  assert.match(html,/selected provider’s dashed circle/);
});

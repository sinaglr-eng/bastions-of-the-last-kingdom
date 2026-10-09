import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {campaignTowers} from '../game/core/campaign-roster.js';
import {towerStats,damageAfterDefense} from '../game/core/math.js';
import {recipeMatches,recipeCapabilities,recipeFilterControlsMarkup} from '../ui/recipe-filters.js';
import {defenderGuide} from '../ui/grimoire.js';
const data={towers:campaignTowers(JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url)))),balance:JSON.parse(readFileSync(new URL('../data/balance.json',import.meta.url)))};
const stats=(family,tier=1)=>towerStats({family,tier},data);
test('resistance filters agree with live damage channels and distinguish magic immunity from magic resistance',()=>{
  const magic=stats('frostwarden'),physical=stats('soldier'),nature=stats('rangermentor');
  assert.equal(recipeMatches(magic,{counter:'magic-resistance'}),false);
  assert.equal(recipeMatches(physical,{counter:'magic-immunity'}),true);
  assert.equal(recipeMatches(nature,{ability:'poison'}),true);
  assert.equal(recipeMatches(nature,{counter:'magic-immunity'}),false);
  assert.equal(recipeMatches(magic,{counter:'armor'}),true);
  assert.ok(damageAfterDefense(magic.damage,magic.type,{armor:1e5},magic,data.balance)>0);
});
test('secondary pure splash is discoverable through magic immunity without treating every splash as pure',()=>{
  assert.equal(recipeMatches(stats('frostblade'),{damage:'pure',counter:'magic-immunity'}),true);
  assert.equal(recipeMatches({...stats('mage'),cleaveType:'fire'},{damage:'pure'}),false);
  assert.equal(recipeMatches({damage:0,type:'fire',interval:1,burnAura:600,range:5},{counter:'magic-immunity'}),false);
  assert.equal(recipeMatches({damage:0,type:'fire',interval:1,burnAura:600,range:5},{ability:'burn',counter:'shields'}),true);
});
test('all four Ranger descendants advertise their conditional full flying bypass; ordinary Archers do not',()=>{
  for(const family of ['wyvernhunter','royalranger','kingsrangerguard','elvenking'])assert.equal(recipeMatches(stats(family),{counter:'air-defenses'}),true,family);
  assert.equal(recipeMatches(stats('archer'),{counter:'air-defenses'}),false);
  assert.equal(recipeMatches(stats('soldier'),{counter:'flying'}),false);
});
test('on-hit poison never claims to bypass a blocked physical primary hit; Cleric reveal uses live family context',()=>{
  assert.equal(recipeMatches(stats('mechanicalgolem'),{damage:'poison'}),true);
  assert.equal(recipeMatches(stats('mechanicalgolem'),{counter:'physical-immunity'}),false);
  assert.equal(recipeMatches(stats('cleric'),{counter:'hidden'},{family:'cleric'}),true);
  assert.equal(recipeMatches(stats('cleric'),{ability:'detection'},{family:'cleric'}),true);
  assert.equal(recipeMatches(stats('soldier'),{counter:'hidden'},{family:'soldier'}),false);
});
test('rank profiles can match individually, combined filters intersect, and copy states conditional effects',()=>{
  assert.equal(recipeMatches(stats('cleric',1),{ability:'slow'}),false);
  assert.equal(recipeMatches(stats('frostwarden',6),{ability:'slow'}),true);
  assert.equal(recipeMatches(stats('druid'),{ability:'poison',damage:'physical'}),false);
  assert.match(recipeFilterControlsMarkup(),/Ranger defense bypass applies only to flying enemies/);
  assert.match(recipeFilterControlsMarkup(),/aria-label="Against resistance"/);
  assert.match(defenderGuide(data,{}),/data-filter-family="druid"/);
  assert.match(defenderGuide(data,{}),/data-filter-tier="6"/);
  for(const [family,s]of Object.entries(data.towers))for(let tier=1;tier<=(s.advanced?1:6);tier++){
    const profile=stats(family,tier);assert.equal(recipeMatches(profile),true);const tags=recipeCapabilities(profile);assert.ok(tags.damage.size>0||s.aura,'live profile has actual damage or support: '+family);
  }
});

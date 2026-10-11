import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {campaignTowers} from '../game/core/campaign-roster.js';
import {towerStats,damageAfterDefense} from '../game/core/math.js';
import {recipeMatches,recipeCapabilities,recipeFilterControlsMarkup,RECIPE_FILTERS} from '../ui/recipe-filters.js';
import {defenderGuide} from '../ui/grimoire.js';
const data={towers:campaignTowers(JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url)))),balance:JSON.parse(readFileSync(new URL('../data/balance.json',import.meta.url)))};
const stats=(family,tier=1)=>towerStats({family,tier},data);
test('filters expose exactly Physical, Magical and Holy and classify real armor/immunity counters',()=>{
  assert.deepEqual(RECIPE_FILTERS.damage.map(([v])=>v),['physical','magical','holy']);
  assert.equal(recipeMatches(stats('soldier'),{counter:'magic-immunity'}),true);assert.equal(recipeMatches(stats('mage'),{counter:'physical-immunity'}),true);
  for(const counter of ['magic-immunity','physical-immunity'])assert.equal(recipeMatches(stats('cleric'),{counter}),true);
  assert.equal(recipeMatches(stats('mage'),{counter:'armor'}),false);assert.equal(recipeMatches(stats('runebreaker'),{counter:'armor'}),true);assert.equal(recipeMatches(stats('frostwarden'),{damage:'physical'}),true);
  for(const values of Object.values(RECIPE_FILTERS))assert.ok(!values.some(([v])=>['pure','magic-resistance','magic-shred','air-defenses'].includes(v)));
  assert.ok(damageAfterDefense(stats('cleric').damage,'holy',{armor:1e5,magicImmune:true,physicalImmune:true},stats('cleric'),data.balance)>0);
});

test('independent secondary and aura channels can counter immunity, while on-hit poison cannot invent a blocked primary',()=>{
  assert.equal(recipeMatches(stats('frostblade'),{damage:'physical',counter:'magic-immunity'}),true);assert.equal(recipeMatches(stats('mage'),{counter:'magic-immunity'}),false);
  assert.equal(recipeMatches({...stats('mage'),cleaveType:'holy'},{damage:'holy',counter:'magic-immunity'}),true);
  assert.equal(recipeMatches({damage:0,type:'magical',burnAura:600},{counter:'magic-immunity'}),false);
  assert.equal(recipeMatches({damage:0,type:'holy',burnAura:600},{counter:'magic-immunity'}),true);
  assert.equal(recipeMatches(stats('mechanicalgolem'),{damage:'magical',ability:'poison'}),true);assert.equal(recipeMatches(stats('mechanicalgolem'),{counter:'physical-immunity'}),false);
});

test('all four Rangers advertise normal air debuffs, never full defense bypass; ordinary Archers have no air armor debuff',()=>{
  for(const family of ['wyvernhunter','royalranger','kingsrangerguard','elvenking']){assert.equal(recipeMatches(stats(family),{ability:'slow',counter:'flying'}),true);assert.equal(recipeMatches(stats(family),{counter:'air-defenses'}),false);}
  assert.equal(recipeMatches(stats('archer'),{ability:'armor'}),false);assert.equal(recipeMatches(stats('soldier'),{counter:'flying'}),false);
});

test('only actual True Strike/support or non-direct fire aura counters evasion; Cleric detection uses actual family context',()=>{
  assert.equal(recipeMatches(stats('mage'),{counter:'evasion'}),false);assert.equal(recipeMatches(stats('cleric'),{counter:'evasion'}),false);
  assert.equal(recipeMatches(stats('mothernature'),{counter:'evasion'}),true);assert.equal(recipeMatches(stats('embercrown'),{counter:'evasion'}),true);
  assert.equal(recipeMatches(stats('cleric'),{counter:'hidden'},{family:'cleric'}),true);assert.equal(recipeMatches(stats('cleric'),{ability:'detection'},{family:'cleric'}),true);assert.equal(recipeMatches(stats('soldier'),{counter:'hidden'},{family:'soldier'}),false);
});

test('all86 real profiles match actual channels, combined filters intersect, and guide copy explains conditional effects without obsolete defenses',()=>{
  assert.equal(recipeMatches(stats('cleric',1),{ability:'slow'}),false);assert.equal(recipeMatches(stats('frostwarden',6),{ability:'slow'}),true);assert.equal(recipeMatches(stats('druid'),{ability:'poison',damage:'physical'}),false);
  const copy=recipeFilterControlsMarkup(),guide=defenderGuide(data,{});assert.match(copy,/initial damaging hit/);assert.match(copy,/armor, evasion, shields and shells still apply/);assert.match(copy,/aria-label="Against defense"/);assert.doesNotMatch(copy,/Ranger defense bypass|Magic resistance|Pure/);
  assert.match(guide,/data-filter-family="druid"/);assert.match(guide,/data-filter-tier="6"/);assert.match(guide,/independent 5s stack/);assert.doesNotMatch(guide,/strongest poison|pure secondary|magic-resistance reduction/);
  let n=0;for(const [family,d]of Object.entries(data.towers))for(let tier=1;tier<=(d.advanced?1:6);tier++){const profile=stats(family,tier),tags=recipeCapabilities(profile);assert.equal(recipeMatches(profile),true);assert.ok(tags.damage.size>0||d.aura);for(const type of tags.damage)assert.ok(['physical','magical','holy'].includes(type));n++;}assert.equal(n,86);
});

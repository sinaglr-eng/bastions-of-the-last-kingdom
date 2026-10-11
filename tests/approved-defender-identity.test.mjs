import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {campaignTowers,campaignRecipes,CAMPAIGN_COMBAT_OVERRIDES,CAMPAIGN_ABILITY_DESCRIPTIONS} from '../game/core/campaign-roster.js';
import {canonicalCombatStats} from '../game/core/combat-rules.js';
import {APPROVED_DEFENDER_NAMES,APPROVED_CHAMPION_DESCRIPTIONS} from '../game/core/approved-defender-names.js';
const load=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const historical=load('data/towers.json'),recordings=load('docs/audio/generated-allied-audio-recast-20261011.json');
const gameplay=definition=>Object.fromEntries(Object.entries(definition).filter(([key])=>!['name','short','description'].includes(key)));

test('all 46 live identities match the approved reconstruction names and all 92 current voice identities',()=>{
  const original=JSON.stringify(historical),live=campaignTowers(historical);
  assert.equal(Object.keys(APPROVED_DEFENDER_NAMES).length,46);
  assert.equal(new Set(Object.values(APPROVED_DEFENDER_NAMES)).size,46);
  for(const [id,name] of Object.entries(APPROVED_DEFENDER_NAMES)){
    assert.equal(live[id].name,name,id);assert.equal(live[id].short,name,id);
    const overrides=CAMPAIGN_COMBAT_OVERRIDES[id]||{},expected=canonicalCombatStats({...gameplay(historical[id]),projectileEffect:historical[id].type,...overrides});
    if(historical[id].levels)expected.levels=historical[id].levels.map(level=>canonicalCombatStats({...level,type:expected.type,projectileEffect:expected.projectileEffect,...(overrides.cleaveType?{cleaveType:overrides.cleaveType}:{})}));
    assert.deepEqual(gameplay(live[id]),expected,id+' identity changes preserve unrelated gameplay properties');
    const clips=recordings.clips.filter(clip=>clip.character_id===id);assert.equal(clips.length,2,id);
    for(const clip of clips)assert.equal(clip.character,name,id+' approved recorded identity');
  }
  assert.equal(JSON.stringify(historical),original,'historical source must stay unmodified');
  assert.equal(live.rangermentor.name,'Nature Spirit');assert.equal(live.mechanicalgolem.name,'Dwarship');assert.equal(live.royalarsenal.name,'Elven King');
  assert.equal(live.lordbernhard,undefined);
});

test('all 38 champion descriptions use current approved copy while stable recipes stay unchanged',()=>{
  const live=campaignTowers(historical),recipes=load('data/recipes.json'),original=JSON.stringify(recipes);
  assert.equal(Object.keys(APPROVED_CHAMPION_DESCRIPTIONS).length,38);
  for(const [id,description] of Object.entries(APPROVED_CHAMPION_DESCRIPTIONS)){assert.equal(live[id].description,CAMPAIGN_ABILITY_DESCRIPTIONS[id]||description.replace(/\b[Aa]rcane\b/g,'Magical').replace(/\bpure\b/gi,live[id].cleaveType==='physical'?'Physical':'Magical'));assert.equal(live[id].advanced,true);}
  assert.ok(!/bear king/i.test(live.rangermentor.description));
  assert.deepEqual(campaignRecipes(recipes),recipes.filter(recipe=>(recipe.resultFamily||recipe.id)!=='lordbernhard'));
  assert.equal(JSON.stringify(recipes),original);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {enemyDefenseGlyph,enemyTraitsMarkup,waveDefenseLegendMarkup} from '../ui/enemy-trait-symbols.js';
import {ENEMY_DEFENSE_SYMBOLS} from '../game/render/enemy-defense-symbols.js';
import {warbandTraitDetails,warbandTraits,currentWarbandInfo} from '../game/core/warband-info.js';
const enemies=JSON.parse(readFileSync(new URL('../data/enemies.json',import.meta.url)));

test('wave descriptions pair each defense with the exact colored 3D silhouette',()=>{
  for(const [kind,symbol]of Object.entries(ENEMY_DEFENSE_SYMBOLS)){
    const markup=enemyDefenseGlyph(kind);
    assert.ok(markup.includes(`data-defense="${kind}"`));assert.ok(markup.includes(symbol.color));
    for(const path of symbol.svgPaths)assert.ok(markup.includes(`d="${path}"`));
  }
  for(const enemy of Object.values(enemies)){
    const details=warbandTraitDetails(enemy);
    assert.deepEqual(details.map(row=>row.text),warbandTraits(enemy));
    const markup=enemyTraitsMarkup(details);
    for(const row of details)if(row.kind)assert.ok(markup.includes(`data-defense="${row.kind}"`));
  }
  assert.match(enemyTraitsMarkup(warbandTraitDetails(enemies.host_14)),/data-defense="refraction"[^]*3 hit-blocking shields/);
  const noAbility=enemyTraitsMarkup(warbandTraitDetails({armor:22}));
  assert.ok(noAbility.includes('No special resistances or abilities'));assert.ok(!noAbility.includes('<svg'));
});

test('current chosen variant and previews describe capabilities without exposing hidden locations',()=>{
  const game={wave:{groups:[{type:'host_31',count:1}]},data:{enemies},combat:{enemies:[],spawnQueue:[{type:'host_31',modifiers:{variant:enemies.host_31.variants[1]}}]}};
  const info=currentWarbandInfo(game)[0],markup=enemyTraitsMarkup(info.traitDetails);
  assert.ok(markup.includes('data-defense="physicalImmune"'));assert.ok(!markup.includes('data-defense="magicImmune"'));
  assert.ok(markup.includes('data-defense="refraction"'));
  assert.ok(!('x' in info)&&!('z' in info)&&!('enemy' in info));
  const legend=waveDefenseLegendMarkup({...enemies.host_31,...enemies.host_31.variants[1]});
  assert.ok(legend.includes('Physical immunity')&&legend.includes('Direct-hit shields'));
  assert.equal(waveDefenseLegendMarkup({armor:999}), '');
  assert.ok(enemyTraitsMarkup([{kind:null,text:'<unsafe & "text">'}]).includes('&lt;unsafe &amp; &quot;text&quot;&gt;'));
});

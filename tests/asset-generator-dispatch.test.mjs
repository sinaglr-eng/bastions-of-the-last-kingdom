import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=name=>readFileSync(new URL(`../blender/scripts/${name}.py`,import.meta.url),'utf8');

test('default full generation routes native builders before historical finalization, with legacy art available only by explicit flag',()=>{
  const army=source('author_army');
  const forward=army.indexOf('return author_defenders_v8.generate(render=render,family=family)'),old=army.indexOf('articulation.finalize(fam)');
  assert.match(army,/if '--legacy-art' not in sys.argv:/);assert.ok(forward>=0&&forward<old);
});

test('explicit historical generation keeps secrets outside generic human finalization',()=>{
  const army=source('author_army');
  assert.match(army,/secret_families=\[f for f in families if DATA\[f\]\.get\('secret'\)\]/);
  assert.match(army,/for fam in \(f for f in families if f not in secret_families\):/);
  assert.match(army,/author_secret_champions\.OUT=OUT/);
  assert.match(army,/author_secret_champions\.army=sys\.modules\[__name__\]/);
  assert.match(army,/author_secret_champions\.generate\(render=render,family=','\.join\(secret_families\)\)/);
});

test('legacy procedural export skips and preserves both secrets and ordinary native assets, including native Archer',()=>{
  const legacy=source('generate_assets');
  assert.match(legacy,/secret_families=\{'ladyclaire','lordbernhard'\}/);
  const skip=legacy.indexOf("if hero['family'] in secret_families: continue");
  const exportDefender=legacy.indexOf("export(name,'tower'");
  assert.ok(skip>=0&&skip<exportDefender,'The fallback mesh export must never touch a secret asset');
  assert.match(legacy,/manifest\+preserved_secrets\+preserved_native/);
  assert.match(legacy,/entry.get\('style'\)=='designed-defenders-v8'/);
  assert.ok(legacy.indexOf("if hero['family'] in native_families: continue")<exportDefender);
  assert.match(legacy,/if 'archer' not in native_families:author_archer.generate\(render=False\)/);
  assert.ok(legacy.indexOf('preserved_secrets=')<legacy.indexOf("for hero in json.loads(hero_source.read_text())"));
});

test('the native production dispatcher covers every available family, excludes hidden defaults, and merges only matching family/rank rows',()=>{
  const dispatch=source('author_defenders_v8'),human=source('defender_humans_v8'),creature=source('defender_creatures_v8'),engine=source('defender_engines_v8');
  assert.match(dispatch,/requested = family.split\(',\'\) if family else \[key for key, tower in DATA.items\(\) if not tower.get\('hidden'\)\]/);
  assert.match(dispatch,/humans.generate\(human_families, render=render\)/);assert.match(dispatch,/creatures.generate\(creature_families, render=render\)/);
  assert.match(dispatch,/author_secret_champions.generate\(render=render, family=','.join\(secret_families\)\)/);
  assert.match(dispatch,/entry.get\('family'\) == row\['family'\][\s\S]*entry.get\('tier'\) == row\['tier'\]/);
  assert.match(dispatch,/if handled != set\(requested\):/);
  const towers=JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url)));
  const assigned=[...human.matchAll(/^(?:BASIC|FAMILIES)=\[([^\n]+)\]/gm),...creature.matchAll(/^FAMILIES=\{([^\n]+)\}/gm),...engine.matchAll(/^FAMILIES=\{([^\n]+)\}/gm)].flatMap(match=>[...match[1].matchAll(/'([^']+)'/g)].map(part=>part[1]));
  for(const [family,tower]of Object.entries(towers).filter(([,tower])=>!tower.hidden&&!tower.secret))assert.equal(assigned.filter(id=>id===family).length,1,family+' needs exactly one native builder');
});

test('historical enemy regeneration dispatches the final boss before the static builder and preserves unrelated selected enemies',()=>{
  const enemies=source('author_enemies_v3');
  assert.match(enemies,/native_final=\[item\[0\] for item in selected if item\[0\].split\('-'\)\[0\]=='host_50'\]/);
  assert.match(enemies,/final_boss_v4.run\(\)/);assert.match(enemies,/selected=\[item for item in selected if item\[0\] not in native_final\]/);
  assert.ok(enemies.indexOf('final_boss_v4.run()')<enemies.indexOf('selected=[item for item in selected if item[0] not in native_final]'));
});

test('dedicated native secret authoring accepts family/no-render flags and preserves unrelated manifest records',()=>{
  const secret=source('author_secret_champions');
  assert.match(secret,/def generate\(render=True,family=None\):/);
  assert.match(secret,/if family not in requested:continue/);
  assert.match(secret,/if render:\s+portrait=/);
  assert.match(secret,/render='--no-render' not in sys.argv/);
  assert.match(secret,/generate\(render=render,family=family\)/);
  assert.match(secret,/entry.get\('kind'\)=='tower' and entry.get\('family'\)==family/);
  assert.match(secret,/asset_version='designed-defenders-v8' if family=='ladyclaire' else ART_VERSION/);
  assert.match(secret,/design_revision=11 if family=='ladyclaire' else DESIGN_REVISION/);
  assert.match(secret,/scene\['AssetRevision'\]=asset_version/);
  assert.match(secret,/root\['assetRevision'\]=asset_version/);
  assert.match(secret,/assetRevision=asset_version[\s\S]*designRevision=design_revision/);
});

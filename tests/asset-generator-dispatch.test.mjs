import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=name=>readFileSync(new URL(`../blender/scripts/${name}.py`,import.meta.url),'utf8');

test('full defender generation dispatches secret native rigs outside generic human finalization',()=>{
  const army=source('author_army');
  assert.match(army,/secret_families=\[f for f in families if DATA\[f\]\.get\('secret'\)\]/);
  assert.match(army,/for fam in \(f for f in families if f not in secret_families\):/);
  assert.match(army,/author_secret_champions\.OUT=OUT/);
  assert.match(army,/author_secret_champions\.army=sys\.modules\[__name__\]/);
  assert.match(army,/author_secret_champions\.generate\(render=render,family=','\.join\(secret_families\)\)/);
});

test('legacy procedural export skips secret GLBs and preserves their manifest until native dispatch completes',()=>{
  const legacy=source('generate_assets');
  assert.match(legacy,/secret_families=\{'ladyclaire','lordbernhard'\}/);
  const skip=legacy.indexOf("if hero['family'] in secret_families: continue");
  const exportDefender=legacy.indexOf("export(name,'tower'");
  assert.ok(skip>=0&&skip<exportDefender,'The fallback mesh export must never touch a secret asset');
  assert.match(legacy,/manifest\+preserved_secrets/);
  assert.ok(legacy.indexOf('preserved_secrets=')<legacy.indexOf("for hero in json.loads(hero_source.read_text())"));
});

test('dedicated native secret authoring accepts family/no-render flags and preserves unrelated manifest records',()=>{
  const secret=source('author_secret_champions');
  assert.match(secret,/def generate\(render=True,family=None\):/);
  assert.match(secret,/if family not in requested:continue/);
  assert.match(secret,/if render:\s+portrait=/);
  assert.match(secret,/render='--no-render' not in sys.argv/);
  assert.match(secret,/generate\(render=render,family=family\)/);
  assert.match(secret,/entry.get\('kind'\)=='tower' and entry.get\('family'\)==family/);
});

test('full roster regeneration routes basic families to the faceted generator before generic human finalization',()=>{
  const army=source('author_army');
  assert.match(army,/basic_families=\[f for f in families if f in BASIC\]/);
  assert.match(army,/author_defender_turnarounds_v3\.OUT=OUT/);
  assert.match(army,/author_defender_turnarounds_v3\.generate\('\,'\.join\(basic_families\),render=render,publish=True\)/);
  const dispatch=army.indexOf('author_defender_turnarounds_v3.generate('),exclude=army.indexOf('families=[f for f in families if f not in BASIC]');
  assert.ok(dispatch>=0&&exclude>dispatch);
  assert.ok(exclude<army.indexOf('articulation.finalize(fam)',dispatch),'Generic smooth anatomy must never replace the faceted basic ranks');
});

test('dedicated turnaround authoring stages verified selected ranks and publishes without replacing other manifest records',()=>{
  const basic=source('author_defender_turnarounds_v3');
  assert.match(basic,/def generate\([^)]*families=None[^)]*render=True[^)]*publish=False[^)]*\):/);
  assert.match(basic,/export_extras=True/);
  assert.match(basic,/use_selection=True/);
  assert.match(basic,/export_cameras=False,export_lights=False/);
  assert.match(basic,/export\(b,EXPORTS\/filename\)/);
  assert.match(basic,/roundtrip\(EXPORTS\/filename,game_metrics,family,rank\)/);
  const verify=basic.indexOf('verified=roundtrip('),publish=basic.indexOf('if publish:');
  assert.ok(verify>=0&&publish>verify,'GLBs must be verified before copying into live assets');
  assert.match(basic,/shutil\.copyfile\(EXPORTS\/entry\['file'\],OUT\/entry\['file'\]\)/);
  assert.match(basic,/e\.get\('family'\)==family and e\.get\('tier'\)==rank/);
  assert.match(basic,/parser\.add_argument\('--family'\)/);
  assert.match(basic,/parser\.add_argument\('--no-render',action='store_true'\)/);
  assert.match(basic,/parser\.add_argument\('--publish-assets',action='store_true'\)/);
  assert.match(basic,/generate\(args\.family,not args\.no_render,args\.quick,[^\n]*publish=args\.publish_assets\)/);
});

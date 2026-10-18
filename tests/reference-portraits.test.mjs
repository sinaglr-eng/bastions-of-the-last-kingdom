import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {referencePortrait,referenceDefenderPortrait,referenceEnemyPortrait,referencePortraitImageMap,REFERENCE_PORTRAIT_REVISION,ENEMY_FRONT_PORTRAIT_REVISION,ORIGINAL_REFERENCE_PORTRAIT_REVISION} from '../ui/reference-portraits.js';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const sources=json('../docs/ui-cartographers-table-handoff-20261016/PORTRAIT_SOURCES.json');
const manifest=json('../public/assets/ui/reference-portraits/manifest.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('the UI catalogue resolves all and only 136 approved exact identities under root and project bases',()=>{
  assert.equal(sources.rows.length,136);
  const ids=new Set();
  for(const row of sources.rows){
    ids.add(row.id);
    const options={base:'/bastions-of-the-last-kingdom/'};
    const enemy=row.category==='enemies',expected=`/bastions-of-the-last-kingdom/assets/ui/${enemy?'reference-enemy-fronts':'reference-cutouts'}/${row.id}.png?v=${enemy?ENEMY_FRONT_PORTRAIT_REVISION:REFERENCE_PORTRAIT_REVISION}`;
    assert.equal(referencePortrait(row.id,options),expected);
    assert.equal(row.category==='enemies'?referenceEnemyPortrait(row.id,options):referenceDefenderPortrait(row.family,row.tier??1,options),expected,row.id);
    assert.equal(referencePortrait(row.id,{base:'/'}),expected.replace('/bastions-of-the-last-kingdom/','/'));
  }
  assert.equal(ids.size,136);
  for(const id of ['',null,undefined,'unknown','unrevealed','host_00','host_51','soldier-0','soldier-7','../soldier-1','mage-1.png'])assert.equal(referencePortrait(id),null);
});

test('rank and fixed-champion lookup never falls back to another identity',()=>{
  for(const rank of [0,7,-1,NaN,Infinity,'1',null])assert.equal(referenceDefenderPortrait('archer',rank),null);
  assert.equal(referenceDefenderPortrait('missing',1),null);
  assert.equal(referenceDefenderPortrait('ladyclaire',2),null);
  assert.equal(referenceEnemyPortrait('soldier-1'),null);
  assert.equal(referenceDefenderPortrait('host_01'),null);
  assert.match(referenceDefenderPortrait('mage',4),/\/mage-4\.png\?v=/);
  assert.match(referenceDefenderPortrait('ladyclaire'),/\/ladyclaire\.png\?v=/);
  assert.match(referenceEnemyPortrait('host_50'),/\/reference-enemy-fronts\/host_50\.png\?v=/);
});

test('image-map aliases preserve current consumers without reserving an unknown or wall identity',()=>{
  const images=referencePortraitImageMap({base:'/project',revision:'ui review 2'});
  assert.equal(Object.keys(images).length,182);
  assert.equal(images.archer,images['archer:1']);assert.notEqual(images['archer:1'],images['archer:2']);
  assert.equal(images.frostblade,images['frostblade:1']);assert.equal(images['frostblade:2'],undefined);
  assert.equal(images['enemy:host_50'],'/project/assets/ui/reference-enemy-fronts/host_50.png?v=ui%20review%202');
  assert.equal(images.unknown,undefined);assert.equal(images.ruin,undefined);assert.equal(images.reserved,undefined);
  const wall='data:image/png;base64,existing-wall';assert.equal({...images,ruin:wall}.ruin,wall);
  assert.notEqual(images,referencePortraitImageMap());
});

test('every delivered PNG and its immutable source matches exact crop provenance',()=>{
  assert.equal(manifest.revision,ORIGINAL_REFERENCE_PORTRAIT_REVISION);
  assert.equal(manifest.identities.length,136);
  assert.deepEqual(manifest.identities.map(row=>row.id).sort(),sources.rows.map(row=>row.id).sort());
  const expected=new Map(sources.rows.map(row=>[row.id,row])),checkedSources=new Set();
  for(const row of manifest.identities){
    const original=expected.get(row.id);
    assert.equal(row.sourceSha256,original.sha256);assert.equal(row.name,original.name);
    assert.equal(row.reviewStatus,'approved',`${row.id} requires its own visual review`);
    const [x,y,width,height]=row.rectangle;
    assert.ok(x>=0&&y>=0&&width>0&&height>0&&x+width<=original.width&&y+height<=original.height,row.id);
    assert.deepEqual(row.dimensions,[width,height]);
    assert.notDeepEqual([width,height],[original.width,original.height],`${row.id} must not use an entire board`);
    const output=readFileSync(new URL(`../${row.output}`,import.meta.url));
    assert.equal(output.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(output.readUInt32BE(16),width);assert.equal(output.readUInt32BE(20),height);
    assert.equal(hash(output),row.sha256,row.id);
    if(!checkedSources.has(row.sourceSha256)){
      assert.equal(hash(readFileSync(new URL(`../${row.sourceFile}`,import.meta.url))),row.sourceSha256);
      checkedSources.add(row.sourceSha256);
    }
  }
  assert.equal(checkedSources.size,107);
});

test('the English review gallery links each actual exported identity from its own directory',()=>{
  const gallery=new URL('../output/design/cartographer-ui-v040-20261016/portraits/index.html',import.meta.url);
  const markup=readFileSync(gallery,'utf8');
  assert.match(markup,/<html lang="en">/);
  const images=[...markup.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/g)];assert.equal(images.length,136);
  for(let index=0;index<images.length;index++){
    const image=readFileSync(new URL(images[index][1],gallery));assert.equal(hash(image),manifest.identities[index].sha256);
  }
});

test('champions sharing a source board have individual named-subject crops and distinct output pixels',()=>{
  const groups=Map.groupBy(manifest.identities.filter(row=>row.category==='champions'),row=>row.sourceSha256);
  for(const rows of groups.values()){
    assert.equal(new Set(rows.map(row=>JSON.stringify(row.rectangle))).size,rows.length);
    assert.equal(new Set(rows.map(row=>row.sha256)).size,rows.length);
    for(const row of rows)assert.equal(row.view,'Exact named subject on current-model authoring concept board');
  }
  const claire=manifest.identities.find(row=>row.id==='ladyclaire');
  assert.equal(claire.view,'Full isometric subject, left panel');assert.ok(claire.rectangle[0]+claire.rectangle[2]<700);
});

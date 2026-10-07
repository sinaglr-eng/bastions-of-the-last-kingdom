import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('all 136 active Atelier references resolve to exact approved source bytes and historical references remain intact',()=>{
 const references=JSON.parse(readFileSync(new URL('../public/assets/geometric/source-manifest.json',import.meta.url)));
 const assets=['defenders','champions','enemies'].flatMap(kind=>{const m=JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-'+kind+'.json',import.meta.url)));return m.entries||m.assets;});
 assert.equal(references.length,136);assert.equal(new Set(references.map(row=>row.id)).size,136);
 for(const reference of references){
  assert.ok(!reference.file.includes('..')&&/\.(?:png|jpe?g)$/i.test(reference.file),reference.id);
  const asset=assets.find(row=>row.id===reference.id),active=reference.currentModelReconstruction;
  const published=active?(reference.publicPath||'assets/geometric/'+reference.file):'geometric-turnarounds-v1/'+reference.file;
  const bytes=readFileSync(new URL('../public/'+published,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),reference.sha256,reference.id);
  assert.equal(asset.sourceSha256,reference.sha256,reference.id);
  if(active){
   assert.equal(active.revision,asset.reconstruction.revision);
   assert.equal(active.assetSha256,asset.assetSha256);
   assert.equal(active.approvedAuthoringReference.sha256,reference.sha256,reference.id+' current V7/V8 concept');
   assert.equal(asset.reconstruction.approvedAuthoringReference.sha256,reference.sha256,reference.id+' immutable approved authoring origin');
   assert.equal(published,'assets/geometric/'+asset.reconstruction.publishedReferenceFile,reference.id+' same active Atelier reference');
   const historic=reference.historicalReference;assert.ok(historic,reference.id+' previous source evidence is retained');
   const original=readFileSync(new URL('../public/geometric-turnarounds-v1/'+historic.file,import.meta.url));
   assert.equal(createHash('sha256').update(original).digest('hex'),historic.sha256,reference.id+' historical source bytes');
  }
 }
 const claire=references.find(row=>row.id==='ladyclaire');
 if(claire.currentModelReconstruction)assert.equal(claire.sha256,'fe3efca32ea3dca269f1f6b64213197526dc4e3641e78553eaf82fa3c3a8bc56','Claire current approved V8 concept');
 else assert.equal(claire.file,'claire/ladyclaire.png');
});

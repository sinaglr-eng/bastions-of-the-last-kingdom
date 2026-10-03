import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('all136 original Atelier source links resolve to their exact measured reference bytes, including Claire',()=>{
 const references=JSON.parse(readFileSync(new URL('../public/assets/geometric/source-manifest.json',import.meta.url)));
 const assets=['defenders','champions','enemies'].flatMap(kind=>{const m=JSON.parse(readFileSync(new URL('../public/assets/geometric/geometric-'+kind+'.json',import.meta.url)));return m.entries||m.assets;});
 assert.equal(references.length,136);assert.equal(new Set(references.map(row=>row.id)).size,136);assert.equal(references.find(row=>row.id==='ladyclaire').file,'claire/ladyclaire.png');
 for(const reference of references){
  assert.ok(!reference.file.includes('..')&&reference.file.endsWith('.png'),reference.id);
  const bytes=readFileSync(new URL('../public/geometric-turnarounds-v1/'+reference.file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),reference.sha256,reference.id);
  assert.equal(assets.find(row=>row.id===reference.id).sourceSha256,reference.sha256,reference.id);
 }
});

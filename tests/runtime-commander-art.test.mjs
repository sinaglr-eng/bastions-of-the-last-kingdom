import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ARTIFACT_CATALOG as C} from '../game/core/artifacts.js';
import {packageRuntimeAssets} from '../tools/package-runtime-assets.mjs';

test('production packaging includes every current artifact and both recipe category images; missing categories fail the build',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'td-runtime-commander-')),source=path.join(root,'public');
 const write=(file,bytes)=>{const destination=path.join(source,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);};
 try{
  const generated=JSON.parse(fs.readFileSync('public/assets/ui/commander-generated/manifest.json')),hud=JSON.parse(fs.readFileSync('public/assets/ui/hud-generated/manifest.json'));
  write('assets/ui/commander-generated/manifest.json',JSON.stringify(generated));write('assets/ui/hud-generated/manifest.json',JSON.stringify(hud));write('assets/geometric/geometric-enemies.json',JSON.stringify({assets:[]}));
  const categories=['assets/ui/commander-feedback/champions.webp','assets/ui/commander-feedback/basic-defenders.webp'];
  const required=[...C.artifacts.map(a=>a.art),...C.chests.flatMap(c=>[c.art,c.openArt]),...generated.icons.map(i=>i.file),...hud.icons.map(i=>i.file),'assets/ui/commander-v080/silhouette-commander.webp',...categories];
  for(const file of required)write(file,fs.readFileSync('public/'+file));
  const receipt=packageRuntimeAssets({root}),copied=new Set(receipt.assets.map(row=>row.file));
  for(const file of required){assert.ok(copied.has(file),file);assert.deepEqual(fs.readFileSync(path.join(root,'dist',file)),fs.readFileSync('public/'+file));}
  for(const file of categories){fs.unlinkSync(path.join(source,file));assert.throws(()=>packageRuntimeAssets({root}),/Missing current Commander art/);write(file,fs.readFileSync('public/'+file));}
 }finally{
  const resolved=path.resolve(root),parent=path.resolve(os.tmpdir());assert.equal(path.dirname(resolved),parent);assert.ok(path.basename(resolved).startsWith('td-runtime-commander-'));fs.rmSync(resolved,{recursive:true,force:true});
 }
});

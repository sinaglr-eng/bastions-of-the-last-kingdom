import test from 'node:test';
import assert from 'node:assert/strict';
import {siteUrl} from '../game/site-url.js';

test('runtime assets and page links stay inside a GitHub project deployment',()=>{
  const base='/bastions-of-the-last-kingdom/';
  for(const path of ['assets/models/human_archer_t1.glb','assets/enemies/manifest.json','assets/army/dawnseraph-t1.png','archer.html','?update=cohesive']) {
    assert.equal(siteUrl(path,base),base+path);
    assert.equal(siteUrl('/'+path,base),base+path);
  }
  assert.equal(siteUrl('',base),base);
  assert.equal(siteUrl('archer.html',base.slice(0,-1)),base+'archer.html');
});

test('the default root deployment also works when the helper is imported by Node',()=>{
  assert.equal(siteUrl('assets/models/manifest.json'),'/assets/models/manifest.json');
  assert.equal(siteUrl('/archer.html'),'/archer.html');
  assert.equal(siteUrl(),'/');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {siteUrl} from '../game/site-url.js';
import {DEFENDER_ART_VERSION,defenderPortrait,releaseAsset} from '../game/release.js';

test('runtime assets and page links stay inside a GitHub project deployment',()=>{
  const base='/bastions-of-the-last-kingdom/';
  for(const path of ['assets/geometric/defenders/archer-1.glb','assets/geometric/geometric-enemies.json','assets/geometric/portraits/dawnspire.png','archer.html','?update=cohesive']) {
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

test('all defenders share rank portrait routes and the new art release bypasses cached old assets',()=>{
  for(const family of ['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller']){
    for(let rank=1;rank<=6;rank++)assert.equal(defenderPortrait(family,rank),`/assets/geometric/portraits/${family}-${rank}.png?v=${DEFENDER_ART_VERSION}`);
  }
  assert.equal(defenderPortrait('ladyclaire'),`/assets/geometric/portraits/ladyclaire.png?v=${DEFENDER_ART_VERSION}`);
  assert.ok(!DEFENDER_ART_VERSION.includes('rollback'));
  assert.equal(releaseAsset('assets/models/manifest.json'),`/assets/models/manifest.json?v=${DEFENDER_ART_VERSION}`);
});

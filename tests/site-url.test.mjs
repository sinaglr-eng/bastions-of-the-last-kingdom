import test from 'node:test';
import assert from 'node:assert/strict';
import {siteUrl} from '../game/site-url.js';
import {GAME_VERSION,DEFENDER_ART_VERSION,CHAMPION_ART_VERSION,ENEMY_ART_VERSION,defenderPortrait,enemyPortrait,releaseAsset} from '../game/release.js';

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
  assert.equal(defenderPortrait('ladyclaire'),`/assets/geometric/portraits/ladyclaire.png?v=${CHAMPION_ART_VERSION}`);
  assert.ok(!DEFENDER_ART_VERSION.includes('rollback'));
  assert.equal(releaseAsset('assets/models/manifest.json'),`/assets/models/manifest.json?v=${DEFENDER_ART_VERSION}`);
});

test('the revised enemy native export, portrait and manifest bypass the old enemy cache together',()=>{
  for(const path of ['assets/geometric/geometric-enemies.json','assets/geometric/enemies/host_09.glb'])assert.equal(releaseAsset(path),`/${path}?v=${ENEMY_ART_VERSION}`);
  assert.equal(enemyPortrait('host_09'),`/assets/geometric/portraits/host_09.png?v=${ENEMY_ART_VERSION}`);
  assert.notEqual(ENEMY_ART_VERSION,DEFENDER_ART_VERSION);
});

test('reconstructed basic and champion models refresh independently without changing enemy revisions',()=>{
  assert.equal(DEFENDER_ART_VERSION,'basic-defenders-v7');
  assert.equal(CHAMPION_ART_VERSION,'champions-v8');
  for(const path of ['assets/geometric/geometric-defenders.json','assets/geometric/defenders/archer-6.glb'])assert.equal(releaseAsset(path),'/' + path + '?v=' + DEFENDER_ART_VERSION);
  for(const path of ['assets/geometric/geometric-champions.json','assets/geometric/champions/rimewatch.glb'])assert.equal(releaseAsset(path),'/' + path + '?v=' + CHAMPION_ART_VERSION);
  assert.notEqual(CHAMPION_ART_VERSION,DEFENDER_ART_VERSION);
  assert.equal(releaseAsset('assets/geometric/source-manifest.json'),'/assets/geometric/source-manifest.json?v='+GAME_VERSION);
});

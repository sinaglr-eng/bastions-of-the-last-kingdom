import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {currentWarbandInfo} from '../game/core/warband-info.js';
import {currentWarbandContents} from '../ui/current-warband.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));

test('the actual mixed immunity warband renders separate counts and abilities, and removes defeated invaders from its displayed totals',()=>{
  const game=new Game(data,{seed:42});game.round=31;game.phase='combat';game.combat.start(game.wave);
  const initial=currentWarbandInfo(game),total=game.combat.total;
  assert.equal(initial.length,2,'This seeded real wave includes both independently selected immunity variants');
  assert.equal(initial.reduce((sum,row)=>sum+row.count,0),total);
  const html=currentWarbandContents(initial),articles=html.match(/<article>[^]*?<\/article>/g);
  assert.equal(articles.length,2);
  for(const row of initial){
    const article=articles.find(text=>text.includes(row.name));
    assert.ok(article.includes(`${row.count} × ${row.name}`));
    assert.equal(article.includes('Immune to magic and magical effects'),row.traits.includes('Immune to magic and magical effects'));
    assert.equal(article.includes('Immune to physical and piercing damage'),row.traits.includes('Immune to physical and piercing damage'));
  }
  const queued=game.combat.spawnQueue.shift(),enemy=game.combat.spawn(queued.type,queued.modifiers);
  assert.equal(currentWarbandContents(currentWarbandInfo(game)),html,'Moving an actual scheduled invader to the battlefield preserves the displayed composition');
  enemy.dead=true;
  const after=currentWarbandInfo(game),changed=after.find(row=>row.name===enemy.name);
  assert.equal(after.reduce((sum,row)=>sum+row.count,0),total-1);
  assert.equal(changed.count,initial.find(row=>row.name===enemy.name).count-1);
  assert.ok(currentWarbandContents(after).includes(`${changed.count} × ${changed.name}`));
  game.combat.spawnQueue=[];assert.equal(currentWarbandContents(currentWarbandInfo(game)),'','An exhausted real wave has no phantom variant rows');
});

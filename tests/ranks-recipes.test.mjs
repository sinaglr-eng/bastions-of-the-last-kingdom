import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats,supportBonuses} from '../game/core/math.js';
import {recipeFamily,recipeTier} from '../game/core/recipes.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const unit=(family,tier=1,id=1,x=10,z=10)=>({id,family,tier,x,z,state:'active',kills:0,cooldown:0});
function arena(){const g=new Game(data,{seed:42});g.phase='combat';g.combat.spawnQueue=[{time:9999,type:'grunt'}];return g;}
function enemy(g,x,z){const e=g.combat.spawn('grunt');Object.assign(e,{x,z,hp:10000,maxHp:10000,speed:0});return e;}

test('all eight gem identities have six finite, distinct rank profiles',()=>{
  const gems=new Set();
  for(const [family,s]of Object.entries(data.towers).filter(([,s])=>!s.advanced)){
    gems.add(s.referenceGem);assert.equal(s.levels.length,6);
    for(let tier=1;tier<=6;tier++){const t=towerStats(unit(family,tier),data);assert.ok(t.damage>=0&&Number.isFinite(t.damage));assert.ok(t.interval>0&&t.range>0);if(tier>1)assert.ok(t.damage>=s.levels[tier-2].damage);}
  }
  assert.equal(gems.size,8);assert.equal(towerStats(unit('archer',6),data).interval,.1);assert.equal(towerStats(unit('stormcaller',6),data).range,50);assert.equal(towerStats(unit('druid',6),data).poisonDps,384);
});
test('two Royal V defenders merge into Mythic VI at the chosen tile, with VI capped',()=>{
  const g=new Game(data,{seed:2});g.draft.forced={family:'runebreaker',tier:5};g.draft.roll(0);for(let x=10;x<15;x++)g.place(x,10);
  const [a,b]=g.towers;g.select(a.id);
  assert.equal(g.merge(),true);assert.equal(a.tier,6);assert.equal(b.state,'ruin');assert.equal(g.grid.occupied.size,5);assert.equal(g.merge(),false);assert.deepEqual([a.x,a.z],[10,10]);
});
test('formation recipes form an acyclic graph and craft from every valid anchor with exact output ranks',()=>{
  const finished=new Set();
  function visit(id,trail=new Set()){
    assert.ok(!trail.has(id),`No recipe cycle at ${id}`);if(finished.has(id))return;
    const r=data.recipes.find(r=>r.id===id);assert.ok(r);const next=new Set([...trail,id]);
    for(const p of r.ingredients)if(data.towers[p.family].advanced)visit(p.family,next);finished.add(id);
  }
  for(const r of data.recipes){visit(r.id);
    for(let anchor=0;anchor<r.ingredients.length;anchor++){
      const g=new Game(data,{seed:2});g.phase='ready';g.towers=r.ingredients.map((p,i)=>unit(p.family,p.tier,i+1,10+i));
      for(const t of g.towers)g.grid.occupy(t.x,t.z,t.id);g.select(anchor+1);
      assert.equal(g.craft(r.id),true,r.id);assert.equal(g.selection.family,recipeFamily(r));assert.equal(g.selection.tier,recipeTier(r));assert.equal(g.selection.x,10+anchor);assert.equal(g.towers.filter(t=>t.state==='active').length,1);assert.equal(g.grid.occupied.size,3);
    }
  }
  assert.equal(finished.size,36);
});
test('wrong ranks and one copy of a repeated ingredient cannot satisfy a recipe',()=>{
  const g=new Game(data,{seed:3});g.phase='ready';g.towers=[unit('highking'),unit('runebreaker',5,2),unit('soldier',6,3)];g.select(1);
  assert.equal(g.craft('crownofages'),false);assert.equal(g.selection.family,'highking');
});
test('Opal-inspired blessings stack across ranks but duplicates cannot inflate the bonus',()=>{
  const archer=unit('archer'),one=unit('cleric',1,2),duplicate=unit('cleric',1,3),two=unit('cleric',2,4);
  const bonuses=supportBonuses(archer,[archer,one,duplicate,two],data);assert.equal(bonuses.haste,1.5);
  two.state='ruin';assert.equal(supportBonuses(archer,[one,duplicate,two],data).haste,1.2);
  const grove=unit('eldergrove',1,5),sun=unit('sunward',1,6);assert.deepEqual(supportBonuses(archer,[grove,sun],data),{haste:1.6,damage:1.5,range:3});
});
test('Ruby-inspired secondary cleave ignores armor without damaging the primary twice',()=>{
  const g=arena(),mage=unit('mage'),target=enemy(g,11,10),secondary=enemy(g,11,11);secondary.armor=9999;secondary.resists={magic:.85};
  g.combat.impact({source:mage,target,stats:towerStats(mage,data)});
  assert.equal(target.hp,9988);assert.ok(Math.abs(secondary.hp-9996.4)<1e-8);
});
test('poison scales independently of hit damage and the strongest armor reduction survives refresh',()=>{
  const g=arena(),druid=unit('druid',6),e=enemy(g,11,10);g.combat.applyEffects(e,towerStats(druid,data),druid);g.tick(1);
  assert.equal(e.hp,9616);assert.equal(e.statuses.poison.time,4);
  g.combat.applyEffects(e,{shred:64},druid);g.combat.applyEffects(e,{shred:2},druid);assert.equal(e.statuses.shred.amount,64);
});
test('stormcaller fires at three distinct targets and Mythic frost applies nearby slow',()=>{
  const g=arena(),caster=unit('stormcaller');g.towers=[caster];for(let i=0;i<4;i++)enemy(g,11,10+i*.1);g.tick(.01);
  assert.equal(new Set(g.combat.projectiles.map(p=>p.target.id)).size,3);
  const frost=unit('frostwarden',6),target=g.combat.enemies[0];g.combat.impact({source:frost,target,stats:towerStats(frost,data)});
  for(const e of g.combat.enemies)assert.equal(e.statuses.slow.amount,.75);
});
test('burning and slowing auras work without projectiles and stop when the tower is consumed',()=>{
  const g=arena(),beacon=unit('embercrown'),winter=unit('winterhold',1,2);g.towers=[beacon,winter];winter.cooldown=999;
  const spawn=g.grid.checkpoints[0];const e=enemy(g,spawn.x,spawn.z);e.speed=1;beacon.x=spawn.x;beacon.z=spawn.z;winter.x=spawn.x;winter.z=spawn.z;
  g.tick(1);assert.equal(e.hp,9760);assert.equal(e.x,.25);assert.equal(g.combat.projectiles.length,0);
  beacon.state='ruin';winter.state='ruin';g.tick(1);assert.equal(e.hp,9760);assert.equal(e.x,1.25);
});
test('Mythic rapid fire preserves its rate across frame sizes and stacked blessings',()=>{
  function shots(step){const g=arena(),archer=unit('archer',6),cleric=unit('cleric',6,2);g.towers=[archer,cleric];cleric.cooldown=999;const e=enemy(g,11,10);e.hp=1e9;let count=0;g.on(type=>{if(type==='shot')count++;});for(let elapsed=0;elapsed<.999;elapsed+=step)g.tick(step);return count;}
  const fine=shots(.01),coarse=shots(.1);assert.ok(fine>=17&&fine<=18);assert.ok(Math.abs(fine-coarse)<=1);
});

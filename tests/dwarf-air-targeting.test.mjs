import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';
import {loadCurrentDatasets} from '../tools/current-datasets.mjs';
import {towerStats} from '../game/core/math.js';
import {updateFr002Tower} from '../game/core/fr002-combat.js';
import {attackTargetAllowed} from '../game/core/combat-rules.js';

const data=loadCurrentDatasets(),before=loadCurrentDatasets({revision:'fr004'});
function scene(faction,family,tier=1){
 const d=data[faction],g=new Game(d,{seed:19}),c=g.combat,t={id:1,family,tier,state:'active',x:10,z:10,kills:0,cooldown:0,mvpLevel:0};
 g.phase='combat';g.towers=[t];g.rng=()=>.999999;
 const enemy=(x=12,z=10,props={})=>Object.assign(c.spawn('grunt'),{x,z,hp:1e8,maxHp:1e8,armor:0,speed:0,physicalImmune:false,magicImmune:false,krakenShell:0,route:[{x:100,z}],pathIndex:0,traveled:0,statuses:{},flying:true,...props});
 return{g,c,t,s:towerStats(t,d),enemy};
}

test('all 86 Dwarf-faction profiles release real ordinary or continuous damage against a visible flyer in range',()=>{
 let profiles=0,native=0,changed=0,cones=0;
 for(const [family,u]of Object.entries(data.forge.towers))for(let tier=1;tier<=(u.advanced?1:6);tier++){
  const h=scene('forge',family,tier),e=h.enemy(),key=family+'/'+tier;
  assert.ok(attackTargetAllowed(h.s,e),key+' permits air');assert.ok(attackTargetAllowed(h.s,{flying:false}),key+' retains ground');
  for(let i=0;i<100&&e.hp===e.maxHp;i++)h.c.update(.05);
  assert.ok(e.hp<e.maxHp,key+' actually damages air through the combat manager');
  profiles++;native+=family!=='ladyclaire';changed+=!!towerStats({family,tier},before.forge).groundOnly;cones+=!!h.s.continuousAttack;
 }
 assert.deepEqual({profiles,native,changed,cones},{profiles:86,native:85,changed:35,cones:4});
});

test('four Dwarf cones aim at flyers and hit mixed ground and air only inside the existing cone and range',()=>{
 for(const family of ['dw_steamharpooner','dw_flamewarden','dw_emberanvil','dw_bombardking']){
  const h=scene('forge',family),air=h.enemy(12,10),ground=h.enemy(12,10.2,{flying:false}),side=h.enemy(10,12),far=h.enemy(10+h.s.range+.01,10);
  assert.equal(h.s.continuousAttack.targeting,'ground-and-air');
  updateFr002Tower(h.c,h.t,h.s,.1,1);
  assert.ok(air.hp<air.maxHp,family+' airborne aim');assert.ok(ground.hp<ground.maxHp,family+' mixed ground victim');
  assert.equal(side.hp,side.maxHp,family+' outside cone');assert.equal(far.hp,far.maxHp,family+' outside range');
 }
});

test('Dwarf air permission grants no detection or immunity bypass and leaves ground-only secondary Heat unchanged',()=>{
 for(const family of ['dw_shieldguard','dw_steamharpooner']){
  const h=scene('forge',family),immune=h.enemy(12,10,{physicalImmune:true}),hidden=h.enemy(12.5,10,{stealth:true,cloaked:true});h.g.grid.checkpoints=[];
  for(let i=0;i<50;i++)h.c.update(.05);
  assert.equal(immune.hp,immune.maxHp,family+' physical immunity');assert.equal(hidden.hp,hidden.maxHp,family+' hidden flyer');
 }
 const h=scene('forge','dw_steamharpooner');h.enemy(12,10);const outsideCone=h.enemy(10,12);h.c.elapsed=4;
 updateFr002Tower(h.c,h.t,h.s,.1,1);assert.equal(outsideCone.hp,outsideCone.maxHp,'Heat retains its authored ground-only secondary area');
 assert.match(h.s.abilities.find(a=>a.familyId==='heat').text,/ground enemies/);
});

test('unamended Elf cones retain ground-only delivery even if a caller supplies broader primary target flags',()=>{
 let count=0;
 for(const [family,u]of Object.entries(data.grove.towers))for(let tier=1;tier<=(u.advanced?1:6);tier++){
  const h=scene('grove',family,tier);if(!h.s.continuousAttack)continue;
  count++;const air=h.enemy(12,10);updateFr002Tower(h.c,h.t,{...h.s,groundOnly:false,abilities:h.s.abilities.filter(a=>a.familyId==='flame-cone')},.1,1);assert.equal(air.hp,air.maxHp,family+'/'+tier);
 }
 assert.ok(count>0);
});

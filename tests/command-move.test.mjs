import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Scene,Mesh,BoxGeometry,MeshBasicMaterial,PerspectiveCamera} from 'three';
import {Game} from '../game/core/game.js';
import {cellKey} from '../game/core/grid.js';
import {CommandMove} from '../game/core/command-move.js';
import {CommandMoveEffects} from '../game/render/command-move-effects.js';
import {RunStatistics} from '../game/core/run-statistics.js';
import {TowerDpsTracker} from '../game/core/tower-dps.js';
import {supportBonuses} from '../game/core/math.js';
import {towerSupportState,supportSourceAreas,enemyStatusState} from '../game/render/support-effects.js';
import {ReservedDefenderEffects} from '../game/render/reserved-defender-effects.js';
import {hasWallFoundation,wallConnections} from '../game/render/walls.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
function fixture(scenario=data){
  const game=new Game(scenario,{seed:312});
  for(const [x,z]of [[5,5],[7,5],[9,5],[11,5],[13,5]])assert.equal(game.place(x,z),true);
  assert.equal(game.keep(),true);
  const move=new CommandMove(game);game.commandMove=move;
  return {game,move,defender:game.towers.find(t=>t.state==='active'),wall:game.towers.find(t=>t.state==='ruin')};
}

test('Move opens only between waves and requires a retained defender and a castle wall',()=>{
  for(const phase of ['build','select','ready','reward']){
    const {game,move}=fixture();game.phase=phase;assert.equal(move.canBegin,true,phase);assert.equal(move.begin(),true);assert.equal(move.defenderId,null);assert.equal(move.begin(),false);assert.equal(move.cancel(),true);assert.equal(move.cancel(),false);
  }
  for(const phase of ['combat','won','lost']){const {game,move}=fixture();game.phase=phase;game.paused=true;assert.equal(move.canBegin,false);assert.equal(move.begin(),false,phase);assert.deepEqual(move.eligibleDefenders,[]);}
  const {game,move}=fixture();game.towers.forEach(t=>t.state='draft');assert.equal(move.canBegin,false);
  game.towers.forEach(t=>t.state='active');assert.equal(move.canBegin,false);
});

test('selection highlights retained defenders first and then only registered wall destinations',()=>{
  const {game,move,defender,wall}=fixture();assert.equal(move.select(defender.id),false);assert.equal(move.begin(),true);
  assert.deepEqual(move.eligibleDefenders,[defender]);assert.deepEqual(move.validWalls,[]);assert.equal(move.select(wall.id),false);
  assert.equal(move.select(defender.id),true);assert.equal(move.defender,defender);assert.equal(move.validWalls.length,4);assert.ok(move.validWalls.every(t=>t.state==='ruin'));assert.equal(move.canTarget(defender.id),false);
  const draft=game.towers.find(t=>t!==defender&&t!==wall);draft.state='draft';assert.equal(move.select(draft.id),false);assert.equal(move.canTarget(draft.id),false);assert.equal(move.defender,defender);
});

test('a valid exchange costs once and preserves maze cells, route, identities and defender/wall state',()=>{
  const {game,move,defender,wall}=fixture();Object.assign(defender,{kills:17,cooldown:2.75,priority:'strongest',upgrades:2,melancholyUntil:16});wall.weakened=4.25;
  const beforeDefender=structuredClone(defender),beforeWall=structuredClone(wall),from={x:defender.x,z:defender.z},to={x:wall.x,z:wall.z};
  const route=game.grid.route,routeCopy=structuredClone(route),keys=[...game.grid.occupied.keys()].sort(),ids=game.towers.map(t=>t.id),nextId=game.nextId,revision=game.grid.revision;
  let points=2,spends=0;move.begin();move.select(defender.id);assert.equal(move.execute(wall.id,()=>{spends++;if(points<2)return false;points-=2;return true;}),true);
  assert.equal(points,0);assert.equal(spends,1);assert.deepEqual(defender,{...beforeDefender,...to});assert.deepEqual(wall,{...beforeWall,...from});
  assert.equal(game.towers.find(t=>t.id===defender.id),defender);assert.equal(game.towers.find(t=>t.id===wall.id),wall);assert.deepEqual(game.towers.map(t=>t.id),ids);assert.equal(game.nextId,nextId);
  assert.deepEqual([...game.grid.occupied.keys()].sort(),keys);assert.equal(game.grid.occupied.get(cellKey(to.x,to.z)),defender.id);assert.equal(game.grid.occupied.get(cellKey(from.x,from.z)),wall.id);assert.equal(game.grid.occupied.size,5);
  assert.equal(game.grid.route,route);assert.deepEqual(route,routeCopy);assert.deepEqual(game.grid.findRoute(),routeCopy);assert.equal(game.grid.revision,revision+1);assert.equal(move.active,false);assert.equal(move.defenderId,null);
  assert.equal(move.execute(wall.id,()=>{spends++;return true;}),false);assert.equal(spends,1);
});

test('an empty tile, defender, draft candidate, invalid ID or cancelled move never invokes CP spending',()=>{
  const {game,move,defender,wall}=fixture();move.begin();move.select(defender.id);let spends=0;const spend=()=>{spends++;return true;};
  for(const id of [defender.id,null,undefined,NaN,'1',999,-1])assert.equal(move.execute(id,spend),false,String(id));
  const draft=game.towers.find(t=>t!==defender&&t!==wall);draft.state='draft';assert.equal(move.execute(draft.id,spend),false);assert.equal(move.execute(wall.id),false);
  move.cancel();assert.equal(move.execute(wall.id,spend),false);assert.equal(spends,0);assert.equal(wall.state,'ruin');
});

test('a refused CP spend keeps the board and selected Move unchanged',()=>{
  const {game,move,defender,wall}=fixture();move.begin();move.select(defender.id);const before=structuredClone(game.towers),occupied=[...game.grid.occupied],revision=game.grid.revision;let spends=0;
  assert.equal(move.execute(wall.id,()=>{spends++;return false;}),false);assert.equal(spends,1);assert.deepEqual(game.towers,before);assert.deepEqual([...game.grid.occupied],occupied);assert.equal(game.grid.revision,revision);assert.equal(move.active,true);assert.equal(move.defender,defender);
});

test('stale occupancy, removed source or destination, and duplicate positions fail before spending',()=>{
  const cases=[
    ({game,defender})=>game.grid.occupied.delete(cellKey(defender.x,defender.z)),
    ({game,wall})=>game.grid.occupied.delete(cellKey(wall.x,wall.z)),
    ({game,wall})=>game.grid.occupied.set(cellKey(wall.x,wall.z),987),
    ({game,defender})=>{game.towers=game.towers.filter(t=>t!==defender);},
    ({game,wall})=>{game.towers=game.towers.filter(t=>t!==wall);},
    ({game,wall})=>game.towers.push({...wall,id:987}),
    ({game,wall})=>game.towers.push({...wall,x:20,z:20})
  ];
  for(const mutate of cases){const f=fixture();f.move.begin();f.move.select(f.defender.id);mutate(f);let spends=0;assert.equal(f.move.execute(f.wall.id,()=>{spends++;return true;}),false);assert.equal(spends,0);}
});

test('invalid terrain, enemy route cells, fractional and outside coordinates cannot be Move destinations',()=>{
  for(const kind of ['checkpoint','spawn','exit','blocked','decorative']){
    const {game,move,defender,wall}=fixture();move.begin();move.select(defender.id);game.grid.terrain.set(cellKey(wall.x,wall.z),kind);let spends=0;assert.equal(move.execute(wall.id,()=>{spends++;return true;}),false,kind);assert.equal(spends,0);
  }
  for(const [x,z]of [[-1,5],[37,5],[5,-1],[5,37],[5.5,5],[NaN,5]]){
    const {game,move,defender,wall}=fixture();move.begin();move.select(defender.id);game.grid.occupied.delete(cellKey(wall.x,wall.z));wall.x=x;wall.z=z;game.grid.occupied.set(cellKey(x,z),wall.id);let spends=0;assert.equal(move.execute(wall.id,()=>{spends++;return true;}),false);assert.equal(spends,0);
  }
  const {game,move,defender,wall}=fixture();move.begin();move.select(defender.id);game.grid.route=[...game.grid.route,{x:wall.x,z:wall.z}];let spends=0;assert.equal(move.execute(wall.id,()=>{spends++;return true;}),false);assert.equal(spends,0);
});

test('ordinary valid boundary walls remain legal without opening a hole in the maze',()=>{
  const {game,move,defender}=fixture();assert.equal(game.grid.occupy(0,0,99).ok,true);const wall={id:99,family:'archer',tier:1,state:'ruin',x:0,z:0};game.towers.push(wall);const route=game.grid.route;
  move.begin();move.select(defender.id);assert.equal(move.canTarget(99),true);assert.equal(move.execute(99,()=>true),true);assert.equal(defender.x,0);assert.equal(defender.z,0);assert.equal(game.grid.route,route);assert.equal(game.grid.occupied.size,6);
});

test('a phase change or source becoming a ruin closes eligibility before spending',()=>{
  for(const mutate of [({game})=>{game.phase='combat';},({defender})=>{defender.state='ruin';}]){
    const f=fixture();f.move.begin();f.move.select(f.defender.id);mutate(f);let spends=0;assert.equal(f.move.execute(f.wall.id,()=>{spends++;return true;}),false);assert.equal(spends,0);assert.deepEqual(f.move.validWalls,[]);
  }
});

test('Move rendering distinguishes sources, chosen defender and legal walls and disposes borrowed resources once',()=>{
  const {game,move,defender,wall}=fixture(),scene=new Scene(),effects=new CommandMoveEffects(scene);
  effects.sync(game);assert.equal(effects.group.visible,false);move.begin();effects.sync(game);assert.equal(effects.items.size,1);const source=effects.items.get(defender.id);assert.equal(source.userData.moveRole,'defender');assert.equal(source.material.color.getHexString(),'75bafa');
  move.select(defender.id);effects.sync(game);assert.equal(effects.items.size,5);assert.equal(source.userData.moveRole,'selected');assert.equal(source.material.color.getHexString(),'ffdd83');assert.equal(effects.items.get(wall.id).userData.moveRole,'wall');assert.equal(effects.items.get(wall.id).material.color.getHexString(),'78e3ce');
  move.execute(wall.id,()=>true);effects.sync(game);assert.equal(effects.group.visible,false);assert.equal(effects.items.size,0);
  move.begin();effects.sync(game);assert.deepEqual(effects.items.get(defender.id).position.toArray(),[defender.x-18,.082,defender.z-18]);
  let disposed=0;effects.geometry.addEventListener('dispose',()=>disposed++);Object.values(effects.materials).forEach(material=>material.addEventListener('dispose',()=>disposed++));effects.dispose();effects.dispose();effects.sync(game);assert.equal(disposed,4);assert.equal(scene.children.length,0);
});

test('actual Game selection spends configured CP only after the completed defender-wall exchange',()=>{
  const scenario=structuredClone(data);scenario.balance.commandPoints.starting=4;scenario.balance.commandPoints.costs.move=3;
  const {game,move,defender,wall}=fixture(scenario),from={x:defender.x,z:defender.z},to={x:wall.x,z:wall.z};let moves=0;
  game.on((type,payload)=>{if(type==='move'){moves++;assert.equal(payload.tower,defender);assert.equal(payload.cost,3);assert.equal(game.commandPoints.value,1);assert.deepEqual({x:defender.x,z:defender.z},to);assert.equal(game.grid.occupied.get(cellKey(from.x,from.z)),wall.id);}});
  assert.equal(game.commandActions.move.cost,3);assert.equal(game.beginMove(),true);assert.equal(game.commandPoints.value,4);assert.deepEqual(game.moveSelection,{towerId:null});
  game.select(defender.id);assert.deepEqual(game.moveSelection,{towerId:defender.id});assert.equal(game.selectMove(999),false);assert.equal(game.commandPoints.value,4);
  assert.equal(game.selectMove(wall.id),true);assert.equal(moves,1);assert.equal(game.selected,defender.id);assert.equal(game.moveSelection,null);assert.equal(move.active,false);assert.equal(game.beginMove(),false);assert.equal(game.commandPoints.value,1);
});

test('actual Game cancellation and combat transition spend no CP and gate competing board actions',()=>{
  const {game,defender}=fixture();const before=structuredClone(game.towers),points=game.commandPoints.value;
  game.beginMove();game.select(defender.id);assert.equal(game.remove(),false);assert.equal(game.place(15,5),false);assert.equal(game.keep(),false);assert.equal(game.merge(),false);assert.equal(game.downgrade(),false);assert.deepEqual(game.towers,before);assert.equal(game.commandPoints.value,points);
  game.select(null);assert.equal(game.moveSelection,null);assert.equal(game.commandPoints.value,points);
  game.beginMove();game.select(defender.id);assert.equal(game.startCombat(),true);assert.equal(game.moveSelection,null);assert.equal(game.commandPoints.value,points);assert.equal(game.beginMove(),false);
});

test('zero CP disables actual Move, ended runs clear its mode, and a new run restores untouched state',()=>{
  const {game,defender}=fixture();game.commandPoints.value=0;assert.equal(game.commandActions.move.available,false);assert.equal(game.beginMove(),false);assert.equal(game.moveSelection,null);assert.equal(game.commandPoints.value,0);
  for(const won of [true,false]){const f=fixture();f.game.beginMove();f.game.selectMove(f.defender.id);f.game.end(won);assert.equal(f.game.moveSelection,null);assert.equal(f.game.commandPoints.value,data.balance.commandPoints.starting);assert.equal(f.game.selectMove(f.wall.id),false);}
  game.commandPoints.value=10;game.phase='ready';game.beginMove();game.selectMove(defender.id);const fresh=new Game(data,{seed:312});assert.equal(fresh.commandPoints.value,data.balance.commandPoints.starting);assert.equal(fresh.moveSelection,null);assert.equal(fresh.commandMove.active,false);assert.equal(fresh.commandMove.defenderId,null);assert.equal(fresh.commandActions.move.available,false);
});

test('Move retains the defender DPS record and the next actual wave records its new location and original identity',()=>{
  const {game,defender,wall}=fixture(),tracker=new TowerDpsTracker(),stats=new RunStatistics(game,{id:'move-statistics-test',clock:()=>1000});
  defender.kills=23;tracker.recordHit({source:defender,damage:40,effectiveDamage:40},0);const prior=tracker.snapshot(game.towers,0).find(t=>t.id===defender.id);assert.equal(prior.dps,8);
  game.beginMove();game.selectMove(defender.id);game.selectMove(wall.id);const after=tracker.snapshot(game.towers,0).find(t=>t.id===defender.id);assert.equal(after.dps,prior.dps);assert.equal(after.family,prior.family);assert.equal(after.tier,prior.tier);assert.equal(defender.kills,23);assert.deepEqual({x:after.x,z:after.z},{x:defender.x,z:defender.z});
  assert.equal(game.startCombat(),true);const recorded=stats.current.towers.find(t=>t.id===defender.id);assert.ok(recorded);assert.deepEqual({id:recorded.id,family:recorded.family,tier:recorded.tier,x:recorded.x,z:recorded.z},{id:defender.id,family:defender.family,tier:defender.tier,x:defender.x,z:defender.z});assert.equal(stats.current.towers.length,1);stats.dispose();
});

test('a Reserved defender remains an occupied route blocker and is neither a Move source nor wall destination',()=>{
  const {game,move,defender,wall}=fixture();wall.state='reserved';const keys=[...game.grid.occupied],route=game.grid.route,scene=new Scene(),effects=new CommandMoveEffects(scene);
  assert.equal(game.grid.walkable(wall.x,wall.z),false);assert.deepEqual(game.grid.findRoute(),route);assert.equal(move.begin(),true);assert.equal(move.select(wall.id),false);assert.equal(move.select(defender.id),true);assert.equal(move.canTarget(wall.id),false);
  let spends=0;assert.equal(move.execute(wall.id,()=>{spends++;return true;}),false);assert.equal(spends,0);effects.sync(game);assert.equal(effects.items.has(wall.id),false);assert.equal(game.selectMove(wall.id),false);assert.equal(game.commandPoints.value,data.balance.commandPoints.starting);assert.deepEqual([...game.grid.occupied],keys);assert.equal(game.grid.route,route);effects.dispose();
});

test('actual combat and support systems leave on-map Reserved defenders inactive',()=>{
  for(const family of ['cleric','worldfire','winterhold','royalmarshal']){
    const {game,defender,wall}=fixture();Object.assign(wall,{family,tier:1,state:'reserved'});defender.cooldown=99999;
    const reservedSources=[];game.on((type,payload)=>{if(['shot','aura-attack','hit'].includes(type)&&payload.source?.id===wall.id)reservedSources.push(type);});
    assert.equal(game.startCombat(),true);game.combat.spawnQueue=[];defender.cooldown=99999;const enemy=game.combat.spawn('host_01');Object.assign(enemy,{x:wall.x+.1,z:wall.z,hp:10000,maxHp:10000,speed:0});
    const before=enemy.hp;game.combat.update(.05);assert.equal(enemy.hp,before,family);assert.deepEqual(reservedSources,[],family);assert.equal(enemy.currentSpeed,0);assert.equal(enemy.armorShred||0,0);
    const activeNeighbor={...defender,x:wall.x+1,z:wall.z};assert.deepEqual(supportBonuses(activeNeighbor,[wall],data),{haste:1,damage:1,range:0});assert.equal(towerSupportState(wall,game.towers,data).active,false);assert.deepEqual(supportSourceAreas(wall,data),[]);assert.deepEqual(enemyStatusState(enemy,[wall],data),[]);assert.equal(game.grid.walkable(wall.x,wall.z),false);
  }
});

test('Reserved defenders retain connected stone foundations and an independent static bookmark pin',()=>{
  const {game,wall}=fixture();wall.state='reserved';assert.equal(hasWallFoundation(wall),true);const neighbor={id:99,state:'ruin',x:wall.x+1,z:wall.z};assert.equal(wallConnections(wall,[wall,neighbor]),2);assert.equal(wallConnections(neighbor,[wall,neighbor]),8);wall.state='draft';assert.equal(hasWallFoundation(wall),false);assert.equal(wallConnections(neighbor,[wall,neighbor]),0);wall.state='reserved';
  const scene=new Scene(),effect=new ReservedDefenderEffects(scene),figure=new Mesh(new BoxGeometry(1,2,1),new MeshBasicMaterial({color:'#ffffff'}));figure.position.y=1;const models=new Map([[wall.id,{object:figure}]]),before=structuredClone(wall),color=figure.material.color.getHexString();
  effect.sync(game,models);assert.equal(effect.items.size,1);const pin=effect.items.get(wall.id);assert.equal(pin.userData.towerId,wall.id);assert.equal(pin.userData.inactive,true);assert.equal(pin.userData.height,2);assert.equal(pin.children.length,4);assert.equal(pin.position.x,wall.x-18);assert.equal(pin.position.z,wall.z-18);
  const camera=new PerspectiveCamera(38,1,.1,200);camera.position.set(10,40,45);camera.lookAt(0,0,0);effect.update(camera,600);assert.ok(pin.quaternion.equals(camera.quaternion));const pose=pin.matrix.clone();pin.updateMatrix();const stable=pin.matrix.clone();effect.update(camera,600);pin.updateMatrix();assert.deepEqual(pin.matrix.elements,stable.elements);assert.notEqual(pose,stable);
  effect.sync(game,models);assert.equal(effect.items.get(wall.id),pin);assert.deepEqual(wall,before);assert.equal(figure.material.color.getHexString(),color);assert.equal(figure.material.opacity,1);
  wall.state='draft';effect.sync(game,models);assert.equal(effect.items.size,0);assert.equal(effect.group.visible,false);let disposals=0;for(const resource of [...Object.values(effect.geometries),...Object.values(effect.materials)])resource.addEventListener('dispose',()=>disposals++);effect.dispose();effect.dispose();assert.equal(disposals,5);assert.equal(scene.children.length,0);figure.geometry.dispose();figure.material.dispose();
});

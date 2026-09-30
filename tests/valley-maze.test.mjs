import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {GridManager,cellKey} from '../game/core/grid.js';
import {recommendMaze} from '../game/core/maze.js';
import {valleyEnvironment} from '../game/render/environment.js';
import {towerModel} from '../game/render/models.js';
import {CHAMPIONS,SIEGE_KINDS} from '../game/render/champion-catalog.js';

test('long-route blueprint is non-mutating, avoids markers, and can be built one draw at a time',()=>{
  const grid=new GridManager(),before=JSON.stringify([grid.terrain,Array.from(grid.occupied),grid.route,grid.revision]);
  const plan=recommendMaze(grid);
  assert.equal(JSON.stringify([grid.terrain,Array.from(grid.occupied),grid.route,grid.revision]),before);
  assert.ok(plan.plannedLength>plan.currentLength*3);assert.ok(plan.missing.length<=140);
  const built=new GridManager();
  plan.missing.forEach((p,i)=>{assert.ok(!grid.terrain.has(cellKey(p.x,p.z)));assert.ok(built.occupy(p.x,p.z,i+1).ok);});
  assert.equal(built.route.length-1,plan.plannedLength);
  for(const p of plan.gates)assert.ok(built.walkable(p.x,p.z));
  let at=0;for(const p of built.checkpoints.slice(1)){const next=built.route.findIndex((q,i)=>i>at&&q.x===p.x&&q.z===p.z);assert.ok(next>at);at=next;}
});
test('blueprint respects remaining draws, existing walls, and keeps a feasible plan stable',()=>{
  const grid=new GridManager(),original=recommendMaze(grid),p=original.missing[0];grid.occupy(p.x,p.z,1);
  const remaining=recommendMaze(grid,139,original);assert.deepEqual(remaining.walls,original.walls);assert.equal(remaining.missing.length,139);
  for(const budget of [0,15,50]){const plan=recommendMaze(grid,budget);assert.ok(plan.missing.length<=budget);assert.ok(plan.route.every(q=>grid.walkable(q.x,q.z)));}
  const shortPlan=recommendMaze(new GridManager(),50);assert.ok(shortPlan.plannedLength>shortPlan.currentLength);
});
test('blueprint recomputes instead of recommending a sealed existing gate',()=>{
  const grid=new GridManager(),original=recommendMaze(grid);
  const firstGate=original.gates.slice(0,2);for(const [i,p]of firstGate.entries())assert.ok(grid.occupy(p.x,p.z,i+1).ok);
  const changed=recommendMaze(grid,138,original);assert.notDeepEqual(changed.walls,original.walls);
  assert.ok(changed.route.every(p=>grid.walkable(p.x,p.z)));
});
test('mountains, forests, river and bridge leave the entire construction field clear',()=>{
  const valley=valleyEnvironment();assert.ok(valley.bounds.length>200);
  for(const b of valley.bounds)assert.ok(b.min[0]>=18.5||b.max[0]<=-18.5||b.min[2]>=18.5||b.max[2]<=-18.5);
  for(const group of [valley.staticGroup,valley.water])group.traverse(o=>{
    const a=o.geometry?.attributes.position;if(!a)return;
    for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);assert.ok(Number.isFinite(x+y+z));assert.ok(Math.abs(x)>=18.49||Math.abs(z)>=18.49,'scenery vertex stays outside board');}
  });
  valley.update(.016,1);
  for(const group of [valley.staticGroup,valley.water])group.traverse(o=>o.geometry?.dispose());
});
test('twenty-eight advanced units have distinct finite silhouettes, with three siege machines',()=>{
  const signatures=new Set();assert.equal(Object.keys(CHAMPIONS).length,28);
  assert.equal(Object.values(CHAMPIONS).filter(c=>SIEGE_KINDS.includes(c.kind)).length,3);
  for(const id of Object.keys(CHAMPIONS)){
    const model=towerModel(id,1,true),b=new Box3().setFromObject(model),size=b.getSize(new Vector3());
    assert.ok([size.x,size.y,size.z].every(Number.isFinite));assert.ok(size.x<2.2&&size.z<2.2&&size.y<2.6,id);
    assert.ok(size.y>1);signatures.add(JSON.stringify(model.children.map(o=>[o.material.color.getHex(),o.geometry.attributes.position.count])));
    model.traverse(o=>o.geometry?.dispose());
  }
  assert.equal(signatures.size,28);
});

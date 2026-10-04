import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Raycaster,Vector3,Matrix4,Group} from 'three';
import {Game} from '../game/core/game.js';
import {GridManager,cellKey} from '../game/core/grid.js';
import {preparedBlueprints,blueprintProgress} from '../game/core/blueprints.js';
import {currentEnemyRoute,createRouteOverlay,animateRouteOverlay,disposeRouteOverlay,routeDistance,sameRoute,CHECKPOINT_MARKER_SCALE,ROUTE_COLORS} from '../game/render/route-overlay.js';
import {castleWallModel,WALL_DECK_HEIGHT} from '../game/render/walls.js';
import {BATTLEFIELD_UNIT_SCALE} from '../game/render/battlefield-scale.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));

test('the current route follows real ground routing, queued flying variants and living enemies without drawing RNG',()=>{
 const game=new Game(data,{seed:42});game.rng=()=>assert.fail('route presentation must never draw a variant');
 assert.equal(currentEnemyRoute(game).points,game.grid.route);
 const previous=game.grid.route;assert.ok(game.grid.occupy(2,4,1).ok);assert.notDeepEqual(game.grid.route,previous);assert.equal(currentEnemyRoute(game).points,game.grid.route);
 game.phase='combat';game.combat.spawnQueue=[{type:'host_01',modifiers:{variant:{flying:true}}}];
 assert.equal(currentEnemyRoute(game).flying,true);assert.equal(currentEnemyRoute(game).points,game.grid.checkpoints);
 const real=game.combat.spawn('host_01');assert.equal(currentEnemyRoute(game).flying,false);assert.equal(currentEnemyRoute(game).points,real.route);
 real.dead=true;assert.equal(currentEnemyRoute(game).flying,true);
 assert.ok(routeDistance(game.grid.checkpoints)>game.grid.checkpoints.length-1,'flight distance measures actual segments');
});

test('the completed blueprint route includes existing off-plan structures and never fabricates a blocked route',()=>{
 const plan=preparedBlueprints([])[0],grid=new GridManager(),snapshot=JSON.stringify(plan);
 const union=new GridManager();for(const p of plan.walls)union.occupied.set(cellKey(p.x,p.z),'plan');
 const detour=plan.route.find(p=>grid.canPlace(p.x,p.z).ok&&union.findRoute(cellKey(p.x,p.z)));
 assert.ok(detour);assert.ok(grid.occupy(detour.x,detour.z,1).ok);const progress=blueprintProgress(plan,grid,250);
 assert.equal(progress.offPlan,1);assert.equal(progress.conflict,false);assert.ok(!progress.route.some(p=>p.x===detour.x&&p.z===detour.z));assert.ok(!sameRoute(progress.route,plan.route));
 union.occupied.set(cellKey(detour.x,detour.z),'existing');assert.deepEqual(progress.route,union.findRoute());
 const choke=progress.route.find(p=>grid.canPlace(p.x,p.z).ok&&!union.findRoute(cellKey(p.x,p.z)));assert.ok(choke);assert.ok(grid.occupy(choke.x,choke.z,2).ok);
 const blocked=blueprintProgress(plan,grid,250);assert.equal(blocked.conflict,true);assert.equal(blocked.route,null);assert.equal(JSON.stringify(plan),snapshot);
});

test('actual current geometry is continuous with direction arrows and stays above dashed future geometry',()=>{
 const points=[{x:0,z:0},{x:1,z:0},{x:7,z:0},{x:7,z:5}],now=createRouteOverlay(points),future=createRouteOverlay(points,{planned:true}),air=createRouteOverlay(points,{flying:true});
 const line=now.getObjectByName('Current route continuous ribbon'),dashes=future.getObjectByName('Planned route dashes'),arrows=now.getObjectByName('Current route direction arrows');
 assert.equal(line.geometry.attributes.position.count,18,'each segment is a complete ribbon rectangle');assert.ok(arrows.count>0&&arrows.count<=Math.floor(routeDistance(points)/5),'direction markers remain sparse on a twelve-metre route');assert.equal(arrows.geometry.attributes.position.count,12,'tapered open chevrons have two strokes');
 const edgeA=new Vector3().fromBufferAttribute(line.geometry.attributes.position,0),edgeB=new Vector3().fromBufferAttribute(line.geometry.attributes.position,1);assert.ok(edgeA.distanceTo(edgeB)<.04,'continuous guide leaves most of the ground visible');
 arrows.geometry.computeBoundingBox();const arrowSize=arrows.geometry.boundingBox.getSize(new Vector3());assert.ok(arrowSize.x<=.25&&arrowSize.z<=.2,'small chevrons avoid covering neighboring tiles');assert.ok(line.material.opacity<=.5&&arrows.material.opacity<.8,'direction remains visible without a bright opaque maze');
 assert.equal(line.material.color.getHexString(),ROUTE_COLORS.current.slice(1));assert.equal(air.getObjectByName(line.name).material.color.getHexString(),ROUTE_COLORS.flying.slice(1));assert.equal(dashes.material.color.getHexString(),ROUTE_COLORS.planned.slice(1));
 assert.ok(line.geometry.attributes.position.getY(0)>dashes.geometry.attributes.position.getY(0));assert.equal(future.getObjectByName(arrows.name),undefined);
 // Each dash rectangle is shorter than its period, even across tile boundaries.
 const attr=dashes.geometry.attributes.position;for(let i=0;i<attr.count;i+=6){const a=new Vector3().fromBufferAttribute(attr,i),b=new Vector3().fromBufferAttribute(attr,i+2);assert.ok(a.distanceTo(b)<=.23+1e-5);}
 assert.equal(now.userData.distance,12);assert.equal(CHECKPOINT_MARKER_SCALE,1.15);assert.ok(Math.abs(BATTLEFIELD_UNIT_SCALE/.88-.8)<1e-12);
 const all=new Group();all.add(now,future,air);let disposed=0;all.traverse(n=>n.geometry?.addEventListener('dispose',()=>disposed++));disposeRouteOverlay(all);assert.equal(disposed,8);assert.equal(all.children.length,0);
});

test('all connection masks have finite geometry, narrower upper courses and solid corbelled fighting decks',()=>{
 const faceAt=(root,y)=>{root.updateMatrixWorld(true);return new Raycaster(new Vector3(2,y,0),new Vector3(-1,0,0)).intersectObject(root,true)[0]?.point.x;};
 for(const platform of [false,true]){
  const root=castleWallModel(0,platform),low=faceAt(root,.17),upper=faceAt(root,.34);assert.ok(Math.abs(upper/low-.8)<.01,'second row is twenty percent narrower');
  if(platform){const down=new Raycaster(new Vector3(.38,2,.38),new Vector3(0,-1,0)).intersectObject(root,true)[0];assert.ok(Math.abs(down.point.y-WALL_DECK_HEIGHT)<1e-6,'cornice supports the fitted miniature near the deck corner');}
  root.traverse(n=>n.geometry?.dispose());
 }
 for(let mask=0;mask<256;mask++){const root=castleWallModel(mask,true);root.traverse(n=>{if(n.geometry){assert.ok(n.geometry.attributes.position.array.every(Number.isFinite));n.geometry.dispose();}});}
});

test('moving chevrons turn along real route segments with stable GPU resources and obey pause, visibility and reduced motion',()=>{
 const root=new Group(),route=createRouteOverlay([{x:0,z:0},{x:2,z:0},{x:2,z:6}]);root.add(route);
 const mesh=route.getObjectByName('Current route direction arrows'),matrix=new Matrix4(),position=new Vector3(),direction=new Vector3();
 const geometry=mesh.geometry,buffer=mesh.instanceMatrix,material=mesh.material,initial=Array.from(buffer.array);
 for(let frame=0;frame<200;frame++){
  animateRouteOverlay(root,.1);
  for(let i=0;i<mesh.count;i++){
   mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);position.x+=18;position.z+=18;
   assert.ok(Math.abs(position.z)<1e-5&&position.x>=-1e-5&&position.x<=2+1e-5||Math.abs(position.x-2)<1e-5&&position.z>=-1e-5&&position.z<=6+1e-5,'each moving marker remains on a real route segment');
   direction.set(1,0,0).transformDirection(matrix);
   assert.ok(direction.x>.999||direction.z>.999,'all chevrons point forward, including after the right-angle corner');
  }
 }
 assert.notDeepEqual(Array.from(buffer.array),initial);assert.equal(mesh.geometry,geometry);assert.equal(mesh.instanceMatrix,buffer);assert.equal(mesh.material,material);
 const paused=Array.from(buffer.array);
 animateRouteOverlay(root,.1,{paused:true});animateRouteOverlay(root,.1,{reducedMotion:true});root.visible=false;animateRouteOverlay(root,.1);root.visible=true;
 for(const dt of [NaN,Infinity,-1,0])animateRouteOverlay(root,dt);
 assert.deepEqual(Array.from(buffer.array),paused);
 let disposed=0;for(const resource of [geometry,material,mesh])resource.addEventListener('dispose',()=>disposed++);disposeRouteOverlay(root);assert.equal(disposed,3);assert.equal(root.children.length,0);
});

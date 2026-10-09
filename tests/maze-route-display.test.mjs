import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {Scene,Group} from 'three';
import {Game} from '../game/core/game.js';
import {BLUEPRINT_KEY} from '../game/core/blueprints.js';
import {createRouteOverlay,disposeRouteOverlay,currentEnemyRoute,sameRoute} from '../game/render/route-overlay.js';
const hook=registerHooks({load(url,context,next){if(url.endsWith('/data/maze-blueprints.json'))return {format:'module',source:`export default ${readFileSync(new URL(url),'utf8')};`,shortCircuit:true};return next(url,context);}});
const {MazePlanner}=await import('../game/render/maze-planner.js');hook.deregister();
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));

function environment(callback){
 const previousDocument=globalThis.document,previousStorage=globalThis.localStorage,nodes=new Map(),storage=new Map();
 const element=()=>({hidden:false,innerHTML:'',attributes:new Map(),nodes:new Map(),classList:{toggle(){}},setAttribute(name,value){this.attributes.set(name,value);},addEventListener(){},remove(){this.removed=true;},querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,{textContent:'',value:'Saved plan',disabled:false,setAttribute(){}});return this.nodes.get(selector);}});
 const sidebar={insertBefore(panel){this.panel=panel;},querySelector:()=>({})};
 globalThis.document={createElement:element,querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);}};
 globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 try{return callback({sidebar,storage});}finally{if(previousDocument)globalThis.document=previousDocument;else delete globalThis.document;if(previousStorage)globalThis.localStorage=previousStorage;else delete globalThis.localStorage;}
}
function fixture(sidebar,{waveLimit=50,showPath=true}={}){
 const game=new Game(data,{seed:461,waveLimit}),scene=new Scene(),pathGroup=new Group();pathGroup.add(createRouteOverlay(currentEnemyRoute(game).points));scene.add(pathGroup);
 const world={game,scene,pathGroup,showPath,keys:new Set(),container:{parentElement:{querySelector:()=>sidebar}}},planner=new MazePlanner(world);return {game,world,planner};
}
function close({world,planner}){planner.dispose();disposeRouteOverlay(world.pathGroup);}
function assertCellHintsOnly(planner){
 for(const child of planner.group.children){assert.equal(child.isInstancedMesh,true,'only wall/firing-position hint instances are rendered');assert.equal(child.geometry.type,'PlaneGeometry');assert.equal(child.geometry.attributes.position.count,4);}
 const routeNodes=[];planner.group.traverse(node=>{if(/route|dash|arrow/i.test(node.name))routeNodes.push(node.name);});assert.deepEqual(routeNodes,[],'no projected route, dashed strokes or direction arrows belong to the planner');
}
const guideGeometry=root=>{const result=[];root.traverse(node=>{if(node.geometry)result.push([node,node.geometry,node.material,Array.from(node.geometry.attributes.position.array)]);});return result;};
const assertGuideUnchanged=(root,before)=>{const after=guideGeometry(root);assert.equal(after.length,before.length);for(let i=0;i<after.length;i++){assert.strictEqual(after[i][0],before[i][0]);assert.strictEqual(after[i][1],before[i][1]);assert.strictEqual(after[i][2],before[i][2]);assert.deepEqual(after[i][3],before[i][3]);}};

test('selecting every real blueprint renders only wall and core hints while preserving the current playable route',()=>environment(({sidebar})=>{
 const field=fixture(sidebar),{game,world,planner}=field,guide=guideGeometry(world.pathGroup),before=JSON.stringify({route:game.grid.route,occupied:[...game.grid.occupied],revision:game.grid.revision,draws:game.draft.draws,cp:game.commandPoints});game.rng=()=>assert.fail('blueprint display must not roll a defender or enemy');
 try{
  for(const plan of planner.presets){const snapshot=JSON.stringify(plan);planner.choose(plan.id);assertCellHintsOnly(planner);assert.equal(planner.progress.conflict,false);assert.ok(planner.progress.route.length>1,'internal completed-route validation is retained');assert.equal(planner.progress.missing.length,plan.walls.length);assert.ok(planner.group.children.some(child=>child.count===plan.walls.length));assertGuideUnchanged(world.pathGroup,guide);assert.equal(world.pathGroup.visible,true);assert.equal(JSON.stringify(plan),snapshot);}
  assert.equal(JSON.stringify({route:game.grid.route,occupied:[...game.grid.occupied],revision:game.grid.revision,draws:game.draft.draws,cp:game.commandPoints}),before);
  planner.panelOpen=true;planner.renderPanel();assert.doesNotMatch(planner.panel.innerHTML,/show-final-route|final-route|planned-route|dashed|route legend/i);assert.match(planner.panel.innerHTML,/placements left|steps after maze|firing passes/);
 }finally{close(field);}
}));

test('partial and complete blueprint construction retain budget, reachability and fire metrics without allocating a future overlay',()=>environment(({sidebar})=>{
 const field=fixture(sidebar),{game,planner}=field;
 try{
  planner.choose('commander');const plan=structuredClone(planner.plan),fire=structuredClone(plan.fire);assert.equal(sameRoute(plan.route,game.grid.route),false,'the missing future route differs from the real empty-board route');assertCellHintsOnly(planner);
  for(const [index,cell]of plan.walls.entries()){assert.equal(game.grid.occupy(cell.x,cell.z,index+1).ok,true);planner.sync();assertCellHintsOnly(planner);assert.equal(planner.progress.built,index+1);assert.equal(planner.progress.missing.length,plan.walls.length-index-1);assert.equal(planner.progress.conflict,false);assert.deepEqual(planner.plan.fire,fire);}
  assert.equal(planner.progress.built,plan.walls.length);assert.equal(planner.progress.missing.length,0);assert.deepEqual(planner.progress.route,game.grid.route);assert.ok(planner.group.children.every(child=>child.count===plan.core.length),'a finished blueprint leaves only its firing-position hints');
  planner.visible=false;planner.sync();assert.equal(planner.group.visible,false);assert.ok(planner.group.children.every(child=>!child.visible));planner.action('visibility');assert.equal(planner.group.visible,true);assertCellHintsOnly(planner);
  const limited=fixture(sidebar,{waveLimit:10});try{limited.planner.choose('commander');assert.equal(limited.planner.progress.overBudget,true);assert.equal(limited.game.constructionBudget.limit,50);assertCellHintsOnly(limited.planner);}finally{close(limited);}
 }finally{close(field);}
}));

test('the actual editor validates changed and sealed layouts, preserves gameplay state and restores current-route visibility',()=>environment(({sidebar,storage})=>{
 for(const showPath of [true,false]){
  const field=fixture(sidebar,{showPath}),{game,world,planner}=field,guide=guideGeometry(world.pathGroup),before=JSON.stringify({route:game.grid.route,occupied:[...game.grid.occupied],draws:game.draft.draws,cp:game.commandPoints,gold:game.economy.gold});game.paused=showPath;game.rng=()=>assert.fail('editor display must not consume RNG');
  try{
   planner.startEditor();assert.equal(game.paused,true);assert.equal(world.pathGroup.visible,false);assertCellHintsOnly(planner);planner.paint(2,4);planner.endStroke();assertCellHintsOnly(planner);assert.ok(planner.editorResult.plan.route.every(p=>p.x!==2||p.z!==4));assert.equal(planner.panel.querySelector('[data-maze="save"]').disabled,false);assertGuideUnchanged(world.pathGroup,guide);
   planner.action('undo');assert.equal(planner.editor.walls.length,0);assertCellHintsOnly(planner);planner.action('redo');assert.equal(planner.editor.walls.length,1);assertCellHintsOnly(planner);planner.panel.querySelector('#maze-name').value='A saved route-free plan';planner.saveEditor();
   assert.equal(planner.editing,false);assert.equal(world.pathGroup.visible,showPath);assert.equal(game.paused,showPath);assert.equal(planner.saved.at(-1).name,'A saved route-free plan');assert.deepEqual(JSON.parse(storage.get(BLUEPRINT_KEY)).plans.at(-1).walls,[{x:2,z:4}]);assertCellHintsOnly(planner);assertGuideUnchanged(world.pathGroup,guide);
   planner.startEditor({id:'sealed-fixture',name:'Sealed checkpoint',walls:[{x:3,z:18},{x:5,z:18},{x:4,z:17},{x:4,z:19}]});assert.equal(planner.editorResult.plan,undefined);assert.match(planner.editorResult.error,/seals a checkpoint/);assert.equal(planner.panel.querySelector('[data-maze="save"]').disabled,true);assertCellHintsOnly(planner);assert.ok(planner.group.children.every(child=>child.material.color.getHexString()==='ef806b'));planner.finishEditor();assert.equal(world.pathGroup.visible,showPath);
   assert.equal(JSON.stringify({route:game.grid.route,occupied:[...game.grid.occupied],draws:game.draft.draws,cp:game.commandPoints,gold:game.economy.gold}),before);
  }finally{close(field);}
 }
}));

test('planner hint redraw and disposal release resources without touching the separate actual-route geometry',()=>environment(({sidebar})=>{
 const field=fixture(sidebar),{world,planner}=field,guide=guideGeometry(world.pathGroup);
 try{
  planner.choose('commander');const old=[...planner.group.children];let disposed=0;for(const mesh of old){mesh.geometry.addEventListener('dispose',()=>disposed++);mesh.material.addEventListener('dispose',()=>disposed++);mesh.addEventListener('dispose',()=>disposed++);}
  planner.draw(planner.plan,planner.progress.missing);assert.equal(disposed,old.length*3);assert.ok(old.every(mesh=>!planner.group.children.includes(mesh)));assertCellHintsOnly(planner);assertGuideUnchanged(world.pathGroup,guide);
  const current=[...planner.group.children];let finalDisposals=0;for(const mesh of current)mesh.geometry.addEventListener('dispose',()=>finalDisposals++);planner.dispose();assert.equal(finalDisposals,current.length);assert.equal(planner.group.children.length,0);assert.equal(world.scene.children.includes(planner.group),false);assertGuideUnchanged(world.pathGroup,guide);
 }finally{disposeRouteOverlay(world.pathGroup);}
}));

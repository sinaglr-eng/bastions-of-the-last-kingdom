import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Box3,Vector3,Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Game} from '../game/core/game.js';
import {EconomyManager} from '../game/core/progression.js';
import {recipesUsing} from '../game/core/recipes.js';
import {damageAfterDefense} from '../game/core/math.js';
import {preparedBlueprints,blueprintProgress,validateBlueprint} from '../game/core/blueprints.js';
import {GridManager} from '../game/core/grid.js';
import {wallConnections,castleWallModel,WALL_DECK_HEIGHT} from '../game/render/walls.js';
import {enemyFigure,enemyAssetKey,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {beginDeath,animateDeath} from '../game/render/battle-animation.js';
const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const candidates=(tier=3)=>{const g=new Game(data,{seed:42});g.draft.forced={family:'soldier',tier};g.draft.roll(0);for(let x=10;x<15;x++)assert.ok(g.place(x,10));g.economy.gold=350;return g;};

test('downgrade charges once, keeps the lower rank and preserves all five occupied positions',()=>{
 const g=candidates(),t=g.selection,route=structuredClone(g.grid.route);assert.ok(g.downgrade());
 assert.equal(t.tier,2);assert.equal(t.state,'active');assert.equal(g.phase,'ready');assert.equal(g.economy.gold,150);
 assert.equal(g.towers.filter(t=>t.state==='ruin').length,4);assert.equal(g.grid.occupied.size,5);assert.deepEqual(g.grid.route,route);
 assert.equal(g.downgrade(),false);assert.equal(g.economy.gold,150);assert.equal(t.tier,2);
});
test('downgrade rejects insufficient funds, lowest rank, retained units and advanced defenders atomically',()=>{
 for(const mutate of [g=>g.economy.gold=199,g=>g.selection.tier=1,g=>g.keep(),g=>g.phase='combat',g=>g.selection.family=data.recipes[0].id]){
  const g=candidates();mutate(g);const snapshot=JSON.stringify([g.towers,g.economy.gold,g.phase]);
  assert.equal(g.downgrade(),false);assert.equal(JSON.stringify([g.towers,g.economy.gold,g.phase]),snapshot);
 }
});
test('potential combinations use the selected family AND tier, including repeated ingredients',()=>{
 const soldier={family:'soldier',tier:3,state:'draft'},matches=recipesUsing(soldier,data.recipes);
 assert.ok(matches.length);for(const r of matches)assert.ok(r.ingredients.some(i=>i.family==='soldier'&&i.tier===3));
 const rime=data.recipes.find(r=>data.towers[r.id].name==='Frostbolt Watchmen');assert.ok(rime);assert.ok(!matches.includes(rime));
 assert.ok(recipesUsing({...soldier,tier:1},data.recipes).includes(rime));assert.deepEqual(recipesUsing({...soldier,state:'ruin'},data.recipes),[]);
});
test('fifteen mastery stages reach the maximum before wave25 regardless of kill XP without spending gold',()=>{
 const eco=new EconomyManager(data.balance);assert.equal(data.balance.mastery.length,16);
 assert.equal(eco.upgradeMastery(),false);let first=null;
 for(const [i,w] of data.waves.entries()){
  eco.setConstructionRound(i+1);
  if(eco.mastery===15&&!first)first=i+1;
  const masteryBeforeCombat=eco.mastery;
  for(const g of w.groups){const e=data.enemies[g.type];eco.reward(0,g.count*e.xp);}
  eco.reward(w.reward,15);
  assert.equal(eco.mastery,masteryBeforeCombat,'Kills and wave completion XP cannot change the current construction stage');
 }
 assert.equal(first,25);assert.equal(eco.gold,3340);assert.ok(eco.level>1);const gold=eco.gold;assert.equal(eco.upgradeMastery(),false);assert.equal(eco.gold,gold);
 for(const [i,row] of data.balance.mastery.entries()){assert.equal(row.level,i+1);assert.equal(row.cost,undefined);assert.equal(row.weights.reduce((a,b)=>a+b,0),100);assert.equal(row.weights[5],0);}
});
test('lost lives stay lost in every phase even with unlimited gold',()=>{
 const g=new Game(data);g.lives=12;g.economy.gold=100000;
 for(const phase of ['build','select','ready','combat','won','lost']){g.phase=phase;assert.equal(g.repair(),false);assert.equal(g.lives,12);assert.equal(g.economy.gold,100000);}
});
test('construction budget counts spent draws, demolition and off-plan structures',()=>{
 const g=candidates();assert.deepEqual(g.constructionBudget,{limit:250,spent:5,remaining:245,occupied:5});g.keep();g.select(g.towers[0].id);assert.ok(g.remove());
 assert.deepEqual(g.constructionBudget,{limit:250,spent:5,remaining:245,occupied:4});g.startCombat();g.completeWave();assert.equal(g.constructionBudget.remaining,245);
 const grid=new GridManager(),plan=preparedBlueprints(JSON.parse(readFileSync('data/maze-blueprints.json','utf8'))).find(p=>p.id==='crown-crossfire');
 const outside={x:0,z:0};assert.ok(!plan.walls.some(p=>p.x===outside.x&&p.z===outside.z));grid.occupy(0,0,1);
 const progress=blueprintProgress(plan,grid,147);assert.equal(progress.projected,149);assert.equal(progress.overBudget,true);assert.equal(progress.offPlan,1);
 const oversize=Array.from({length:251},(_,i)=>({x:i%37,z:Math.floor(i/37)+10}));assert.ok(validateBlueprint(oversize).error);
});
test('retained defenders and ruins join the same wall, while drafts stay on the ground',()=>{
 const active={x:10,z:10,state:'active'},ruin={x:11,z:10,state:'ruin'},draft={x:9,z:10,state:'draft'};
 assert.equal(wallConnections(active,[active,ruin,draft]),2);assert.equal(wallConnections(ruin,[active,ruin,draft]),8);
 const platform=castleWallModel(10,true),bounds=new Box3().setFromObject(platform);
 assert.ok(Math.abs(bounds.max.y-WALL_DECK_HEIGHT)<.001);assert.ok(bounds.getSize(new Vector3()).z>=.94-.001);
});
test('orc roles reward complementary damage, and campaign health increases substantially',()=>{
 const plate=data.enemies.host_22,ward=data.enemies.host_17;
 assert.ok(damageAfterDefense(100,'fire',plate,{},data.balance)>damageAfterDefense(100,'physical',plate,{},data.balance)*2);
 assert.ok(damageAfterDefense(100,'holy',ward,{},data.balance)<100);
 assert.equal(damageAfterDefense(100,'pure',plate,{},data.balance),100);
 assert.equal(damageAfterDefense(100,'fire',data.enemies.host_26,{},data.balance),0);
 assert.equal(damageAfterDefense(100,'physical',data.enemies.host_23,{},data.balance),0);
 assert.ok(data.enemies.host_10.hp>4000);assert.ok(data.enemies.host_30.hp>110000);assert.ok(data.enemies.host_50.hp>1400000);
 assert.ok(data.enemies.host_19.beast);
});
test('all 59 native Blender v3 warbands retain their different dimensions, land on terrain and keep shared geometry isolated',async()=>{
 const manifest=JSON.parse(readFileSync('public/assets/enemies/manifest.json','utf8'));assert.equal(manifest.length,59);
 assert.ok(manifest.every(asset=>asset.id!=='host_05-balloon'));
 const templates=new Map(),loader=new GLTFLoader(),resources=new Set(),heights=[];
 let disposed=false;
 const pose=root=>{const result=[];root.traverse(o=>result.push([o.name,o.visible,o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()]));return JSON.stringify(result);};
 const geometryHash=root=>{
  const hash=createHash('sha256');root.traverse(o=>{if(o.isMesh){for(const attribute of [o.geometry.attributes.position,o.geometry.attributes.normal,o.geometry.index])if(attribute)hash.update(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));}});return hash.digest('hex');
 };
 try{
  for(const asset of manifest){
   assert.ok(Number.isInteger(asset.triangles)&&asset.triangles>0&&asset.triangles<=30000);assert.equal(asset.authoring,'Blender 5.2');assert.equal(asset.revision,'dark-host-v3');assert.equal(asset.nativeScale,1);
   assert.ok(asset.source.startsWith('blender/scenes/enemies-v3/'));assert.ok(existsSync(asset.source),`${asset.id} editable source`);
   const png=readFileSync(`public/assets/enemies/${asset.portrait}`);assert.equal(png.readUInt32BE(0),0x89504e47);
   const bytes=readFileSync(`public/assets/enemies/${asset.file}`),gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
   const bounds=new Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new Vector3()),stats=data.enemies[asset.id.split('-')[0]];
   assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));assert.ok(size.x>0&&size.y>0&&size.z>0);
   // Blender records Z as height, while GLTF uses Y. Rotated source bounds can
   // slightly exceed the actual vertices; no common-height normalization applies.
   assert.ok(Math.abs(size.y-asset.height)<.1,`${asset.id} keeps native height ${asset.height}: ${size.y}`);
   assert.ok(Math.abs(size.x-asset.wingspan)<.1,`${asset.id} keeps native span ${asset.wingspan}: ${size.x}`);
   if(!stats.flying)assert.ok(Math.abs(bounds.min.y)<.01,`${asset.id} stands on its native feet`);
   let triangles=0;gltf.scene.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;resources.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:[o.material])resources.add(material);o.geometry.addEventListener('dispose',()=>disposed=true);}});
   assert.equal(triangles,asset.triangles,`${asset.id} actual triangle count`);heights.push(size.y);templates.set(asset.id,gltf.scene);
  }
  assert.ok(Math.max(...heights)-Math.min(...heights)>2,'species and bosses retain intentionally different native heights');
  const figure=enemyFigure({type:'host_14',...data.enemies.host_14},templates);assert.equal(figure.userData.shards.children.length,3);
  assert.ok(figure.userData.limbs.length>=2);assert.ok(figure.userData.sharedAsset);disposeEnemyFigure(figure);assert.equal(disposed,false);
  assert.equal(enemyAssetKey({type:'host_05',model:'balloon'},templates),'host_05','the obsolete balloon does not remain active');
  assert.equal(enemyAssetKey({type:'host_50',model:'dragon',visualAsset:'host_50-tyrant'},templates),'host_50-tyrant','explicit variant art wins over the unchanged gameplay model');
  for(const entry of manifest){
   const base=entry.id.split('-')[0],stats=data.enemies[base],enemy={...stats,type:base,visualAsset:entry.id};
   const template=templates.get(entry.id),templatePose=pose(template),originalGeometry=geometryHash(template);
   const corpse=enemyFigure(enemy,templates),survivor=enemyFigure(enemy,templates),survivorPose=pose(survivor);
   assert.equal(corpse.userData.assetKey,entry.id,`${entry.id} actually loads its own variant geometry`);
   const shared=new Set();template.traverse(o=>{if(o.isMesh)shared.add(o.geometry);});
   corpse.userData.body.traverse(o=>{if(o.isMesh)assert.ok(shared.has(o.geometry),`${entry.id} shares rather than duplicates geometry`);});
   corpse.position.y=stats.flying?.8:0;
   corpse.userData.limbs?.forEach((limb,i)=>limb.rotation.x=(limb.userData.restRotation||0)+(i%2?-.42:.42));
   corpse.userData.wings?.forEach((wing,i)=>wing.rotation.z=(wing.userData.restRotation||0)+(i%2?-.26:.26));
   beginDeath(corpse,stats);animateDeath(corpse,2);corpse.updateMatrixWorld(true);
   assert.ok(Math.abs(new Box3().setFromObject(corpse.userData.body,true).min.y-.025)<1e-5,`${entry.id} corpse rests on terrain`);
   assert.equal(pose(template),templatePose,`${entry.id} death leaves the cached template pose untouched`);
   assert.equal(pose(survivor),survivorPose,`${entry.id} death leaves a simultaneously living figure untouched`);
   assert.equal(geometryHash(template),originalGeometry,`${entry.id} death does not rewrite shared vertices`);
   disposeEnemyFigure(corpse);disposeEnemyFigure(survivor);assert.equal(disposed,false,`${entry.id} disposal preserves shared geometry`);
  }
 }finally{for(const resource of resources)resource.dispose();}
});

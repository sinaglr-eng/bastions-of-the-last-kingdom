import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
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
 const rime=data.recipes.find(r=>data.towers[r.id].name==='Rime Griffin Rider');assert.ok(rime);assert.ok(!matches.includes(rime));
 assert.ok(recipesUsing({...soldier,tier:1},data.recipes).includes(rime));assert.deepEqual(recipesUsing({...soldier,state:'ruin'},data.recipes),[]);
});
test('mastery has fifteen gradual upgrades and perfect income first reaches maximum after wave 30',()=>{
 const eco=new EconomyManager(data.balance);assert.equal(data.balance.mastery.length,16);
 assert.equal(data.balance.mastery.reduce((sum,m)=>sum+m.cost,0),6500);
 while(eco.upgradeMastery());let first=null;
 for(const [i,w] of data.waves.entries()){
  for(const g of w.groups){const e=data.enemies[g.type];eco.reward(g.count*e.gold,g.count*e.xp);}
  eco.reward(w.reward,15);while(eco.upgradeMastery());
  if(eco.mastery===15&&!first)first=i+1;
 }
 assert.equal(first,30);const gold=eco.gold;assert.equal(eco.upgradeMastery(),false);assert.equal(eco.gold,gold);
 for(const row of data.balance.mastery){assert.equal(row.weights.reduce((a,b)=>a+b,0),100);assert.equal(row.weights[5],0);}
});
test('lost lives stay lost in every phase even with unlimited gold',()=>{
 const g=new Game(data);g.lives=12;g.economy.gold=100000;
 for(const phase of ['build','select','ready','combat','won','lost']){g.phase=phase;assert.equal(g.repair(),false);assert.equal(g.lives,12);assert.equal(g.economy.gold,100000);}
});
test('construction budget counts spent draws, demolition and off-plan structures',()=>{
 const g=candidates();assert.deepEqual(g.constructionBudget,{limit:250,spent:5,remaining:245,occupied:5});g.keep();g.select(g.towers[0].id);assert.ok(g.remove());
 assert.deepEqual(g.constructionBudget,{limit:250,spent:5,remaining:245,occupied:4});g.startCombat();g.completeWave();assert.equal(g.constructionBudget.remaining,245);
 const grid=new GridManager(),plan=preparedBlueprints(JSON.parse(readFileSync('data/maze-blueprints.json','utf8'))).find(p=>p.walls.length===250);
 const outside={x:0,z:0};assert.ok(!plan.walls.some(p=>p.x===outside.x&&p.z===outside.z));grid.occupy(0,0,1);
 const progress=blueprintProgress(plan,grid,249);assert.equal(progress.projected,251);assert.equal(progress.overBudget,true);assert.equal(progress.offPlan,1);
 assert.ok(validateBlueprint([...plan.walls,outside]).error);
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
test('every Blender warband asset has a portrait, editable source, correct scale and safe shared instances',async()=>{
 const manifest=JSON.parse(readFileSync('public/assets/enemies/manifest.json','utf8'));assert.equal(manifest.length,51);
 const templates=new Map(),loader=new GLTFLoader();
 for(const asset of manifest){
  assert.ok(asset.triangles<10000);assert.equal(asset.authoring,'Blender');
  assert.ok(existsSync(`blender/scenes/enemies/${asset.id}.blend`));
  const png=readFileSync(`public/assets/enemies/${asset.portrait}`);assert.equal(png.readUInt32BE(0),0x89504e47);
  const bytes=readFileSync(`public/assets/enemies/${asset.file}`),gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const bounds=new Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new Vector3()),stats=data.enemies[asset.id.split('-')[0]];
  assert.ok(stats.boss?size.y>=3.0&&size.y<=3.6:size.y>=1.81&&size.y<=1.99,`${asset.id}: ${size.y}`);
  assert.ok(Math.abs(bounds.min.y)<.01,`${asset.id} grounded`);templates.set(asset.id,gltf.scene);
 }
 const figure=enemyFigure({type:'host_14',...data.enemies.host_14},templates);assert.equal(figure.userData.shards.children.length,3);
 assert.ok(figure.userData.limbs.length>=2);assert.ok(figure.userData.sharedAsset);
 let disposed=false;templates.get('host_14').traverse(o=>{if(o.isMesh)o.geometry.addEventListener('dispose',()=>disposed=true);});disposeEnemyFigure(figure);assert.equal(disposed,false);
 assert.equal(enemyAssetKey({type:'host_05',model:'balloon'},templates),'host_05-balloon');
 for(const entry of manifest){
  const stats=data.enemies[entry.id.split('-')[0]],corpse=enemyFigure({type:entry.id,...stats},templates);
  corpse.position.y=stats.flying?.8:0;
  corpse.userData.limbs?.forEach((limb,i)=>limb.rotation.x=(limb.userData.restRotation||0)+(i%2?-.42:.42));
  corpse.userData.wings?.forEach((wing,i)=>wing.rotation.z=(wing.userData.restRotation||0)+(i%2?-.26:.26));
  beginDeath(corpse,stats);animateDeath(corpse,2);corpse.updateMatrixWorld(true);
  assert.ok(Math.abs(new Box3().setFromObject(corpse.userData.body,true).min.y-.025)<1e-5,`${entry.id} corpse rests on terrain`);
  disposeEnemyFigure(corpse);
 }
});

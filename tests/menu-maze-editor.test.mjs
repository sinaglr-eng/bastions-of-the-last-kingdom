import test from 'node:test';
import assert from 'node:assert/strict';
import {MenuMazeEditor} from '../ui/menu-maze-editor.js';
import {loadBlueprintLibrary,saveBlueprintLibrary,validateBlueprint,BLUEPRINT_KEY} from '../game/core/blueprints.js';
import {CHECKPOINTS} from '../game/core/grid.js';
import {homeMenuMarkup} from '../ui/home-menu.js';
import {championCatalogModel} from '../ui/catalog-recipes.js';
import {currentFactionData} from '../game/core/current-data.js';
import {Game} from '../game/core/game.js';

const storage=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
const editorFor=(store,onSaved=()=>{})=>{const editor=new MenuMazeEditor({storage:store,onSaved});editor.library=()=>{};editor.update=()=>{};editor.feedback=(text,error)=>{editor.notice={text,error};};return editor;};
test('Home blueprint save is immediately compatible with the actual in-game planner and survives reopening',()=>{
 const store=storage(),calls=[],editor=editorFor(store,p=>calls.push(p));editor.name='Northern crossing';editor.editor.paint(9,10);editor.editor.paint(9,11);editor.editor.end();assert.equal(editor.save(),true);
 const library=loadBlueprintLibrary(store);assert.equal(library.plans.length,1);assert.equal(library.selected,calls[0].id);assert.deepEqual(library.plans[0].walls,[{x:9,z:10},{x:9,z:11}]);assert.ok(library.plans[0].route.length>1);
 const reopened=editorFor(store);assert.equal(reopened.name,'Northern crossing');assert.deepEqual(reopened.editor.walls,editor.editor.walls);reopened.editor.paint(9,12);reopened.editor.end();assert.equal(reopened.save(),true);assert.equal(loadBlueprintLibrary(store).plans.length,1,'editing updates rather than duplicates');assert.equal(calls.length,1);
});
test('An invalid sealed route never replaces a selected blueprint, spends nothing and can be undone',()=>{
 const store=storage(),calls=[],editor=editorFor(store,p=>calls.push(p));assert.equal(editor.save(),true);const original=store.getItem(BLUEPRINT_KEY),start=CHECKPOINTS[0];for(const [dx,dz]of [[1,0],[0,1],[0,-1]])editor.editor.paint(start.x+dx,start.z+dz);editor.editor.end();assert.equal(editor.save(),false);assert.match(editor.notice.text,/seals a checkpoint/);assert.equal(store.getItem(BLUEPRINT_KEY),original);assert.equal(calls.length,1);editor.editor.undo();assert.equal(editor.editor.validate().error,undefined);
 for(const p of CHECKPOINTS)assert.equal(editor.editor.paint(p.x,p.z),false);
});
test('Storage failure preserves the drawing and does not notify a live game or pretend to save',()=>{
 const calls=[],editor=editorFor({getItem:()=>null,setItem:()=>{throw Error('Quota');}},p=>calls.push(p));editor.editor.paint(4,5);editor.editor.end();editor.dirty=true;assert.equal(editor.save(),false);assert.equal(editor.id,null);assert.equal(editor.dirty,true);assert.deepEqual(editor.editor.walls,[{x:4,z:5}]);assert.match(editor.notice.text,/storage is unavailable/);assert.equal(calls.length,0);
});
test('A full library permits updating a saved drawing and refuses a twenty-first blueprint',()=>{
 const store=storage(),plan=validateBlueprint([],'Example').plan;assert.equal(saveBlueprintLibrary(store,Array.from({length:20},(_,i)=>({...plan,id:'custom-'+i})),null),true);const editor=editorFor(store);assert.equal(editor.save(),false);assert.match(editor.notice.text,/20 blueprints/);editor.id='custom-3';assert.equal(editor.save(),true);assert.equal(loadBlueprintLibrary(store).plans.length,20);
});
test('Home shows exactly three real equipped skill slots and a truthful empty continuation',()=>{
 const html=homeMenuMarkup({player:{user:{name:'Commander'},profile:{equipped:['deep-refit','war-horn'],skills:{'deep-refit':2,'war-horn':1}}},saved:null});assert.match(html,/No saved game/);assert.doesNotMatch(html,/war-destinations|Your next medal|Continue Defense|Begin Defense/);assert.equal((html.match(/class="home-skill-slot/g)||[]).length,3);assert.match(html,/Deep Refit/);assert.match(html,/Rank II/);assert.match(html,/War Horn/);assert.match(html,/data-nav="maze"/);
});
test('Lady Claire stays secret across every faction even when selected directly or already discovered',()=>{
 for(const faction of ['crown','forge','grove']){const data=currentFactionData(faction),game=new Game(data,{seed:23});game.discoveries.add('ladyclaire');const model=championCatalogModel(game,data,{recipeId:'ladyclaire',query:'Lady Claire'});assert.equal(model.rows.some(r=>r.family==='ladyclaire'),false);assert.equal(model.matches.length,0);assert.equal(model.selected,null);assert.ok(game.recipes.some(r=>(r.resultFamily||r.id)==='ladyclaire'),'the secret recipe still exists in the real rules');}
});

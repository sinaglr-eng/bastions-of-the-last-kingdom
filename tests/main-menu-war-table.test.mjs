import test from 'node:test';
import assert from 'node:assert/strict';
import {homeMenuMarkup,replaceRunMarkup} from '../ui/home-menu.js';
import {MainMenu} from '../ui/main-menu.js';

const saved={meta:{phase:'combat',factionId:'crown',round:7,elapsedSeconds:93},savedAt:1};
test('Guest can choose a new faction and keep an independent saved continuation; account actions are locked',()=>{
 const html=homeMenuMarkup({player:{user:null},saved,selectedFaction:'grove'});
 assert.match(html,/data-new-faction="grove" aria-pressed="true"/);assert.match(html,/New Game · Elves/);assert.match(html,/Human<\/h3><strong>Wave 7/);
 for(const page of ['achievements','general'])assert.match(html,new RegExp(`data-nav="${page}"[^>]*disabled`));
 assert.doesNotMatch(html,/data-nav="settings"/);
 const account=homeMenuMarkup({player:{user:{id:'player'}},saved,selectedFaction:'forge'});assert.doesNotMatch(account,/data-nav="(?:achievements|general)" disabled/);
});
test('Guest cannot navigate directly into account-only menu pages',async()=>{
 for(const page of ['general','achievements','account']){const opened=[];let message;await MainMenu.prototype.show.call({player:{user:null},show:async p=>opened.push(p),status:text=>{message=text;}},page);assert.deepEqual(opened,['sign-in']);assert.match(message,/Sign in/);}
});
test('Starting a selected faction commits only once while model preparation is pending and clears busy state on failure',async()=>{
 const attrs=new Map(),calls=[];let finish;const pending=new Promise(resolve=>{finish=resolve;});
 const menu=Object.create(MainMenu.prototype);Object.assign(menu,{root:{setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},status:()=>{},onNew:async options=>{calls.push(options);await pending;}});
 const first=menu.startNewRun('forge');await menu.startNewRun('grove');assert.deepEqual(calls,[{factionId:'forge',replace:false}]);assert.equal(attrs.get('aria-busy'),'true');finish();await first;assert.equal(menu.starting,false);assert.equal(attrs.has('aria-busy'),false);
 menu.onNew=async()=>{throw Error('Model unavailable');};await assert.rejects(menu.startNewRun('grove'),/Model unavailable/);assert.equal(menu.starting,false);assert.equal(attrs.has('aria-busy'),false);
});
test('Replacement confirmation names the existing run and intended faction; cancel closes without starting a run',()=>{
 const html=replaceRunMarkup(saved,'forge');assert.match(html,/Human · Wave 7/);assert.match(html,/Your next alliance <strong>Dwarves/);assert.match(html,/data-menu="cancel-replace"/);
 let closed=0,removed=0,focused=0;const menu=Object.create(MainMenu.prototype);Object.assign(menu,{pendingNewFaction:'forge',replaceDialog:{close:()=>closed++,remove:()=>removed++},root:{querySelector:()=>({focus:()=>focused++})}});menu.closeReplace();assert.equal(menu.pendingNewFaction,null);assert.equal(menu.replaceDialog,null);assert.equal(closed,1);assert.equal(removed,1);assert.equal(focused,1);
});

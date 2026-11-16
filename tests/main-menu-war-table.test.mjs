import test from 'node:test';
import assert from 'node:assert/strict';
import {homeMenuMarkup,replaceRunMarkup} from '../ui/home-menu.js';
import {MainMenu} from '../ui/main-menu.js';

const saved={meta:{phase:'combat',factionId:'crown',round:7,elapsedSeconds:93},savedAt:1};
test('Guest can choose a new faction and keep an independent saved continuation; account actions are locked',()=>{
 const html=homeMenuMarkup({player:{user:null},saved,selectedFaction:'grove'});
 assert.match(html,/data-new-faction="grove" aria-pressed="true"/);assert.match(html,/New Game · Elves/);assert.match(html,/Human<\/h3><strong>Wave 7/);
 assert.doesNotMatch(html,/war-destinations|Your next medal/);assert.match(html,/data-nav="maze"/);assert.equal((html.match(/Sign in to equip skills, slot/g)||[]).length,3);
 const shell=MainMenu.prototype.shell.call({page:'home',player:{user:null}},'',html);for(const page of ['achievements','general'])assert.match(shell,new RegExp(`data-nav="${page}"[^>]*disabled`));
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

function replacementMenu(t,{continuation=saved,onNew=async()=>{}}={}){
 const original=globalThis.document,events={},status={textContent:'',classList:{toggle(){}}},buttons=['cancel-replace','confirm-new'].map(action=>({dataset:{menu:action},disabled:false,hasAttribute(){return false;},focus(){this.focused=true;}}));
 const dialog={open:false,isConnected:false,attrs:new Map(),setAttribute(k,v){this.attrs.set(k,v);},removeAttribute(k){this.attrs.delete(k);},addEventListener(k,fn){events[k]=fn;},showModal(){this.open=true;},close(){this.open=false;events.close?.();},remove(){this.isConnected=false;},querySelector(s){return s==='[data-menu-status]'?status:buttons[0];},querySelectorAll(){return buttons;}};
 globalThis.document={createElement:()=>dialog};t.after(()=>{if(original===undefined)delete globalThis.document;else globalThis.document=original;});
 const calls=[],attrs=new Map(),menu=Object.create(MainMenu.prototype);
 Object.assign(menu,{player:{store:{get:()=>{throw Error('A suspended IndexedDB read must not gate confirmation');}}},displayedSave:continuation,selectedFaction:'forge',commanderVault:{click:async()=>false},root:{append:d=>{d.isConnected=true;},querySelector:s=>s==='[data-menu-status]'?status:buttons[0],setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},onNew:async options=>{calls.push(options);await onNew(options);}});
 const click=action=>menu.click({target:{closest:()=>action==='new'?{dataset:{menu:'new'}}:buttons.find(b=>b.dataset.menu===action)}});
 return {menu,dialog,buttons,status,calls,click,events};
}

test('New Game opens confirmation in the original tap, without another storage read or unrelated async handler',async t=>{
 const f=replacementMenu(t);let vaultCalls=0;f.menu.commanderVault.click=()=>{vaultCalls++;return new Promise(()=>{});};
 const pending=f.click('new');assert.equal(f.dialog.open,true);assert.equal(vaultCalls,0);assert.equal(f.menu.pendingNewFaction,'forge');assert.equal(f.calls.length,0);await pending;
});
test('Cloud-only continuation and an in-memory run both require confirmation before replacement',async t=>{
 const f=replacementMenu(t,{continuation:{meta:{phase:'playing',factionId:'grove',round:12}}});await f.click('new');assert.equal(f.dialog.open,true);assert.match(f.dialog.innerHTML,/Elves · Wave 12/);f.menu.closeReplace();
 f.menu.displayedSave=null;f.menu.player.game={phase:'combat',factionId:'crown',round:8};await f.click('new');assert.equal(f.dialog.open,true);assert.match(f.dialog.innerHTML,/Human · Wave 8/);assert.equal(f.calls.length,0);
});
test('Cancelling replacement preserves the continuation and starts nothing',async t=>{
 const f=replacementMenu(t);await f.click('new');await f.click('cancel-replace');assert.equal(f.dialog.open,false);assert.equal(f.menu.displayedSave,saved);assert.equal(f.calls.length,0);
});
test('Confirmation keeps progress visible, captures the chosen faction and ignores double activation',async t=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve;}),f=replacementMenu(t,{onNew:()=>pending});await f.click('new');f.menu.selectedFaction='grove';
 const first=f.click('confirm-new');await Promise.resolve();assert.equal(f.menu.starting,true);assert.equal(f.dialog.open,true);assert.ok(f.buttons.every(b=>b.disabled));assert.match(f.status.textContent,/Preparing/);await f.click('confirm-new');assert.deepEqual(f.calls,[{factionId:'forge',replace:true}]);
 finish();await first;assert.equal(f.dialog.open,false);assert.equal(f.menu.starting,false);
});
test('Failed replacement stays open with an error and can retry without losing the original continuation',async t=>{
 let attempt=0;const f=replacementMenu(t,{onNew:async()=>{if(!attempt++)throw Error('Connect to start this account run');}});await f.click('new');await f.click('confirm-new');
 assert.equal(f.dialog.open,true);assert.match(f.status.textContent,/Connect/);assert.equal(f.menu.pendingNewFaction,'forge');assert.equal(f.menu.displayedSave,saved);assert.ok(f.buttons.every(b=>!b.disabled));
 await f.click('confirm-new');assert.equal(f.calls.length,2);assert.equal(f.dialog.open,false);
});
test('No continuation starts a new run without replacement permission',async t=>{
 const f=replacementMenu(t,{continuation:null});await f.click('new');assert.deepEqual(f.calls,[{factionId:'forge',replace:false}]);assert.equal(f.dialog.open,false);
});

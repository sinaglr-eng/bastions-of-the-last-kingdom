import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {createFactionData,factionProfile} from '../game/core/factions.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';
import {factionImpact,updateFactionTower} from '../game/core/faction-combat.js';
import {combatTowerStats,towerStats} from '../game/core/math.js';
import {StatisticsClient} from '../game/core/statistics-client.js';
import {loadProfile,saveProfile,recordRunResult} from '../game/core/save.js';
import {chooseFaction} from '../ui/faction-selection.js';
import {expandedRecipeProgress} from '../game/core/recipes.js';
const read=f=>JSON.parse(readFileSync(new URL('../'+f,import.meta.url))),registry=read('data/factions-v060.json');
const current={balance:read('data/balance.json'),towers:campaignTowers(read('data/towers.json')),enemies:campaignEnemies(read('data/enemies.json')),waves:campaignWaves(read('data/waves.json')),recipes:campaignRecipes(read('data/recipes.json'))};
const data=id=>createFactionData(current,registry,id),memory=()=>{const values=new Map();return{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
function arena(faction='grove',family='el_moonblade'){
 const g=new Game(data(faction),{seed:7}),t={id:1,family,tier:1,state:'active',x:18,z:17,cooldown:0,kills:0};g.towers.push(t);g.phase='combat';g.combat.spawnQueue=[{time:999999,type:'host_01'}];
 const spawn=(x=18,z=18)=>{const e=g.combat.spawn('host_01');Object.assign(e,{x,z,speed:0,hp:1e7,maxHp:1e7,armor:0});return e;};return {g,t,spawn};
}
const profile=(abilities,extra={})=>factionProfile({damage:100,interval:1,range:6,type:'magical',abilities,...extra});
const ability=(id)=>structuredClone(registry.factions.flatMap(f=>f.units).flatMap(u=>u.profiles).flatMap(p=>p.abilities).find(a=>a.familyId===id));
test('each closed recipe graph expands legally and direct foreign retain/craft requests fail at game rules',()=>{
 for(const id of ['crown','forge','grove']){const d=data(id),g=new Game(d,{seed:1});for(const recipe of d.recipes)assert.ok(expandedRecipeProgress(recipe,[],d).length);g.draft.forced={family:id==='crown'?'dw_shieldguard':'soldier',tier:1};g.draft.roll(0);assert.throws(()=>g.draft.reveal(0),/faction/);const t={id:1,family:g.draft.forced.family,tier:1,state:'draft',round:1,x:18,z:17};g.towers.push(t);g.selected=1;g.phase='select';assert.equal(g.keep(),false);assert.deepEqual(g.availableRecipes(),[]);assert.equal(g.craft('foreign-recipe'),false);}
});
test('selected-faction direct attacks honor the player target-priority control',()=>{
 const {g,t,spawn}=arena(),a=spawn(),b=spawn(18.2,18);a.hp=100;b.hp=200;t.priority='strongest';updateFactionTower(g.combat,t,towerStats(t,g.data),.1,1);assert.equal(g.combat.projectiles[0].target,b);
});
test('Moon Strike uses unbuffed listed damage on its fifth release even if the primary is immune',()=>{
 const {g,t,spawn}=arena(),e=spawn();e.magicImmune=true;const s=profile([ability('moon-strike')]);s.damage=900;
 factionImpact(g.combat,{source:t,target:e,stats:s,firstPrimary:true,directTargets:[e],releaseCount:5});assert.equal(e.hp,1e7-25);
});
test('Ricochet excludes all primary victims and never inherits buffs, criticals or on-hit poison',()=>{
 const {g,t,spawn}=arena(),a=spawn(),b=spawn(18.3,18),c=spawn(18.6,18);g.rng=()=>0;
 const ricochet=ability('ricochet');ricochet.chancePercent=100;const poison={familyId:'poison',dps:20,duration:3};
 const s=profile([ricochet,poison]);s.damage=900;
 factionImpact(g.combat,{source:t,target:a,stats:s,firstPrimary:true,directTargets:[a,b],releaseCount:1});assert.equal(a.hp,1e7-900);assert.equal(b.hp,1e7);assert.equal(c.hp,1e7-50);assert.equal(c.statuses.poison,undefined);
});
test('Heat bursts around the current target and excludes airborne neighbors',()=>{
 const {g,t,spawn}=arena('forge','dw_musketeer'),center=spawn(21,17),near=spawn(21.4,17),far=spawn(18,16),air=spawn(21.2,17);air.flying=true;center.traveled=100;
 const a=ability('heat'),s=profile([a],{damage:0});g.combat.elapsed=a.cooldown;updateFactionTower(g.combat,t,s,.01,1);
 assert.equal(center.hp,1e7-a.damage);assert.equal(near.hp,1e7-a.damage);assert.equal(far.hp,1e7);assert.equal(air.hp,1e7);
});
test('suppression waits for a matching immune enemy and restores immunity without changing its intrinsic flag',()=>{
 const {g,t,spawn}=arena(),ordinary=spawn(),immune=spawn(18.2,18);immune.magicImmune=true;
 const a=ability('cancel-magic-immunity'),s=profile([a],{damage:0});g.combat.elapsed=a.cooldown;updateFactionTower(g.combat,t,s,.01,1);
 assert.equal(ordinary.statuses.breachMagic,undefined);assert.equal(immune.magicImmune,true);assert.equal(g.combat.damage(immune,100,'magical',{},t),50);
 delete immune.statuses.breachMagic;assert.equal(g.combat.damage(immune,100,'magical',{},t),0);
});
test('Root stops movement without granting the physical vulnerability of Freeze',()=>{
 const {g,t,spawn}=arena(),e=spawn();e.speed=1;const a=ability('root'),s=profile([a],{damage:0});g.combat.elapsed=a.cooldown;updateFactionTower(g.combat,t,s,.01,1);
 assert.ok(e.statuses.root);assert.equal(e.statuses.freeze,undefined);assert.equal(g.combat.damage(e,100,'physical',{},t),100);const position=[e.x,e.z];g.combat.update(.1);assert.deepEqual([e.x,e.z],position);
});
test('continuous cones cover all ground victims inside their angle and accept direct range support',()=>{
 const {g,t,spawn}=arena('forge','dw_steamharpooner'),first=spawn(18,19.5),near=spawn(18.2,19.4),side=spawn(20,17),air=spawn(18.1,19);air.flying=true;
 first.traveled=100;const provider=Object.keys(g.data.towers).find(family=>towerStats({family,tier:g.data.towers[family].advanced?1:6},g.data).abilities?.some(a=>a.familyId==='range-aura'));
 g.towers.push({id:2,family:provider,tier:g.data.towers[provider].advanced?1:6,state:'active',x:17,z:17});const {stats:s}=combatTowerStats(t,g.towers,g.data);assert.ok(s.range>towerStats(t,g.data).range);
 updateFactionTower(g.combat,t,s,.1,1);assert.ok(first.hp<1e7);assert.ok(near.hp<1e7);assert.equal(side.hp,1e7);assert.equal(air.hp,1e7);
});
test('new waves reset faction ability clocks and magazines; a zero attack rate cannot create infinite cooldown',()=>{
 const {g,t,spawn}=arena('forge','dw_musketeer');spawn();t.factionClocks={heat:900};t.weaponCycleState={remaining:0,start:500,readyAt:900};t.executionReadyAt=500;t.factionReleases=44;
 g.combat.start(g.wave);assert.equal(t.weaponCycleState,undefined);assert.equal(t.factionClocks,undefined);assert.equal(t.factionReleases,0);
 spawn();updateFactionTower(g.combat,t,towerStats(t,g.data),.1,0);assert.ok(Number.isFinite(t.cooldown));updateFactionTower(g.combat,t,towerStats(t,g.data),.1,1);assert.equal(g.combat.projectiles.length,1);
});
test('offline faction A checkpoints retain A when a faction B client later drains the shared outbox',async()=>{
 const oldWindow=globalThis.window;globalThis.window={addEventListener(){},removeEventListener(){}};const storage=memory(),sent=[];let online=false;
 const fetcher=async(url,options)=>{if(!online)throw Error('offline fixture');const body=JSON.parse(options.body);sent.push({url,body});return Response.json({saved:true});};
 const aGame=new Game(data('forge'),{seed:1}),a=new StatisticsClient(aGame,{storage,fetcher,endpoint:'https://scores.example'});await a.flush();aGame.place(18,17);await a.flush();const id=a.tracker.id;a.dispose();
 online=true;const b=new StatisticsClient(new Game(data('grove'),{seed:2}),{storage,fetcher,endpoint:'https://scores.example'});await b.flush();
 try{const creation=sent.find(x=>x.url.endsWith('/api/runs')&&x.body.id===id),checkpoint=sent.find(x=>x.body.snapshot?.id===id);assert.equal(creation.body.factionId,'forge');assert.equal(checkpoint.body.snapshot.factionId,'forge');assert.equal(b.tracker.factionId,'grove');assert.deepEqual(b.readQueue(),[]);}finally{b.dispose();globalThis.window=oldWindow;}
});
test('stale pre-faction local writes cannot create an unattributed copy of an already attributed best',()=>{
 const previous=globalThis.localStorage;globalThis.localStorage=memory();try{const profile=loadProfile(),g=new Game(data('forge'),{seed:1});g.phase='lost';g.score=123;const row=recordRunResult(profile,g,{id:'same-run'});saveProfile(profile);const stale={...structuredClone(profile),runHistory:[{...row,factionId:undefined}],bestScores:[{...row,factionId:undefined,score:999}]};saveProfile(stale);const after=loadProfile();assert.equal(after.runHistory[0].factionId,'forge');assert.equal(after.bestScores.filter(x=>x.id==='same-run').length,1);assert.equal(after.bestScores.find(x=>x.id==='same-run').factionId,'forge');}finally{globalThis.localStorage=previous;}
});
class Element{
 constructor(dataset={}){this.dataset=dataset;this.events={};this.isConnected=true;this.disabled=false;this.textContent='';this.attrs={};}
 addEventListener(type,fn){this.events[type]=fn;}setAttribute(k,v){this.attrs[k]=v;}showModal(){}close(){}remove(){this.isConnected=false;}
 querySelector(q){return this.children[q];}querySelectorAll(){return this.cards;}async click(){return this.events.click?.();}
}
function chooserDom(){const dialog=new Element(),action=new Element(),status=new Element(),cancel=new Element();dialog.cards=['crown','forge','grove'].map(faction=>new Element({faction}));dialog.children={'[data-confirm]':action,'.faction-status':status,'[data-cancel]':cancel};return {dialog,action,status,cancel,document:{createElement:()=>dialog,body:{append(){}}}};}
test('faction chooser performs no preparation before explicit confirmation and ignores repeated submits',async()=>{
 const old=globalThis.document,dom=chooserDom();globalThis.document=dom.document;let count=0,complete;const prepared=new Promise(resolve=>{complete=resolve;});
 try{const choice=chooseFaction({registry,confirm:async id=>{assert.equal(id,'grove');count++;await prepared;}});assert.equal(count,0);let prevented=false;dom.dialog.events.cancel({preventDefault(){prevented=true;}});assert.ok(prevented);assert.ok(dom.dialog.isConnected);await dom.dialog.cards[2].click();assert.equal(count,0);const first=dom.action.click();await dom.action.click();assert.equal(count,1);complete();await first;assert.equal(await choice,true);}finally{globalThis.document=old;}
});
test('replacement cancellation aborts pending preparation and failed preparation leaves the selected choice retryable',async()=>{
 const old=globalThis.document,dom=chooserDom();globalThis.document=dom.document;let count=0,signal;
 try{const choice=chooseFaction({registry,replace:true,confirm:async(id,options)=>{signal=options.signal;if(++count===1)throw Error('unavailable fixture');await new Promise(resolve=>signal.addEventListener('abort',resolve));}});await dom.dialog.cards[1].click();await dom.action.click();assert.match(dom.status.textContent,/Try again/);assert.equal(dom.action.disabled,false);const pending=dom.action.click();await dom.cancel.click();assert.equal(await choice,false);assert.ok(signal.aborted);await pending;assert.equal(count,2);}finally{globalThis.document=old;}
});

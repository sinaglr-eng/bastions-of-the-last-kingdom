import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {IDBFactory} from 'fake-indexeddb';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {PlayerClient} from '../game/player-client.js';
import {RunStore} from '../game/run-store.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {applyPreparedDraftSkill,draftSkillActionsMarkup,preparedDraftSkill,toggleDraftSkill} from '../ui/draft-skill-targeting.js';
import {wallPanelMarkup} from '../ui/wall-panel.js';
import {AchievementNotices} from '../ui/achievement-notices.js';
import {CommanderVault} from '../ui/commander-vault.js';
import {ARTIFACT_CATALOG as C} from '../game/core/artifacts.js';
import {rankOverviewMarkup} from '../ui/account-progression.js';
import {commanderArt,commanderSkillArt,commanderUtilityArt} from '../ui/commander-art.js';
import {GENERAL_SKILLS} from '../game/core/general.js';

test('Deep Refit appears once beside draft actions and charges only when a valid target is chosen',()=>{
 const g=new Game(currentFactionData('forge'),{seed:14,loadout:{'deep-refit':1}});
 for(const [x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])g.place(x,z);
 const [a,b,c]=g.roundCandidates.map(c=>c.tower);a.tier=4;b.tier=3;c.tier=1;g.economy.gold=599;
 assert.match(draftSkillActionsMarkup(g),/data-skill="deep-refit"[^>]*disabled/);assert.equal(toggleDraftSkill(g,'deep-refit'),false);
 g.economy.gold=600;
 for(const t of [a,b,a,b]){
  g.select(t.id);
  assert.equal((draftSkillActionsMarkup(g).match(/data-skill="deep-refit"/g)||[]).length,1);
  assert.doesNotMatch(defenderPanelMarkup(g,t),/fr010-refit/);
 }
 assert.ok(toggleDraftSkill(g,'deep-refit'));assert.equal(g.economy.gold,600);
 assert.equal(applyPreparedDraftSkill(g,c.id),true);assert.equal(g.economy.gold,600);assert.equal(preparedDraftSkill(g),'deep-refit');
 assert.ok(toggleDraftSkill(g,'deep-refit'));assert.equal(preparedDraftSkill(g),null);
 assert.ok(toggleDraftSkill(g,'deep-refit'));
 assert.ok(applyPreparedDraftSkill(g,a.id));assert.equal(a.tier,2);assert.equal(a.state,'active');assert.equal(g.economy.gold,0);assert.equal(preparedDraftSkill(g),null);
 assert.doesNotMatch(draftSkillActionsMarkup(g),/deep-refit/);
 assert.doesNotMatch(wallPanelMarkup(),/crenellated|Footprint|<strong>None|<strong>Maze/);
});

test('Basic and higher champion unlocks announce immediately online or offline, without granting rewards',async()=>{
 for(const online of [true,false])for(const faction of ['crown','forge','grove']){
  const store=new RunStore({indexedDB:new IDBFactory()}),events=[],g=new Game(currentFactionData(faction),{seed:5,runId:crypto.randomUUID(),accountId:'notice-owner'}),client=new PlayerClient({store,onAchievement:e=>events.push(e),fetcher:async()=>Response.json({receipts:[]})});client.user={id:'notice-owner'};client.online=online;client.profile={eligible:[],grants:[],balance:7,xpTotal:20};await client.attach(g);
  const families=['basic','intermediate'].map(kind=>Object.entries(g.data.towers).find(([,u])=>u.advanced&&u.classification.toLowerCase()===kind)[0]);
  for(const family of families){const before=events.length;g.emit('combine',{crafted:true,tower:{family}});assert.equal(events.length,before+1);assert.equal(events.at(-1).rows[0].id,`champion:${faction}:${family}`);g.emit('combine',{crafted:true,tower:{family}});assert.equal(events.length,before+1);}
  assert.equal(client.profile.balance,7);assert.equal(client.profile.xpTotal,20);assert.equal(client.profile.grants.length,0);
  const previous=client.profile;client.profile={...previous,eligible:g.progress.grants()};client.announceAchievements(previous);assert.equal(events.length,2,'Server confirmation must not repeat the unlock toast');
  const next=new Game(g.data,{runId:crypto.randomUUID(),accountId:'notice-owner'});await client.attach(next);g.emit('combine',{crafted:true,tower:{family:Object.keys(g.data.towers).find(id=>g.data.towers[id].advanced&&!families.includes(id))}});assert.equal(events.length,2,'Replaced runs cannot continue sending notices');store.close();
 }
});

test('Burst unlocks retain an individual named notification for every champion',()=>{
 const data=currentFactionData('crown'),ids=Object.keys(data.towers).filter(id=>data.towers[id].advanced).slice(0,5),n=Object.create(AchievementNotices.prototype);Object.assign(n,{player:{user:{id:'burst'},profile:{}},owner:'burst:initial',seen:new Set(),queue:[],current:null,root:{innerHTML:''},resume(){}});
 n.push({type:'pending',rows:ids.map(id=>({id:`champion:crown:${id}`,reward:1}))});assert.equal(n.queue.length,4);assert.ok(n.queue.every(q=>q.id));assert.equal(n.current.type,'pending');assert.doesNotMatch(n.root.innerHTML,/data-notice-claim|Claim reward/);
});

test('Chest rewards equip directly, preserve the reveal, and let the player choose either ring slot',async()=>{
 const ring=C.artifacts.find(a=>a.slot==='ring'),cloak=C.artifacts.find(a=>a.slot==='cloak'),calls=[],player={online:true,profile:{artifacts:{owned:[ring.id,cloak.id],equipment:{},counts:[],pity:{}}},artifactMutation:async(kind,body)=>{calls.push({kind,body});player.profile.artifacts.equipment=body.equipment;return {};}};
 const v=new CommanderVault({player,render:async()=>{},status(){}});assert.equal(v.tab,'skills');const nav=v.tabs('');assert.ok(nav.indexOf('data-vault-tab="skills"')<nav.indexOf('data-vault-tab="equipment"'));
 v.tab='chests';v.reveal={tier:1,items:[{id:ring.id},{id:cloak.id}],dustGained:0};assert.match(v.rewards(v.reveal),/Equip artifact/);assert.match(v.rewards(v.reveal),/Right ring/);
 const button={dataset:{vaultAction:'equip',id:ring.id},closest:()=>({querySelector:()=>({value:'ring2'})})};await v.click({target:{closest:()=>button}});assert.equal(calls[0].kind,'equipment');assert.equal(player.profile.artifacts.equipment.ring2,ring.id);assert.equal(v.tab,'chests');assert.equal(v.reveal.items.length,2);assert.match(v.rewards(v.reveal),/✓ Equipped/);
});

test('Rank overview exposes every rank and the current level; Commander icons resolve to generated raster assets',()=>{
 assert.match(commanderArt('silhouette'),/silhouette-commander\.webp$/);assert.ok(fs.existsSync('public'+commanderArt('silhouette')));
 const html=rankOverviewMarkup({xpTotal:83},{expanded:true});assert.match(html,/commander-rank-roadmap" open/);assert.equal((html.match(/<li class=/g)||[]).length,15);assert.match(html,/Footman/);assert.match(html,/1,000 XP/);
 for(const id of Object.keys(GENERAL_SKILLS)){const url=commanderSkillArt(id);assert.match(url,/\/commander-generated\/skill-.*\.webp(?:\?v=[\w-]+)?$/);assert.ok(fs.existsSync('public'+url.split('?')[0]));}
 for(const id of ['equipment','skills','chests','sets','dust'])assert.ok(fs.existsSync('public'+commanderUtilityArt(id)));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {currentFactionData} from '../game/core/current-data.js';
import {achievementCatalog} from '../game/core/achievements.js';
import {FACTION_ACHIEVEMENT_DEFINITIONS} from '../game/core/faction-achievements.js';
import {achievementData,achievementById,achievementsView} from '../ui/war-table-view.js';
import {AchievementNotices} from '../ui/achievement-notices.js';
import {MainMenu} from '../ui/main-menu.js';

const factions=['crown','forge','grove'],champions=faction=>achievementCatalog(currentFactionData(faction)).filter(row=>row.kind==='champion');
const player=()=>({user:{id:'owner',name:'Fixture Commander'},online:true,status:'Account connected',profile:{xpTotal:0,balance:10,grants:[],eligible:[],skills:{},equipped:[]}});

test('All factions exposes nine faction feats and deduplicates shared milestones while retaining each roster context',()=>{
 const p=player(),a=achievementData(p,'all');assert.equal(new Set(a.catalog.map(row=>row.id)).size,a.catalog.length);
 assert.equal(a.catalog.filter(row=>row.kind==='campaign').length,3);assert.equal(a.catalog.filter(row=>row.id.endsWith(':all')).length,3);assert.equal(a.catalog.filter(row=>row.kind==='faction-collection').length,3);
 assert.equal(a.catalog.filter(row=>row.id.startsWith('boss:global:')).length,5);assert.equal(a.catalog.filter(row=>row.id==='boss-collection:global').length,1);assert.equal(a.catalog.filter(row=>row.id==='streak:global:10').length,1);
 for(const faction of factions){assert.equal(a.catalog.filter(row=>row.kind==='champion'&&row.factionId===faction).length,38);const campaign=a.catalog.find(row=>row.id===`campaign:${faction}`);assert.equal(campaign.name,FACTION_ACHIEVEMENT_DEFINITIONS[faction].campaignName);assert.equal(campaign.reward,5);assert.equal(campaign.xp,8);assert.equal(a.dataFor(campaign).factionId,faction);}
 const html=achievementsView(p,{faction:'all',kind:'faction'});for(const name of ['Human','Dwarf','Elf'])assert.match(html,new RegExp(name+' Wave 50 Victory'));
 for(const faction of factions)assert.match(html,new RegExp(`data-achievement="campaign:${faction}" data-achievement-faction="${faction}"`));assert.match(html,/Faction achievement/);assert.match(html,/data-category="faction" aria-pressed="true"/);assert.match(html,/data-filter-faction="all" aria-pressed="true"/);
 assert.equal((achievementsView(p,{faction:'all',kind:'boss'}).match(/data-achievement="boss:global:/g)||[]).length,5);
});

test('full-roster progress counts all38 including the final Secret, ignores other factions, and never awards a local reward',()=>{
 for(const faction of factions){
  const rows=champions(faction),secret=rows.find(row=>row.secret),others=rows.filter(row=>!row.secret),p=player();assert.equal(others.length,37);
  p.profile.grants=[...others.map(row=>({...row,createdAt:1})),{...others[0],createdAt:1},...champions(factions.find(id=>id!==faction)).map(row=>({...row,createdAt:1}))];
  const before=JSON.stringify(p.profile),a=achievementData(p,faction),full=a.catalog.find(row=>row.id===`collection:${faction}:all`);assert.equal(full.target,38);assert.equal(a.progress(full),37);assert.equal(a.state(full),'progress');
  const html=achievementsView(p,{faction,kind:'faction'});assert.match(html,/aria-valuenow="37" aria-valuemin="0" aria-valuemax="38"/);assert.doesNotMatch(html,new RegExp(currentFactionData(faction).towers[secret.id.split(':').at(-1)].name));assert.doesNotMatch(html,new RegExp(`data-claim="${full.id}"`));assert.equal(JSON.stringify(p.profile),before);
  p.game={accountId:'owner',factionId:faction,progress:{grants:()=>[{...secret}],streakBest:0,highestWave:0}};let current=achievementData(p,faction);assert.equal(current.progress(full),38);assert.equal(current.state(full),'pending');assert.doesNotMatch(achievementsView(p,{faction,kind:'faction'}),new RegExp(`data-claim="${full.id}"`));
  p.profile.eligible=[full];current=achievementData(p,faction);assert.equal(current.state(full),'ready');assert.match(achievementsView(p,{faction,kind:'faction',status:'ready'}),/Claim · 12 medals \+ 20 XP/);assert.equal(p.profile.balance,10);
  p.online=false;assert.match(achievementsView(p,{faction,kind:'faction',status:'ready'}),new RegExp(`data-claim="${full.id}" disabled`));
 }
});

test('signature champion sets count only their exact faction members and display discovered, pending and claimed evidence',()=>{
 for(const faction of factions){
  const definition=FACTION_ACHIEVEMENT_DEFINITIONS[faction].thematic,p=player(),memberIds=definition.champions.map(family=>`champion:${faction}:${family}`);
  p.profile.grants=[{id:memberIds[0],createdAt:1}];p.profile.eligible=[{id:memberIds[1]}];p.game={accountId:'owner',factionId:faction,progress:{grants:()=>[{id:memberIds[2],factionId:faction}],streakBest:0,highestWave:0}};
  let a=achievementData(p,faction),row=a.catalog.find(row=>row.id===definition.id);assert.equal(row.target,3);assert.equal(a.progress(row),3);assert.equal(a.state(row),'pending');assert.equal(row.reward,4);assert.equal(row.xp,6);
  let html=achievementsView(p,{faction,kind:'faction'});assert.equal((html.match(/data-discovery="discovered"/g)||[]).length,2);assert.equal((html.match(/data-discovery="pending"/g)||[]).length,1);for(const family of definition.champions)assert.match(html,new RegExp(`data-required-champion="${family}"`));
  p.profile.eligible.push(row);html=achievementsView(p,{faction,kind:'faction',status:'ready'});assert.match(html,/Claim · 4 medals \+ 6 XP/);assert.equal((html.match(/data-discovery="discovered"/g)||[]).length,3);
  p.profile.grants.push({...row,createdAt:2});a=achievementData(p,'all');assert.equal(a.state(row),'claimed');html=achievementsView(p,{faction:'all',kind:'faction',status:'claimed'});assert.match(html,new RegExp(`data-achievement="${row.id}"`));assert.doesNotMatch(html,new RegExp(`data-claim="${row.id}"`));
  const wrong=player();wrong.profile.eligible=memberIds.map(id=>({id:id.replace(`:${faction}:`,':other:')}));a=achievementData(wrong,'all');assert.equal(a.progress(row),0);
  assert.equal(achievementById(row.id).row.name,row.name);
 }
});

test('mounted MainMenu handlers retain category/faction/status filters and Claim is the only action that pays a reward',async()=>{
 const previousDocument=globalThis.document,callbacks=new Map(),p=player(),definition=FACTION_ACHIEVEMENT_DEFINITIONS.crown.thematic,row=achievementCatalog(currentFactionData('crown')).find(row=>row.id===definition.id);p.profile.eligible=[row];let claims=0;
 p.claimAchievement=async id=>{assert.equal(id,row.id);claims++;p.profile.grants.push({...row,createdAt:1});p.profile.balance+=row.reward;};
 const root={hidden:false,innerHTML:'',scrollTop:0,setAttribute(){},addEventListener:(type,fn)=>callbacks.set(type,fn),querySelector:selector=>selector==='h1'?{focus(){}}:null};
 globalThis.document={createElement:()=>root,body:{append(){}}};
 try{
  const menu=new MainMenu({player:p,app:{inert:false}});await menu.show('achievements');assert.match(root.innerHTML,/data-category="faction"/);assert.equal(p.profile.balance,10);
  const click=async dataset=>{callbacks.get('click')({target:{closest:()=>({dataset,disabled:false,isConnected:false,setAttribute(){},removeAttribute(){},hasAttribute:()=>false})}});await new Promise(resolve=>setImmediate(resolve));};
  await click({filterFaction:'all'});assert.equal(menu.faction,'all');for(const name of ['Human','Dwarf','Elf'])assert.match(root.innerHTML,new RegExp(name+' Wave 50 Victory'));
  await click({category:'faction'});assert.equal(menu.achievementKind,'faction');assert.equal(menu.offset,0);assert.match(root.innerHTML,/1–8 \/ 9/);
  await click({page:'8'});assert.match(root.innerHTML,/Elf Grove Guardians/);await click({filterFaction:'crown'});assert.equal(menu.offset,0);assert.doesNotMatch(root.innerHTML,/Dwarf Wave 50 Victory|Elf Wave 50 Victory/);
  callbacks.get('change')({target:{name:'achievement-state',value:'ready'}});await new Promise(resolve=>setImmediate(resolve));assert.equal(menu.achievementState,'ready');assert.match(root.innerHTML,new RegExp(`data-claim="${row.id}"`));assert.equal(claims,0);assert.equal(p.profile.balance,10);
  await click({claim:row.id});assert.equal(claims,1);assert.equal(p.profile.balance,14);assert.equal(menu.achievementState,'ready');assert.match(root.innerHTML,/No achievements match these filters/);
  callbacks.get('change')({target:{name:'achievement-state',value:'claimed'}});await new Promise(resolve=>setImmediate(resolve));assert.match(root.innerHTML,new RegExp(`data-achievement="${row.id}"`));assert.match(root.innerHTML,/✓ Claimed/);assert.equal(claims,1);menu.faction='all';menu.loadHall=async()=>{};await menu.show('legacy');assert.equal(menu.faction,'crown','Legacy receives a supported faction after leaving All factions');
 }finally{globalThis.document=previousDocument;}
});

test('faction unlock notices retain explicit faction identity and current English achievement names',()=>{
 const row=achievementCatalog(currentFactionData('forge')).find(row=>row.kind==='faction-collection'),notice=Object.assign(Object.create(AchievementNotices.prototype),{player:{user:{id:'fixture'},profile:{}},owner:'fixture:initial',seen:new Set(),queue:[],current:null,root:{innerHTML:''},resume(){},timer:null});
 notice.push({type:'ready',rows:[row]});assert.match(notice.root.innerHTML,/Dwarf Forge Engineering/);assert.match(notice.root.innerHTML,/Dwarves · Faction achievement/);assert.doesNotMatch(notice.root.innerHTML,/Shared across factions/);
});

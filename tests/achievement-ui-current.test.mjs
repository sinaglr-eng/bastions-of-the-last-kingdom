import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {achievementCatalog} from '../game/core/achievements.js';
import {currentFactionData} from '../game/core/current-data.js';
import {canonicalAchievementRows} from '../game/achievement-client-state.js';
import {PlayerClient} from '../game/player-client.js';
import {achievementData,achievementById,achievementsView,generalView,hallView} from '../ui/war-table-view.js';
import {generalPageMarkup} from '../ui/general-page.js';
import {achievementCardsMarkup} from '../ui/achievement-page.js';
import {AchievementNotices} from '../ui/achievement-notices.js';
import {MainMenu} from '../ui/main-menu.js';

const factions=['crown','forge','grove'];
const basic=faction=>achievementCatalog(currentFactionData(faction)).filter(row=>row.kind==='champion'&&currentFactionData(faction).towers[row.id.split(':').at(-1)].classification.toLowerCase()==='basic');
const playerFixture=()=>({user:{id:'owner'},online:false,profile:{balance:7,grants:[{id:'boss:crown:host_10',reward:2,createdAt:20}],eligible:[{id:'boss:forge:host_10',reward:2},{id:'boss:grove:host_20',reward:2},{id:'streak:forge:10',reward:1}],progress:{crown:{streakBest:6},forge:{streakBest:18},grove:{streakBest:12}}},game:{accountId:'owner',factionId:'forge',progress:{grants:()=>[{id:'boss:global:host_30',factionId:null},{id:basic('forge')[0].id,factionId:'forge'}],streakBest:17,highestWave:30}}});

test('legacy cached milestones are shared in every faction tab without leaking faction discoveries or adding streaks',()=>{
 const p=playerFixture(),before=JSON.stringify(p.profile);
 for(const faction of factions){
  const a=achievementData(p,faction),find=id=>a.catalog.find(row=>row.id===id);
  assert.equal(a.state(find('boss:global:host_10')),'claimed');
  assert.equal(a.state(find('boss:global:host_20')),'ready');
  assert.equal(a.state(find('boss:global:host_30')),'pending');
  assert.equal(a.progress(find('boss-collection:global')),3,'Different original bosses count once across all factions');
  assert.equal(a.state(find('streak:global:10')),'ready');
  assert.equal(a.progress(find('streak:global:20')),18,'Use the best single run, never the sum of faction records');
  assert.equal(a.state(find('streak:global:20')),'progress');
  assert.equal(a.pending.has(basic('forge')[0].id),faction==='forge');
  const html=achievementsView(p,{faction,kind:'boss'});assert.match(html,/Shared across factions/);assert.match(html,/Verification pending/);
 }
 assert.equal(JSON.stringify(p.profile),before,'Display never rewrites cached ownership or money');
 p.game.progress.streakBest=25;
 for(const faction of factions){const a=achievementData(p,faction);assert.equal(a.state(a.catalog.find(row=>row.id==='streak:global:20')),'pending');}
 assert.equal(achievementById('boss:grove:host_20').row.id,'boss:global:host_20');
 assert.equal(achievementById('streak:crown:80').row.target,80);
});

test('Basic champion discoveries retain faction portraits, one medal and one XP, and count toward collections',()=>{
 for(const faction of factions){
  const rows=basic(faction);assert.ok(rows.length>=5);for(const row of rows){assert.equal(row.reward,1);assert.equal(row.xp,1);assert.equal(row.factionId,faction);}
  const p={user:{id:'owner'},online:true,profile:{eligible:rows.slice(0,5),grants:[]}},a=achievementData(p,faction);
  assert.equal(a.progress(a.catalog.find(row=>row.id===`collection:${faction}:5`)),5);
  assert.equal(a.state(rows[0]),'ready');const html=achievementsView(p,{faction,kind:'champion',status:'ready'});
  assert.match(html,new RegExp(rows[0].name));assert.match(html,/1 medal \+ 1 XP/);
 }
});

test('canonical client rows deduplicate alias eligibility and claims without changing wallet or run data',async()=>{
 const old=[{id:'boss:crown:host_10',reward:2,createdAt:5},{id:'boss:global:host_10',reward:2,xp:0,createdAt:8},{id:'boss:forge:host_10',reward:2,createdAt:9}],before=JSON.stringify(old),rows=canonicalAchievementRows(old);
 assert.equal(rows.length,1);assert.equal(rows[0].id,'boss:global:host_10');assert.equal(rows[0].factionId,null);assert.equal(rows[0].createdAt,5);assert.equal(JSON.stringify(old),before);
 const events=[],requests=[],client=new PlayerClient({onAchievement:event=>events.push(event),fetcher:async(url,options)=>{requests.push(JSON.parse(options.body));return Response.json({revision:2,balance:9,xpTotal:0,skills:{},equipped:[],eligible:old,grants:[{id:'boss:global:host_10',reward:2,createdAt:5}]});}});
 client.user={id:'owner'};client.online=true;client.profile={revision:1,balance:7,grants:[],eligible:old};
 assert.equal(client.readyAchievements.length,1);assert.equal(client.profile.balance,7);
 await Promise.all([client.claimAchievement('boss:forge:host_10'),client.claimAchievement('boss:grove:host_10')]);await client.claimAchievement('boss:crown:host_10');
 assert.equal(requests.length,1);assert.equal(requests[0].achievementId,'boss:global:host_10');assert.equal(events.length,1);assert.equal(events[0].id,'boss:global:host_10');assert.equal(client.readyAchievements.length,0);assert.equal(client.profile.balance,9);
 const previous={eligible:[{id:'boss:crown:host_20'}]};client.profile.eligible=[{id:'boss:global:host_20'},{id:'boss:forge:host_20'}];client.announceAchievements(previous);assert.equal(events.length,1,'Reconnecting with a canonical server row does not reannounce a legacy unlock');
 client.online=false;client.profile.grants=[{id:'boss:grove:host_30'}];client.profile.eligible=[];client.game={accountId:'owner',progress:{grants:()=>[{id:'boss:global:host_30'},{id:'boss:crown:host_40'},{id:'boss:forge:host_40'}]}};client.save=async()=>{};client.flush=async()=>{};client.lastSave=-100000;client.update();assert.equal(events.length,2);assert.equal(events[1].rows.length,1);assert.equal(events[1].rows[0].id,'boss:global:host_40');
});

test('notifications canonicalize historical seen keys and coalesce alias rows without repeating pending notices',()=>{
 const make=()=>Object.assign(Object.create(AchievementNotices.prototype),{player:{user:{id:'fixture'},profile:{}},owner:'fixture:initial',seen:new Set(),queue:[],current:null,root:{innerHTML:''},resume(){},timer:null});
 const n=make();n.seen.add('unlocked:boss:crown:host_10');n.push({type:'ready',rows:[{id:'boss:global:host_10'}]});assert.equal(n.current,null);assert.equal(n.queue.length,0);
 n.push({type:'ready',rows:[{id:'boss:forge:host_20'},{id:'boss:grove:host_20'}]});assert.equal(n.current.id,'boss:global:host_20');assert.equal(n.queue.length,0);assert.match(n.root.innerHTML,/Shared across factions/);
 n.push({type:'pending',rows:[{id:'boss:crown:host_20'}]});assert.equal(n.queue.length,0);
 const cached=make();cached.player.profile.grants=[{id:'streak:grove:10'}];cached.push({type:'pending',rows:[{id:'streak:global:10'}]});assert.equal(cached.current,null);
 const data=currentFactionData('forge'),boss=achievementById('boss:global:host_10').row,legacy=achievementCardsMarkup({data,rows:[boss],owned:new Map([['boss:crown:host_10',{createdAt:1}]]),pending:new Set(),progress:()=>1});assert.match(legacy,/is-earned/);assert.match(legacy,/Shared across factions/);
});

test('both Commander screens remove refund controls and the old menu action cannot submit reset',async()=>{
 for(const html of [generalView({skills:{},balance:0}),generalPageMarkup({skills:{},balance:0})])assert.doesNotMatch(html,/reset-general|Reset.*Refund|refund medals/i);
 let resets=0;const menu=Object.assign(Object.create(MainMenu.prototype),{player:{changeProfile:async()=>{resets++;}},starting:false,status(){}});const button={dataset:{menu:'reset-general'},disabled:false,hasAttribute:()=>false};menu.commanderVault??={click:async()=>false};await menu.click({target:{closest:()=>button}});assert.equal(resets,0);
});

test('Hall view and Achievements retain the same styled native select and correct disabled personal option',()=>{
 const album=achievementsView(playerFixture()),hall=hallView({top:[],podium:[],factionId:'all'});
 assert.match(album,/<label class="war-status-filter war-select-control"><span class="sr-only">Achievement status<\/span><select name="achievement-state">/);
 assert.match(hall,/<label class="war-select-control"><span>Leaderboard view<\/span><select name="hall-view">/);
 assert.match(hall,/<option value="own"[^>]*disabled>My ranking/);
 const css=fs.readFileSync(new URL('../ui/war-table.css',import.meta.url),'utf8');assert.match(css,/#main-menu \.war-select-control select:focus-visible/);
});

test('seasonal hall rows show the prize for their actual rank, including a personal row outside the page',()=>{
 const record=rank=>({rank,id:String(rank),name:'Commander '+rank,score:'500',highestWave:4,factionId:'forge'});
 const listing={top:[record(2),record(4),record(11)],own:record(10),offset:0,total:30,currentSeason:'2026-11'};
 const hall=hallView({...listing,season:{key:'2026-11',end:Date.UTC(2026,11,1)}});
 assert.match(hall,/Season reward/);
 for(const [rank,prize] of [[2,'1 Legendary chest + 2 Epic chests + 1 random gem'],[4,'150 Relic Dust'],[10,'30 Relic Dust'],[11,'&mdash;']]){
  const row=hall.split('<tr ').find(fragment=>fragment.includes('Commander '+rank+'</span>'));
  assert.ok(row?.split('</tr>')[0].includes('>'+prize+'</td>'));
 }
 assert.doesNotMatch(hall,/Legacy records|Top 10 rewards/);
 assert.doesNotMatch(hallView(listing),/Season reward|Relic Dust|Epic chests/);
});

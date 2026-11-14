import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {achievementData,achievementsView,generalView,hallView} from '../ui/war-table-view.js';
import {PlayerClient} from '../game/player-client.js';
import {currentFactionData} from '../game/core/current-data.js';
import {achievementCatalog} from '../game/core/achievements.js';
import {achievementArtwork} from '../ui/progression-art.js';

test('Album separates verified eligibility, claimed rewards and unverified milestones',()=>{
 const [one,two,three]=achievementCatalog(currentFactionData('crown'));
 const p={user:{id:'owner'},online:true,profile:{balance:0,grants:[{id:one.id,createdAt:1}],eligible:[{id:one.id},{id:two.id}]},game:{accountId:'owner',factionId:'crown',progress:{grants:()=>[{id:three.id}],streakBest:0,highestWave:0}}};
 const a=achievementData(p);assert.equal(a.state(one),'claimed');assert.equal(a.state(two),'ready');assert.equal(a.state(three),'pending');
 const view=achievementsView(p);assert.match(view,/data-claim=/);assert.match(view,/Verification pending/);assert.doesNotMatch(view,/automatically|Claim All/);assert.equal(p.profile.balance,0);
});
test('Collection progress and secret reveal use verified discoveries before Claim',()=>{
 const d=currentFactionData('crown'),secret=achievementCatalog(d).find(a=>a.secret),champions=achievementCatalog(d).filter(a=>a.kind==='champion').slice(0,5);
 const player={user:{id:'owner'},online:true,profile:{balance:0,grants:[],eligible:[...champions,{id:secret.id}]}};
 const a=achievementData(player);assert.equal(a.progress(a.catalog.find(a=>a.id==='collection:crown:5')),5);assert.equal(a.state(secret),'ready');
 const html=achievementsView(player,{status:'ready',focusId:secret.id});assert.match(html,/Lady Claire/);assert.equal(player.profile.balance,0);
});
test('Every current champion resolves to its own faction portrait, not generated mockup art',()=>{
 for(const f of ['crown','forge','grove']){const d=currentFactionData(f);for(const a of achievementCatalog(d).filter(a=>a.kind==='champion')){const id=a.id.split(':').at(-1),asset=d.defenderAssets.find(x=>x.family===id&&x.tier===1);assert.ok(asset?.portrait,a.id);assert.ok(achievementArtwork(a,d,true).includes(asset.portrait));assert.ok(fs.existsSync('public/'+asset.portrait));}}
});
test('General shows one selected detail, all seven skills and distinct CP versus medal costs',()=>{
 const html=generalView({balance:14,skills:{'morale-boost':1},equipped:['morale-boost']},true);
 assert.equal((html.match(/class="war-skill /g)||[]).length,7);assert.equal((html.match(/class="war-skill-detail"/g)||[]).length,1);assert.match(html,/Upgrade to II · 10 medals/);assert.match(html,/Balance after upgrade: 4/);assert.match(html,/20 combat seconds · 3 CP/);assert.match(html,/Loadout changes apply to new games/);
});
test('Hall empty state never invents winners, exact big scores stay legible and ties are explicit',()=>{
 assert.match(hallView({top:[],podium:[],factionId:'all'}),/Set the first record/);
 const own={id:'own',name:'<img>',factionId:'crown',score:'9007199254740993',highestWave:70,rank:2,loadout:{}};
 const html=hallView({top:[own],podium:[own],own,next:{rank:1},gap:'0',total:1,offset:0,factionId:'all'});assert.match(html,/9,007,199,254,740,993/);assert.match(html,/&lt;img&gt;/);assert.match(html,/Score tied/);assert.match(html,/YOU/);
});
test('Client Claim waits for server payment; older replay profiles cannot replace newer wallet state',async()=>{
 const events=[],client=new PlayerClient({onAchievement:e=>events.push(e),fetcher:async()=>Response.json({revision:2,balance:2,eligible:[{id:'boss:crown:host_10',reward:2}],grants:[{id:'boss:crown:host_10',reward:2}],skills:{},equipped:[]})});
 client.user={id:'owner'};client.online=true;client.profile={revision:1,balance:0,grants:[],eligible:[{id:'boss:crown:host_10',reward:2}]};
 assert.equal(client.profile.balance,0);await client.claimAchievement('boss:crown:host_10');assert.equal(client.profile.balance,2);assert.equal(events[0].type,'claimed');assert.equal(client.readyAchievements.length,0);client.applyProfile({revision:1,balance:0});assert.equal(client.profile.balance,2);
});

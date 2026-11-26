import test from 'node:test';
import assert from 'node:assert/strict';
import {killMilestone,killTargetFromId,nextKillTarget} from '../game/core/kill-milestones.js';
import {currentFactionData} from '../game/core/current-data.js';
import {achievementCatalog} from '../game/core/achievements.js';
import {PlayerClient} from '../game/player-client.js';
import {achievementData,achievementById,achievementsView} from '../ui/war-table-view.js';
import {claimAvailableAchievements} from '../ui/achievement-claim-all.js';

const ids=html=>[...html.matchAll(/data-achievement="([^"]+)"/g)].map(m=>m[1]);
const account=()=>({user:{id:'player'},online:true,profile:{achievementSeason:'2026-12',grants:[],eligible:[]}});

test('all factions opens with claimable achievements before pagination and respects explicit filters',()=>{
 const p=account();
 const rows=['grove','forge','crown'].map(f=>achievementCatalog(currentFactionData(f)).filter(row=>row.kind==='champion').at(-1));
 p.profile.eligible=rows;
 const first=ids(achievementsView(p,{pageSize:2})),second=ids(achievementsView(p,{pageSize:2,offset:2}));
 assert.deepEqual(new Set([...first,second[0]]),new Set(rows.map(row=>row.id)));
 assert.deepEqual(ids(achievementsView(p,{faction:'forge',kind:'champion',status:'ready'})),[rows[1].id]);
 assert.deepEqual(ids(achievementsView(p,{faction:'forge',kind:'boss',status:'ready'})),[]);
});

test('one shared kill card advances to each next tier and displays the complete seasonal total',()=>{
 const p=account();
 for(const [claimedTarget,target] of [[0,100],[100,1000],[1000,5000],[5000,10000],[10000,20000],[40000,50000]]){
  assert.equal(nextKillTarget(claimedTarget),target);
  const row=killMilestone(target);assert.equal(killTargetFromId(row.id),target);
  assert.equal(achievementById(row.id).row.xp,row.xp);
  p.profile.seasonalKills={total:12670,claimedTarget,nextTarget:target};
  p.profile.eligible=target<=12670?[row]:[];
  p.profile.grants=claimedTarget?[{...killMilestone(claimedTarget),createdAt:1}]:[];
  const data=achievementData(p,'all'),cards=data.catalog.filter(a=>a.kind==='kills');
  assert.deepEqual(cards.map(card=>card.id),[row.id]);
  const html=achievementsView(p,{pageSize:1,kind:'milestone'});
  assert.deepEqual(ids(html),[row.id]);
  assert.ok(html.includes('12,670 this season · Target '+target.toLocaleString('en-US')));
  assert.equal(html.includes('data-claim="'+row.id+'"'),target<=12670);
 }
 for(const bad of ['kills:global:0','kills:global:0100','kills:global:15000','kills:grove:100','kills:global:NaN']){
  assert.equal(killTargetFromId(bad),null);
 }
});

test('new-season skill mastery shows purchases in the current season and falls back for cached profiles',()=>{
 const p=account();p.profile.skills={'deep-refit':3};p.profile.seasonalSkillRanks={};
 function progress(){const a=achievementData(p);return a.progress(a.catalog.find(g=>g.id==='skill-mastery:global:deep-refit'));}
 assert.equal(progress(),0);p.profile.seasonalSkillRanks={'deep-refit':1};assert.equal(progress(),1);
 delete p.profile.seasonalSkillRanks;assert.equal(progress(),3);
});

test('an unfinished defense from last month cannot put old unlocks back on the seasonal album',()=>{
 const p=account(),boss=achievementCatalog(currentFactionData('forge')).find(a=>a.kind==='boss');
 p.game={accountId:p.user.id,progress:{grants:()=>[boss],streakBest:20}};
 for(const oldSeason of [undefined,'2026-11']){
  p.game.achievementOriginSeason=oldSeason;
  const album=achievementData(p,'all');
  assert.equal(album.state(boss),'progress');
 }
 p.game.achievementOriginSeason=p.profile.achievementSeason;
 assert.equal(achievementData(p,'all').state(boss),'pending');
});

test('single and bulk claims bind their writes to the season shown on the reward',async()=>{
 const bodies=[];
 const p=new PlayerClient({fetcher:async(url,options)=>{
  const body=JSON.parse(options.body);bodies.push(body);
  return Response.json({...p.profile,revision:p.profile.revision+1,grants:[...p.profile.grants,{id:body.achievementId}]});
 }});
 Object.assign(p,account());p.profile.revision=4;p.profile.eligible=[{id:'boss:global:host_10'},{id:'boss:global:host_20'}];
 await p.claimAchievement(p.profile.eligible[0].id);
 await claimAvailableAchievements(p);
 assert.deepEqual(bodies.map(b=>b.achievementSeason),['2026-12','2026-12']);
 await assert.rejects(p.claimAchievement('boss:global:host_30','2026-11'),/new season/i);
 assert.equal(bodies.length,2);
});

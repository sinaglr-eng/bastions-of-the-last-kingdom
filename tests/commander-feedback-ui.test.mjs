import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {claimAvailableAchievements} from '../ui/achievement-claim-all.js';
import {artifactCraftState,artifactForgeRows,artifactForgeMarkup,ArtifactForge} from '../ui/artifact-forge.js';
import {ARTIFACT_CATALOG as C,RARITIES,craftUnlockTier} from '../game/core/artifacts.js';
import {skillEffect,skillSummary} from '../ui/general-page.js';
import {MainMenu} from '../ui/main-menu.js';
import {CommanderVault} from '../ui/commander-vault.js';
import {achievementsView,hallView} from '../ui/war-table-view.js';
import {currentFactionData} from '../game/core/current-data.js';
import {achievementCatalog} from '../game/core/achievements.js';
import {PlayerClient} from '../game/player-client.js';
import worker from '../backend/worker.js';
import {sqliteDatabase} from '../backend/sqlite-adapter.js';
import {migrateFr010} from '../backend/migrate-fr010.js';

test('Claim all snapshots, deduplicates and serializes eligible rewards; a failed action can safely resume',async()=>{
 const calls=[],ready=[{id:'one'},{id:'one'},{id:'two'}],player={user:{id:'test'},online:true,get readyAchievements(){return ready;},async claimAchievement(id){calls.push(id);await new Promise(resolve=>setImmediate(resolve));ready.push({id:'new-reward'});}};
 const first=claimAvailableAchievements(player),second=claimAvailableAchievements(player);assert.equal(first,second);assert.deepEqual(await first,{claimed:2,total:2});assert.deepEqual(calls,['one','two']);
 const pending=[{id:'a'},{id:'b'}],attempts=[],partial={user:{id:'test'},online:true,get readyAchievements(){return pending;},async claimAchievement(id){attempts.push(id);if(id==='b'&&attempts.length===2)throw Error('Offline');pending.splice(pending.findIndex(row=>row.id===id),1);}};
 await assert.rejects(claimAvailableAchievements(partial),error=>error.claimedCount===1&&error.requestedCount===2);assert.deepEqual(pending,[{id:'b'}]);assert.deepEqual(await claimAvailableAchievements(partial),{claimed:1,total:1});assert.deepEqual(attempts,['a','b','b']);
 let writes=0;await assert.rejects(claimAvailableAchievements({online:false,user:{id:'test'},readyAchievements:[{id:'a'}],claimAchievement(){writes++;}}),/Connect/);assert.equal(writes,0);
});

test('Claim all uses authenticated Worker claims and pays each cross-faction reward once even when retried',async()=>{
 const db=sqliteDatabase();db.sqlite.exec(fs.readFileSync('backend/migrations/0000_statistics.sql','utf8'));migrateFr010(db);
 const base='http://127.0.0.1:4174',mail=[],env={DB:db,AUTH_SECRET:'isolated-feedback-test-secret-at-least-thirty-two-characters',AUTH_BASE_URL:base,GAME_ORIGINS:base,AUTH_MAIL_MODE:'local',AUTH_LOCAL_MAIL:async m=>mail.push(m)};let cookie='';
 const fetcher=(url,options={})=>worker.fetch(new Request(url.startsWith('http')?url:base+url,{...options,headers:{...options.headers,Origin:base,'CF-Connecting-IP':'192.0.2.231',Cookie:cookie}}),env);
 const call=async(path,body)=>{const response=await fetcher(base+path,{method:body?'POST':'GET',...(body?{body:JSON.stringify(body),headers:{'Content-Type':'application/json'}}:{})});return {response,value:await response.json()};};
 try{
  await call('/api/auth/sign-up/email',{name:'Claim all test',email:'claim-all@example.test',password:'isolated-claim-all-password',callbackURL:base+'/'});const verified=await worker.fetch(new Request(mail.at(-1).url,{headers:{Origin:base,'CF-Connecting-IP':'192.0.2.231'}}),env);cookie=verified.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');const session=(await call('/api/player/session')).value;
  const rows=['crown','forge','grove'].map(faction=>achievementCatalog(currentFactionData(faction)).find(row=>row.kind==='champion'));
  for(const row of rows)db.sqlite.prepare('INSERT INTO fr010_eligible VALUES(?,?,?,?,?,NULL)').run(session.user.id,row.id,row.factionId,row.reward,1);
  const client=new PlayerClient({base:base+'/api',fetcher});client.user=session.user;client.online=true;client.profile=(await call('/api/player/profile')).value;client.progressionEpoch=client.profile.progressionEpoch;
  const before=client.profile.balance;const results=await Promise.all([claimAvailableAchievements(client),claimAvailableAchievements(client)]);assert.deepEqual(results[0],{claimed:3,total:3});assert.equal(client.profile.balance,before+rows.reduce((sum,row)=>sum+row.reward,0));assert.equal(client.readyAchievements.length,0);
  assert.deepEqual(await claimAvailableAchievements(client),{claimed:0,total:0});assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM fr010_ledger WHERE kind='achievement'").get().n,3);
 }finally{db.sqlite.close();}
});

test('Forge browses the full catalog and enforces ownership, Dust, connection and chest-tier gates',()=>{
 assert.equal(artifactForgeRows().length,C.artifacts.length);
 for(const rarity of C.rarities){const item=C.artifacts.find(item=>item.rarity===rarity.id),tier=craftUnlockTier(item.rarity),account={owned:[],dust:rarity.craft,highestTier:tier};
  assert.equal(artifactCraftState(item,account).canCraft,true);assert.equal(artifactCraftState(item,{...account,dust:rarity.craft-1}).shortfall,1);assert.equal(artifactCraftState(item,{...account,highestTier:tier-1}).canCraft,false);assert.equal(artifactCraftState(item,{...account,owned:[item.id]}).canCraft,false);assert.equal(artifactCraftState(item,account,false).canCraft,false);
  assert.ok(artifactForgeRows({rarity:rarity.id}).every(item=>item.rarity===rarity.id));assert.ok(artifactForgeRows({query:item.name}).some(row=>row.id===item.id));
 }
 const item=C.artifacts[0],html=artifactForgeMarkup({owned:[item.id],dust:0,highestTier:0},{query:'<script>',rarity:'all'});assert.match(html,/aria-labelledby|artifact-forge-title/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
 const owned=artifactForgeMarkup({owned:[item.id],dust:99999,highestTier:5},{query:item.name,rarity:'all'});assert.match(owned,new RegExp(`data-forge-craft="${item.id}" disabled`));assert.match(owned,/Already collected/);
});

test('Forge confirms an exact missing artifact and guards duplicate clicks while the existing mutation is pending',async()=>{
 const item=C.artifacts[0],calls=[],player={online:true,profile:{artifacts:{owned:[],dust:99999,highestTier:5}},async artifactMutation(action,body){calls.push([action,body]);await new Promise(resolve=>setImmediate(resolve));this.profile.artifacts.owned.push(body.artifactId);}},forge=new ArtifactForge({player,refresh:async()=>{},confirm:async()=>true});forge.update=()=>{};
 const event={target:{closest:()=>({disabled:false,hasAttribute:()=>false,dataset:{forgeCraft:item.id}})}};await Promise.all([forge.click(event),forge.click(event)]);assert.deepEqual(calls,[['craft',{artifactId:item.id}]]);assert.equal(forge.state.busy,false);assert.match(forge.state.message,/forged/);await forge.click(event);assert.equal(calls.length,1);
});

test('Collection claim-all is global, Hall drops the YOU prefix, medals link to Skills, and Focus uses clear percentages',()=>{
 const row=achievementCatalog(currentFactionData('forge')).find(row=>row.kind==='champion'),player={user:{id:'test',name:'Commander'},online:true,status:'Connected',readyAchievements:[row],profile:{balance:5,eligible:[row],grants:[]}},html=achievementsView(player,{faction:'crown'});assert.match(html,/data-claim-all\s+aria-label="Claim all 1/);assert.match(html,/>Claim 1 reward<\/button>/);
 const shell=MainMenu.prototype.shell.call({player,page:'home'},'', '');assert.match(shell,/data-open-skills/);assert.match(shell,/aria-label="1 achievements ready to claim"/);
 const entry={id:'own',rank:1,name:'Commander',score:'100',highestWave:1,factionId:'crown',loadout:{}},hall=hallView({top:[entry],own:entry,podium:[],factionId:'all',offset:0,total:1});assert.match(hall,/class="is-own"/);assert.doesNotMatch(hall,/YOU ·/);
 for(const rank of [1,2,3]){const summary=skillSummary('recruitment-focus',rank);assert.doesNotMatch(summary,/\bpp\b|percentage points/);assert.match(summary,/20% becomes/);assert.doesNotMatch(skillEffect('recruitment-focus',rank),/\bpp\b/);}
 assert.doesNotMatch(fs.readFileSync('ui/assets/cartographer-open-book-v044.svg','utf8'),/id="corner"|href="#corner"/);
});

 test('Finishing Crimson Covenant previews healing from zero without suggesting maximum-health growth',()=>{
 const pieces=C.artifacts.filter(item=>item.setId==='crimson-covenant'),last=pieces.at(-1),equipment=Object.fromEntries(pieces.slice(0,-1).map(item=>[item.slot==='ring'?'ring1':item.slot,item.id])),vault=new CommanderVault({player:{online:true,profile:{artifacts:{owned:pieces.map(item=>item.id),equipment,highestTier:1,dust:0}}},render(){},status(){}}),html=vault.detail(last);
 assert.match(html,/Keep recovery after each successful wave/);assert.match(html,/0 missing HP \(within the existing maximum\) → 1 missing HP \(within the existing maximum\)/);
 });

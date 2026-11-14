import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {RunStore} from '../game/run-store.js';
import {PlayerClient} from '../game/player-client.js';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun} from '../game/core/run-state.js';
const store=()=>new RunStore({indexedDB:new IDBFactory()}),guestFetch=async()=>Response.json({user:null,profile:null,mailMode:'local'});

test('FR010 IndexedDB Guest continuation preserves exact draft and does not create account batches',async()=>{
 const storage=store(),a=new PlayerClient({store:storage,fetcher:guestFetch});await a.initialize();const context=await a.newRun('crown');await a.attach(context.game,context);a.game.place(18,18);await a.save();const state=serializeRun(a.game);const b=new PlayerClient({store:storage,fetcher:guestFetch});await b.initialize();const choice=await b.continuation();assert.ok(choice.local);const game=await b.resume(choice);game.paused=state.graph.nodes.find(n=>n.type==='object'&&n.value?.phase)?.value.paused??false;assert.equal(game.draft.draws[0].family,a.game.draft.draws[0].family);assert.equal(game.rng(),a.game.rng());assert.equal(await storage.batch(a.game.runId,1),null);storage.close();
});
test('FR010 a stale second tab cannot overwrite the latest save',async()=>{
 const storage=store(),a=new PlayerClient({store:storage,fetcher:guestFetch});await a.initialize();const context=await a.newRun('forge');await a.attach(context.game,context);const b=new PlayerClient({store:storage,fetcher:guestFetch});await b.initialize();await b.resume(await b.continuation());a.game.place(18,18);await assert.rejects(a.save(),/another tab/);const saved=await storage.get('guest');assert.equal(saved.revision,b.storageRevision);storage.close();
});
test('FR010 signing in while a Guest game exists does not put Guest state in the account slot',async()=>{
 const storage=store(),a=new PlayerClient({store:storage,fetcher:guestFetch});await a.initialize();const context=await a.newRun('grove');await a.attach(context.game,context);a.user={id:'account-id',name:'Commander'};a.game.place(18,18);await a.save();assert.ok(await storage.get('guest'));assert.equal(await storage.get('account-id'),null);storage.close();
});
test('FR010 offline command batches are atomically saved and split into bounded replay budgets',async()=>{
 const storage=store(),a=new PlayerClient({store:storage,fetcher:async()=>{throw Error('Offline');}});a.user={id:'account-id'};const g=new Game(currentFactionData('crown'),{seed:42,accountId:'account-id',runId:crypto.randomUUID()});await a.attach(g);g.journal.push({action:'advance',ticks:1800});await a.save();for(let sequence=1;sequence<=3;sequence++){const b=await storage.batch(g.runId,sequence);assert.equal(b.sequence,sequence-1);assert.equal(b.commands[0].ticks,600);}assert.equal(g.journal.length,0);await a.flush();assert.equal(a.sync.sequence,0);assert.equal(a.status,'Offline · progress saved locally; rewards pending');assert.ok(await storage.batch(g.runId,1));storage.close();
});
test('FR010 lost response retries one immutable batch and then acknowledges it',async()=>{
 const storage=store();let attempts=0,payloads=[];const a=new PlayerClient({store:storage,fetcher:async(_url,options)=>{payloads.push(JSON.parse(options.body));if(++attempts===1)throw Error('Lost response');return Response.json({sequence:1,profile:{balance:0,skills:{},equipped:[],grants:[]},outcome:'playing'});}});a.user={id:'account-id'};const g=new Game(currentFactionData('crown'),{seed:1,accountId:'account-id',runId:crypto.randomUUID()});await a.attach(g);g.place(18,18);await a.flush();assert.equal(a.sync.sequence,0);a.nextRetry=0;await a.flush();assert.equal(a.sync.sequence,1);assert.equal(payloads[0].batchId,payloads[1].batchId);assert.equal(await storage.batch(g.runId,1),null);assert.equal(a.status,'Progress verified');storage.close();
});
test('FR010 local and cloud branches are exposed as a conflict without silently merging',async()=>{
 const storage=store(),a=new PlayerClient({store:storage,fetcher:guestFetch});a.user={id:'account-id'};const g=new Game(currentFactionData('crown'),{accountId:'account-id',runId:crypto.randomUUID()});await a.attach(g);a.fetcher=async()=>Response.json({run:{id:crypto.randomUUID(),sequence:0,lastBatch:null,factionId:'crown',snapshot:serializeRun(g)}});const c=await a.continuation();assert.equal(c.conflict,true);assert.equal(c.local.meta.runId,g.runId);storage.close();
});

test('FR010 a serialization failure preserves every pending command for a later save',async()=>{
 const storage=store(),a=new PlayerClient({store:storage,fetcher:guestFetch});a.user={id:'account-id'};const g=new Game(currentFactionData('crown'),{accountId:'account-id',runId:crypto.randomUUID()});await a.attach(g);g.place(18,18);const commands=structuredClone(g.journal);g.draft.invalidFixture=Infinity;await assert.rejects(a.save(),/Non-finite/);assert.deepEqual(g.journal,commands);assert.equal(a.sync.nextSequence,0);delete g.draft.invalidFixture;await a.save();assert.equal((await storage.batch(g.runId,1)).commands[0].action,'place');storage.close();
});

test('FR010 rapid profile actions queue against the newly returned revision',async()=>{
 const revisions=[],a=new PlayerClient({fetcher:async(_url,options)=>{const b=JSON.parse(options.body);revisions.push(b.revision);await new Promise(r=>setTimeout(r,1));return Response.json({revision:b.revision+1,balance:100,skills:{},equipped:[]});}});a.user={id:'account-id'};a.online=true;a.profile={revision:0};await Promise.all(['field-logistics','quartermaster','morale-boost'].map(skill=>a.changeProfile('purchase',{skill})));assert.deepEqual(revisions,[0,1,2]);assert.equal(a.profile.revision,3);
});

test('FR010 choosing a divergent cloud save atomically discards stale local commands',async()=>{
 const storage=store(),a=new PlayerClient({store:storage,fetcher:guestFetch});a.user={id:'account-id'};const g=new Game(currentFactionData('crown'),{accountId:'account-id',runId:crypto.randomUUID()}),snapshot=serializeRun(g);await a.attach(g);g.place(18,18);await a.save();assert.ok(await storage.batch(g.runId,1));await a.resume({remote:{id:g.runId,sequence:0,factionId:'crown',snapshot}});assert.equal(a.game.towers.length,0);assert.equal(await storage.batch(g.runId,1),null);a.game.place(17,18);await a.save();assert.deepEqual((await storage.batch(g.runId,1)).commands[0].args,[17,18]);storage.close();
});

test('FR010 account removal clears only its local continuation and pending batches',async()=>{
 const storage=store(),a=new PlayerClient({store:storage,fetcher:guestFetch});await a.initialize();const guest=await a.newRun('crown');await a.attach(guest.game,guest);a.user={id:'delete-owner'};const g=new Game(currentFactionData('grove'),{accountId:'delete-owner',runId:crypto.randomUUID()});await a.attach(g);g.place(18,18);await a.save();assert.ok(await storage.batch(g.runId,1));a.fetcher=async()=>Response.json({deleted:true});await a.deleteAccount();assert.equal(await storage.get('delete-owner'),null);assert.equal(await storage.batch(g.runId,1),null);assert.ok(await storage.get('guest'));assert.equal(a.user,null);storage.close();
});

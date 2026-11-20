import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {IDBFactory} from 'fake-indexeddb';
import {PlayerClient} from '../game/player-client.js';
import {RunStore} from '../game/run-store.js';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {hostedGame} from '../backend/hosted-game.js';
import {offlinePlayMarkup} from '../ui/offline-play.js';

test('local guest entry keeps the signed-in account, its save and pending commands available independently',async()=>{
 const store=new RunStore({indexedDB:new IDBFactory()});
 const user={id:'offline-commander'},account=new PlayerClient({store});
 account.user=user;account.progressionEpoch='current-account-epoch';
 const game=new Game(currentFactionData('forge'),{accountId:user.id,runId:'offline-account-run'});
 game.place(18,18);
 await account.attach(game,{fresh:true});
 const saved=await store.get(user.id),batch=await store.batch(game.runId,1);
 let requests=0;
 const guest=new PlayerClient({store,fetcher:async()=>{requests++;throw Error('offline');}});
 await guest.initialize({localGuest:true});
 const context=await guest.newRun('grove');await guest.attach(context.game,context);
 assert.equal(guest.owner,'guest');assert.equal(context.game.accountId,null);
 assert.deepEqual(await store.get(user.id),saved);assert.deepEqual(await store.batch(game.runId,1),batch);
 assert.equal((await store.get('guest')).meta.factionId,'grove');assert.equal(requests,0);
 assert.match(offlinePlayMarkup(account),/\?offline=guest/);assert.match(offlinePlayMarkup(guest),/Return to my account/);
 store.close();
});

test('worker and offline index are public revalidated game files without forwarded credentials',async()=>{
 for(const file of ['offline-game.js','offline-assets.json']){
  let fetched;
  const response=await hostedGame(new Request('https://game.example/play/'+file,{headers:{Cookie:'account=session'}}),{fetcher:async(url,options)=>{fetched={url,options};return new Response('public');}});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.ok(fetched.url.endsWith('/'+file));assert.equal(fetched.options.cf.cacheTtl,0);assert.equal(fetched.options.headers.has('cookie'),false);
 }
});

test('an interrupted offline update keeps the previous complete release and resumes verified files',async()=>{
 const scope='https://game.example/play/',stores=new Map();
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const caches={open:async name=>{
  if(!stores.has(name))stores.set(name,new Map());
  const store=stores.get(name);
  return {keys:async()=>[...store.keys()].map(url=>({url})),put:async(key,r)=>store.set(key,r.clone()),match:async key=>store.get(key)?.clone(),delete:async key=>store.delete(key)};
 }};
 const worker=readFileSync(new URL('../game/offline-worker.js',import.meta.url),'utf8');
 function boot(title,content){
  const listeners={},messages=[],reads=[],client={url:scope,postMessage:m=>messages.push(m)};
  const assets=Object.entries(content).map(([file,body])=>({file,sha256:sha(body),bytes:body.length})),body=JSON.stringify({html:title,assets});
  let broken;
  const self={registration:{scope},navigator:{onLine:false},clients:{matchAll:async()=>[client]},addEventListener:(key,fn)=>{listeners[key]=fn;}};
  const fetch=async url=>{const file=url.slice(scope.length);if(file==='offline-assets.json')return new Response(body);reads.push(file);return new Response(file===broken?'damaged':content[file]);};
  runInNewContext(worker,{self,caches,fetch,PACK_HASH:sha(body),TOTAL_BYTES:assets.reduce((n,a)=>n+a.bytes,0),URL,Headers,Response,AbortController,TextDecoder,crypto:webcrypto});
  return {messages,reads,breakFile:file=>{broken=file;},download:()=>new Promise(resolve=>listeners.message({source:client,data:{type:'offline-game-download'},waitUntil:resolve})),load:(file='',headers={})=>{let promise;listeners.fetch({request:{method:'GET',url:scope+file,mode:file?'cors':'navigate',headers:new Headers(headers)},respondWith:result=>{promise=result;}});return promise;}};
 }
 const unchanged={'assets/a.mp3':'original-audio'};
 const first=boot('release one',{...unchanged,'assets/b.webp':'old-image'});
 await first.download();assert.equal(first.messages.at(-1).phase,'ready');
 const second=boot('release two',{...unchanged,'assets/b.webp':'new-image','assets/c.webp':'another-image'});
 second.breakFile('assets/c.webp');await second.download();assert.equal(second.messages.at(-1).phase,'retry');
 assert.equal(await(await second.load()).text(),'release one');assert.equal(await(await second.load('assets/b.webp?v=1')).text(),'old-image');
 second.breakFile(null);await second.download();assert.equal(second.messages.at(-1).phase,'ready');
 assert.equal(await(await second.load()).text(),'release two');assert.equal(await(await second.load('assets/b.webp?v=2')).text(),'new-image');
 assert.equal(second.reads.includes('assets/a.mp3'),false);assert.equal(second.load('api/player/session'),undefined);
 const audio=await second.load('assets/a.mp3',{Range:'bytes=0-3'});assert.equal(audio.status,206);assert.equal(await audio.text(),'orig');
});

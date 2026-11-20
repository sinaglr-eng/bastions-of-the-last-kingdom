// PACK_HASH and TOTAL_BYTES are supplied by the build for this exact release.
const scope=self.registration.scope;
const contentName='forged-alliances:media:'+scope;
const catalogName='forged-alliances:offline:'+scope;
const catalogKey=new URL('offline-assets.json',scope).href;
const absolute=file=>new URL(file,scope).href;
const contentKey=asset=>absolute(asset.file)+'?offline-sha='+asset.sha256;
const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
let job,progress,installed;
const clientBuilds=new Map();

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

async function activePack(){
 if(installed===undefined){
  installed=(async()=>{
   const catalog=await caches.open(catalogName),response=await catalog.match(catalogKey);
   const saved=response?await response.json():null;
   return saved&&{...saved,byUrl:new Map(saved.assets.map(a=>[absolute(a.file),a]))};
  })().catch(error=>{installed=undefined;throw error;});
 }
 return installed;
}

async function broadcast(state){
 progress=state;
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of windows)if(client.url.startsWith(scope))client.postMessage(state);
}
const status=(phase,details={})=>({type:'offline-game-status',phase,total:TOTAL_BYTES,...details});

async function download(){
 const old=await activePack();
 await broadcast(status('downloading',{bytes:0}));
 const index=await fetch(catalogKey,{cache:'no-store',credentials:'omit'});
 if(!index.ok)throw Error('The download list is unavailable.');
 const bytes=await index.arrayBuffer();
 if(await sha256(bytes)!==PACK_HASH)throw Error('The game was updated. Reload this page and retry.');
 const pack=JSON.parse(new TextDecoder().decode(bytes));
 const content=await caches.open(contentName);
 const existing=new Set((await content.keys()).map(k=>k.url));
 const pending=pack.assets.filter(a=>!existing.has(contentKey(a)));
 const remaining=pending.reduce((n,a)=>n+a.bytes,0);
 const estimate=await self.navigator.storage?.estimate?.().catch(()=>null);
 if(estimate?.quota>0&&remaining>estimate.quota-estimate.usage)throw Error('Free up storage on this device. The remaining download needs '+Math.ceil(remaining/1e6)+' MB.');
 let done=TOTAL_BYTES-remaining,cursor=0,lastUpdate=0,failure;
 const controller=new AbortController();
 async function saveNext(){
  while(!failure&&cursor<pending.length){
   const asset=pending[cursor++];
   try{
    const response=await fetch(absolute(asset.file),{signal:controller.signal,credentials:'omit',cache:'no-cache'});
    if(response.status!==200)throw Error('A game file is unavailable.');
    const data=await response.arrayBuffer(),hash=await sha256(data);
    if(hash!==asset.sha256&&hash!==asset.decodedSha256)throw Error('A game file changed during download.');
    const headers=new Headers({'Content-Type':response.headers.get('Content-Type')||'application/octet-stream','Content-Length':String(data.byteLength)});
    await content.put(contentKey(asset),new Response(data,{headers}));
    done+=asset.bytes;
    if(Date.now()-lastUpdate>250){lastUpdate=Date.now();await broadcast(status('downloading',{bytes:done}));}
   }catch(error){if(!failure)failure=error;controller.abort();}
  }
 }
 await Promise.all(Array.from({length:4},saveNext));
 if(failure)throw failure;
 // One small write commits the complete pack. An interrupted update leaves
 // the previous complete game launchable, and reuses every verified file.
 const catalog=await caches.open(catalogName);
 await catalog.put(catalogKey,Response.json({...pack,hash:PACK_HASH}));
 installed=undefined;
 const wanted=new Set(pack.assets.map(contentKey));
 if(old||existing.size)for(const url of existing)if(!wanted.has(url))await content.delete(url);
 await broadcast(status('ready',{bytes:TOTAL_BYTES}));
}

self.addEventListener('message',event=>{
 if(!event.source?.url?.startsWith(scope))return;
 if(event.data?.type==='offline-game-check'){
  event.waitUntil((async()=>{
   const pack=await activePack();
   if(job||progress?.phase==='retry'){event.source.postMessage(progress||status('downloading',{bytes:0}));return;}
   if(pack?.hash===PACK_HASH){
    const content=await caches.open(contentName),keys=new Set((await content.keys()).map(k=>k.url));
    if(pack.assets.some(asset=>!keys.has(contentKey(asset)))){
     event.source.postMessage(status('retry',{error:'Some downloaded files are missing.'}));return;
    }
   }
   event.source.postMessage(status(pack?.hash===PACK_HASH?'ready':pack?'update':'available'));
  })());
 }
 if(event.data?.type==='offline-game-download'){
  if(!job)job=download().catch(error=>broadcast(status('retry',{error:error.name==='QuotaExceededError'?'There is not enough storage on this device.':error.message}))).finally(()=>{job=null;});
  event.waitUntil(job);
 }
});

async function offlineResponse(request,assetUrl,navigation){
 const pack=await activePack();
 if(!pack)return;
 if(navigation)return new Response(pack.html,{headers:{'Content-Type':'text/html; charset=utf-8'}});
 const asset=pack.byUrl.get(assetUrl);
 if(!asset)return;
 const content=await caches.open(contentName),response=await content.match(contentKey(asset));
 const range=request.headers.get('Range');
 if(!response||!range)return response;
 // Browsers use a single byte range for streaming / seeking bundled music.
 const data=await response.blob(),match=/^bytes=(\d*)-(\d*)$/.exec(range);
 if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+data.size}});
 const start=match[1]?Number(match[1]):Math.max(0,data.size-Number(match[2]));
 const end=match[1]&&match[2]?Math.min(Number(match[2]),data.size-1):data.size-1;
 if(start>end||start>=data.size)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+data.size}});
 return new Response(data.slice(start,end+1),{status:206,headers:{'Content-Range':`bytes ${start}-${end}/${data.size}`,'Accept-Ranges':'bytes','Content-Length':String(end-start+1),'Content-Type':data.type}});
}

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||!request.url.startsWith(scope))return;
 const url=new URL(request.url),assetUrl=url.origin+url.pathname;
 const navigation=request.mode==='navigate'&&(assetUrl===scope||assetUrl===absolute('index.html'));
 if(!navigation&&!assetUrl.startsWith(absolute('assets/'))&&assetUrl!==absolute('favicon.svg'))return;
 // Only public game media and the game entry are eligible. Account/auth/score
 // responses continue directly to their first-party endpoints.
 event.respondWith((async()=>{
  let upstream;
  if(self.navigator.onLine!==false){
   const pack=await activePack();
   // The hashed entry identifies the code the current tab is running. Only
   // serve local art online when that entry belongs to the installed pack.
   if(pack&&event.clientId&&!navigation){
    if(request.destination==='script'&&/\/assets\/game-[\w-]+\.js$/.test(url.pathname)){
     if(pack.byUrl.has(assetUrl))clientBuilds.set(event.clientId,pack.hash);
     else clientBuilds.delete(event.clientId);
    }
    if(clientBuilds.get(event.clientId)===pack.hash){
     const local=await offlineResponse(request,assetUrl,false);
     if(local)return local;
    }
   }
   try{upstream=await fetch(request);if(upstream.ok||upstream.status<500)return upstream;}catch{}
  }
  const cached=await offlineResponse(request,assetUrl,navigation);
  return cached||upstream||Response.error();
 })());
});

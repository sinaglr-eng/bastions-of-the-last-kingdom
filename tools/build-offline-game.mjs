import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {FACTIONS} from '../game/core/factions.js';
import {currentFactionData} from '../game/core/current-data.js';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

// This formerly ran on every New Game click, fetching the eight opening models
// serially. Check the exact shipped bytes here; normal model loads also check SHA.
export function verifyOpeningModels(output){
 for(const {id} of FACTIONS){
  const data=currentFactionData(id);
  for(const asset of data.defenderAssets.filter(a=>a.tier===1&&!data.towers[a.family].advanced)){
   const packed=fs.readFileSync(path.join(output,asset.packedFile||asset.file));
   const bytes=asset.packedFile?gunzipSync(packed):packed;
   if(digest(bytes)!==asset.sha256||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid opening model: '+asset.family);
   const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
   if(!gltf.skins?.length||!['Idle','Attack'].every(name=>gltf.animations?.some(a=>a.name===name)))throw Error('Missing opening animations: '+asset.family);
  }
 }
}

export function buildOfflineGame(runtime,output='dist'){
 verifyOpeningModels(output);
 const rows=new Map(runtime.assets.filter(r=>r.file==='favicon.svg'||r.file.startsWith('assets/')&&!/^assets\/ui\/faction-scenes-v062\/.+-march\.png$/.test(r.file)).map(r=>[r.file,{file:r.file,bytes:r.bytes,sha256:r.sha256}]));
 // Vite owns the entry bundle, CSS, fonts and imported art. The runtime
 // manifest covers the larger asset directories copied after Rollup finishes.
 for(const entry of fs.readdirSync(path.join(output,'assets'),{withFileTypes:true})){
  if(!entry.isFile())continue;
  const file='assets/'+entry.name,bytes=fs.readFileSync(path.join(output,file));
  rows.set(file,{file,bytes:bytes.length,sha256:digest(bytes)});
 }
 for(const {id} of FACTIONS){
  for(const asset of currentFactionData(id).defenderAssets){
   const row=rows.get(asset.packedFile);
   if(row)row.decodedSha256=asset.sha256;
  }
 }
 for(const asset of runtime.assets)if(asset.decodedSha256&&rows.has(asset.file))rows.get(asset.file).decodedSha256=asset.decodedSha256;
 const assets=[...rows.values()].sort((a,b)=>a.file<b.file?-1:1);
 const pack={html:fs.readFileSync(path.join(output,'index.html'),'utf8'),assets};
 const json=JSON.stringify(pack);
 const version=digest(json);
 const totalBytes=assets.reduce((sum,a)=>sum+a.bytes,0);
 fs.writeFileSync(path.join(output,'offline-assets.json'),json);
 const worker=fs.readFileSync(new URL('../game/offline-worker.js',import.meta.url),'utf8');
 fs.writeFileSync(path.join(output,'offline-game.js'),`const PACK_HASH='${version}', TOTAL_BYTES=${totalBytes};\n`+worker);
 return {version,totalBytes,files:assets.length};
}

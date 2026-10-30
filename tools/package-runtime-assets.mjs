import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
export function packageRuntimeAssets({root=process.cwd(),outDir='dist'}={}){
 const output=path.resolve(root,outDir),source=path.resolve(root,'public');
 if(output===source||!output.startsWith(path.resolve(root)+path.sep))throw Error('Invalid runtime output');
 const files=walk(source),rows=[];
 const keep=file=>file.startsWith('assets/factions/v060/')&&!file.endsWith('.png')||['favicon.svg','release.json'].includes(file)||['assets/audio/','assets/branding/','assets/scenery/','assets/ui/results/','assets/ui/reference-enemy-fronts/','assets/ui/faction-scenes-v062/','assets/ui/faction-reference-portraits-v061/'].some(prefix=>file.startsWith(prefix))||/^assets\/geometric\/portraits\/host_[^/]+\.png$/.test(file)||file==='assets/geometric/geometric-enemies.json';
 const emit=(file,bytes,originalSha256)=>{const dest=path.join(output,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);rows.push({file,bytes:bytes.length,sha256:sha(bytes),...(originalSha256?{decodedSha256:originalSha256}:{})});};
 for(const absolute of files){const file=path.relative(source,absolute).replaceAll('\\','/');if(keep(file))emit(file,fs.readFileSync(absolute));}
 const manifest=JSON.parse(fs.readFileSync(path.join(source,'assets/geometric/geometric-enemies.json'))),entries=manifest.assets||manifest.entries||manifest.models||manifest.subjects;
 for(const entry of entries){const file=entry.file.startsWith('assets/')?entry.file:'assets/geometric/'+entry.file;if(!file.startsWith('assets/geometric/approved-enemies-v6/')||!file.endsWith('.glb'))throw Error('Unexpected active enemy path');const bytes=fs.readFileSync(path.join(source,file)),compressed=gzipSync(bytes,{level:9,mtime:0});if(sha(gunzipSync(compressed))!==sha(bytes))throw Error('Enemy transport differs');emit(file+'.gz',compressed,sha(bytes));}
 // The earlier modeling atelier stays in source and the 0.5.2 backup. Its old
 // public entry now returns to the current game, which owns the V3 roster.
 const gameBase=process.env.VITE_BASE_PATH||'/';emit('archer.html',Buffer.from(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Forged Alliances TD</title><meta http-equiv="refresh" content="0;url=${gameBase}"><a href="${gameBase}">Open Forged Alliances TD 0.6.1</a></html>`));
 const total=rows.reduce((n,r)=>n+r.bytes,0);if(total>980000000)throw Error(`Runtime exceeds publication budget: ${total}`);
 const receipt={status:'passed',version:'0.6.1',files:rows.length,bytes:total,allEnemyDecodedHashesMatch:true,scope:'Only current game media. Historical models, turnarounds and review deliveries remain local in source and backup.',assets:rows};
 fs.writeFileSync(path.join(output,'runtime-assets.json'),JSON.stringify(receipt,null,2)+'\n');console.log(`Current runtime media: ${rows.length} files, ${(total/1e6).toFixed(1)} MB; lossless model transport.`);return receipt;
}

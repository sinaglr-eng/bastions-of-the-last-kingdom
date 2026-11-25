import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {BATTLEFIELD_ASSET,GAME_VERSION} from '../game/release.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {ARTIFACT_CATALOG} from '../game/core/artifacts.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
export function packageRuntimeAssets({root=process.cwd(),outDir='dist'}={}){
 const output=path.resolve(root,outDir),source=path.resolve(root,'public');
 if(output===source||!output.startsWith(path.resolve(root)+path.sep))throw Error('Invalid runtime output');
 const files=walk(source),rows=[];
 const generated=JSON.parse(fs.readFileSync(path.join(source,'assets/ui/commander-generated/manifest.json'),'utf8'));
 const hud=JSON.parse(fs.readFileSync(path.join(source,'assets/ui/hud-generated/manifest.json'),'utf8'));
 const commander=new Set([...ARTIFACT_CATALOG.artifacts.map(a=>a.art),...ARTIFACT_CATALOG.chests.flatMap(c=>[c.art,c.openArt]),'assets/ui/commander-v080/silhouette-commander.webp','assets/ui/commander-feedback/champions.webp','assets/ui/commander-feedback/basic-defenders.webp',...generated.icons.map(i=>i.file)]);
 for(const item of hud.icons)commander.add(item.file);
 const retiredCommander=new Set([...Object.keys(GENERAL_SKILLS).map(id=>`assets/ui/geometric/skill-${id}.svg`),...['equipment','skills','chests','sets','relic-dust','commander','sound',...hud.icons.map(i=>i.id)].map(id=>`assets/ui/geometric/${id}.svg`)]);
 const retiredSkill=file=>Object.keys(GENERAL_SKILLS).some(id=>file===`assets/ui/war-table/${id}.webp`)||file.startsWith('assets/ui/account-progression/')&&(file.endsWith('.png')||file.endsWith('alliance-logo-original.webp'));
 const retiredNavigation=/^assets\/ui\/war-table\/homeland\/(?:(?:human|dwarves|elves|skills|equipment|chests|sets)-(?:oak|ember)|rank-surround|rank(?:[1-9]|1[0-5]))\.webp$/;
 const keep=file=>!retiredNavigation.test(file)&&!retiredSkill(file)&&(commander.has(file)||file.startsWith('assets/factions/v060/')&&!file.endsWith('.png')||['favicon.svg','release.json','privacy.html',BATTLEFIELD_ASSET].includes(file)||['assets/ui/geometric/','assets/audio/','assets/ui/results/','assets/ui/war-table/','assets/ui/ornate/','assets/ui/ipad-polish/','assets/ui/account-progression/','assets/ui/reference-enemy-fronts/','assets/ui/faction-scenes-v062/','assets/ui/faction-reference-portraits-v061/'].some(prefix=>file.startsWith(prefix))||/^assets\/geometric\/portraits\/host_[^/]+\.png$/.test(file)||file==='assets/geometric/geometric-enemies.json');
 for(const file of commander)if(!fs.existsSync(path.join(source,file)))throw Error('Missing current Commander art: '+file);
 const emit=(file,bytes,originalSha256)=>{const dest=path.join(output,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);rows.push({file,bytes:bytes.length,sha256:sha(bytes),...(originalSha256?{decodedSha256:originalSha256}:{})});};
 for(const absolute of files){const file=path.relative(source,absolute).replaceAll('\\','/');if(!retiredCommander.has(file)&&keep(file))emit(file,fs.readFileSync(absolute));}
 const manifest=JSON.parse(fs.readFileSync(path.join(source,'assets/geometric/geometric-enemies.json'))),entries=manifest.assets||manifest.entries||manifest.models||manifest.subjects;
 for(const entry of entries){const file=entry.file.startsWith('assets/')?entry.file:'assets/geometric/'+entry.file;if(!file.startsWith('assets/geometric/approved-enemies-v6/')||!file.endsWith('.glb'))throw Error('Unexpected active enemy path');const bytes=fs.readFileSync(path.join(source,file)),compressed=gzipSync(bytes,{level:9,mtime:0});if(sha(gunzipSync(compressed))!==sha(bytes))throw Error('Enemy transport differs');emit(file+'.gz',compressed,sha(bytes));}
 // Required approved modeling sources stay local. The former atelier
 // public entry returns to the current game, which owns the V3 roster.
 const gameBase=process.env.VITE_BASE_PATH||'/';emit('archer.html',Buffer.from(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Forged Alliances TD</title><meta http-equiv="refresh" content="0;url=${gameBase}"><a href="${gameBase}">Open Forged Alliances TD ${GAME_VERSION}</a></html>`));
 const total=rows.reduce((n,r)=>n+r.bytes,0);if(total>980000000)throw Error(`Runtime exceeds publication budget: ${total}`);
 const receipt={status:'passed',version:GAME_VERSION,files:rows.length,bytes:total,allEnemyDecodedHashesMatch:true,scope:'Only current game media. Approved original models, turnarounds and recorded reviews remain local source dependencies.',assets:rows};
 fs.writeFileSync(path.join(output,'runtime-assets.json'),JSON.stringify(receipt,null,2)+'\n');console.log(`Current runtime media: ${rows.length} files, ${(total/1e6).toFixed(1)} MB; lossless model transport.`);return receipt;
}

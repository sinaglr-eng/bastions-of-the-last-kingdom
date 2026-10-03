// Verify the actual delivered bytes, rather than infer publication from a push.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {geometricEntries} from '../game/render/geometric-assets.js';
import {GAME_VERSION} from '../game/release.js';

const args=process.argv.slice(2),base=new URL(args[0]),reportIndex=args.indexOf('--report'),commitIndex=args.indexOf('--commit');
if(!base.pathname.endsWith('/'))throw new Error('Base URL must end with /');
const local=new URL('../public/assets/geometric/',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=[],entries=[];
for(const kind of ['defenders','champions','enemies']){
  const file=`geometric-${kind}.json`,bytes=readFileSync(new URL(file,local));
  expected.push({file,sha256:hash(bytes),kind:'manifest'});entries.push(...geometricEntries(JSON.parse(bytes)));
}
const source=readFileSync(new URL('source-manifest.json',local));expected.push({file:'source-manifest.json',sha256:hash(source),kind:'manifest'});
if(entries.length!==136)throw new Error(`Expected 136 models, got ${entries.length}`);
for(const entry of entries)for(const [kind,file] of [['model',entry.file],['portrait',entry.portrait]])expected.push({id:entry.id,kind,file,sha256:hash(readFileSync(new URL(file,local)))});
const references=JSON.parse(source);
if(references.length!==136)throw new Error('Expected 136 original six-view sources');
for(const reference of references){
  const urlPath='geometric-turnarounds-v1/'+reference.file,bytes=readFileSync(new URL('../public/'+urlPath,import.meta.url));
  if(hash(bytes)!==reference.sha256)throw new Error('Local original source mismatch: '+reference.id);
  expected.push({id:reference.id,kind:'originalSource',file:reference.file,urlPath,sha256:reference.sha256});
}
async function request(url){
  const response=await fetch(url,{signal:AbortSignal.timeout(30000),cache:'no-store'});
  if(!response.ok)throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
const results=[];let next=0;
await Promise.all(Array.from({length:6},async()=>{
  while(next<expected.length){
    const entry=expected[next++],url=new URL(entry.urlPath||'assets/geometric/'+entry.file,base);url.searchParams.set('verify',entry.sha256.slice(0,16));
    const bytes=await request(url),actual=hash(bytes);
    if(actual!==entry.sha256)throw new Error(`Published byte mismatch: ${entry.file}`);
    results.push({...entry,bytes:bytes.length,passed:true});
  }
}));
for(const file of ['index.html','archer.html']){
  const html=(await request(new URL(file,base))).toString(),script=html.match(/<script[^>]+src="([^"]+)"/);
  if(!script)throw new Error(`${file}: missing actual entry script`);
  const pending=[new URL(script[1],base)],seen=new Set();let versionFound=false;
  while(pending.length){
    const url=pending.pop();if(seen.has(String(url)))continue;seen.add(String(url));
    if(seen.size>30)throw new Error(`${file}: unexpected module graph`);
    const code=(await request(url)).toString();versionFound ||= code.includes(GAME_VERSION);
    for(const match of code.matchAll(/(?:from|import)\s*["'](\.[^"']+\.js)["']/g))pending.push(new URL(match[1],url));
  }
  if(!versionFound)throw new Error(`${file}: current release version absent`);
}
const report={base:String(base),commit:commitIndex<0?null:args[commitIndex+1],verifiedAt:new Date().toISOString(),models:entries.length,portraits:entries.length,sourceSheets:references.length,manifests:4,entryPages:2,allDeliveredBytesMatched:true,results};
if(reportIndex>=0)writeFileSync(args[reportIndex+1],JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:undefined}));

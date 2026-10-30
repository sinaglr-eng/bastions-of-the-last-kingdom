import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
// Asset packaging only: background removal is already present in the saved
// built-in ImageGen results. Never segment, paint, recolor or redraw pixels here.
const require=createRequire(import.meta.url),sharp=require(require.resolve('sharp',{paths:[process.argv[3]||process.cwd()]}));
const gallery=path.resolve(process.argv[2]||''),folder='public/assets/ui/faction-reference-portraits-v061',evidence='output/releases/v0.6.1';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const plan=read(evidence+'/portrait-source-plan.json'),ai=read(evidence+'/ai-backgrounds/manifest.json');
if(sha(fs.readFileSync(path.join(gallery,'dist/visual-catalogue-v24.json')))!==plan.catalogueSha256)throw Error('Gallery revision changed');
const results=new Map(ai.results.map(r=>[r.source,r])),rows=[];
for(const r of plan.rows){
 const source=path.join(gallery,r.source),bytes=fs.readFileSync(source);if(sha(bytes)!==r.sourceSha256)throw Error('Source differs: '+r.key);
 const original=await sharp(bytes).metadata(),result=results.get(r.source),input=result?fs.readFileSync(result.file):bytes,meta=await sharp(input).metadata();
 if(result&&sha(input)!==result.sha256)throw Error('AI result differs: '+r.key);
 let frame={left:0,top:0,width:meta.width,height:meta.height};
 if(r.galleryArt.frame&&(!result||result.layout==='atlas')){const f=r.galleryArt.frame,sx=meta.width/original.width,sy=meta.height/original.height;frame={left:Math.round(f.x*sx),top:Math.round(f.y*sy),width:Math.round(f.width*sx),height:Math.round(f.height*sy)};frame.width=Math.min(frame.width,meta.width-frame.left);frame.height=Math.min(frame.height,meta.height-frame.top);}
 const output=r.output,dest='public/'+output;fs.mkdirSync(path.dirname(dest),{recursive:true});
 let trim=null;let operation;if(!result&&!r.galleryArt.frame){fs.writeFileSync(dest,bytes);operation='Exact existing gallery RGBA bytes';}
 else{const crop=await sharp(input).extract(frame).ensureAlpha().png().toBuffer(),pixels=await sharp(crop).raw().toBuffer({resolveWithObject:true});let x0=pixels.info.width,y0=pixels.info.height,x1=-1,y1=-1;for(let y=0;y<pixels.info.height;y++)for(let x=0;x<pixels.info.width;x++)if(pixels.data[(y*pixels.info.width+x)*4+3]>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}if(x1<0)throw Error('Empty alpha');trim={left:Math.max(0,x0-3),top:Math.max(0,y0-3),width:Math.min(pixels.info.width,x1+4)-Math.max(0,x0-3),height:Math.min(pixels.info.height,y1+4)-Math.max(0,y0-3)};await sharp(crop).extract(trim).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toFile(dest);operation=result?'Crop and size saved AI RGBA result; no further background editing':'Exact gallery frame crop';}
 const {data,info}=await sharp(dest).ensureAlpha().raw().toBuffer({resolveWithObject:true});let transparent=0,solid=0;for(let i=3;i<data.length;i+=4){if(data[i]<8)transparent++;if(data[i]>240)solid++;}
 if(transparent<info.width*info.height*.03||solid<info.width*info.height*.02)throw Error('Portrait transparency/content missing: '+r.key);
 rows.push({key:r.key,name:r.name,file:output,sha256:sha(fs.readFileSync(dest)),dimensions:[info.width,info.height],transparentPixels:transparent,solidPixels:solid,method:result?'ai-background-removal':'existing-gallery-alpha',operation,galleryFile:r.galleryArt.file,galleryFrame:r.galleryArt.frame||null,originalSource:r.source,originalSourceSha256:r.sourceSha256,...(result?{aiSource:result.file,aiSourceSha256:result.sha256,aiFrame:frame,transparentMarginTrim:trim}:{})});
}
const manifest={revision:'gallery-reference-portraits-v24-ai-20261030-v1',catalogueSha256:plan.catalogueSha256,generator:'Existing gallery alpha or built-in ImageGen background removal, as chosen by the user',profiles:rows};
fs.writeFileSync(folder+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const registry=read('data/factions-v060.json');for(const f of registry.factions)for(const entry of f.assets){const key=f.id+'/'+entry.family+'/'+entry.tier,row=rows.find(r=>r.key===key);if(!row)throw Error('Missing exact identity: '+key);entry.portrait=row.file;}
fs.writeFileSync('data/factions-v060.json',JSON.stringify(registry,null,2)+'\n');
fs.writeFileSync(evidence+'/portrait-delivery.json',JSON.stringify({status:'passed',profiles:rows.length,aiProfiles:rows.filter(r=>r.method==='ai-background-removal').length,existingAlphaProfiles:rows.filter(r=>r.method==='existing-gallery-alpha').length,sourceImages:ai.results.length,originalGalleryUnchanged:true,portraitsManifestSha256:sha(fs.readFileSync(folder+'/manifest.json')),files:rows.map(r=>r.file)},null,2)+'\n');
console.log(JSON.stringify({profiles:rows.length,aiProfiles:rows.filter(r=>r.method==='ai-background-removal').length,existingAlphaProfiles:rows.filter(r=>r.method==='existing-gallery-alpha').length}));

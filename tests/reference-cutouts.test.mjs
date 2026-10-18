import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {REFERENCE_PORTRAIT_REVISION,ENEMY_FRONT_PORTRAIT_REVISION,referencePortrait} from '../ui/reference-portraits.js';

const bytes=path=>readFileSync(new URL(`../${path}`,import.meta.url));
const json=path=>JSON.parse(bytes(path).toString('utf8'));
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const manifest=json('public/assets/ui/reference-cutouts/manifest.json');
const originals=json('public/assets/ui/reference-portraits/manifest.json');
const settings=json('tools/reference-cutout-masks.json');

test('Bernhard uses the approved crimson reference with exact source RGB and real alpha',()=>{
  const variant=json('public/assets/ui/portrait-variants/manifest.json');
  const sourceBytes=bytes(variant.source),outputBytes=bytes(variant.output);
  assert.equal(hash(sourceBytes),variant.sourceSha256);assert.equal(hash(outputBytes),variant.sha256);
  const source=decodePng(sourceBytes),output=decodePng(outputBytes);
  assert.equal(output.channels,4);assert.deepEqual([output.width,output.height],variant.dimensions);
  const [x,y]=variant.sourceRectangle,[left,top]=variant.trimRectangle;
  let transparent=0,crimson=0;
  for(let row=0;row<output.height;row++)for(let column=0;column<output.width;column++){
    const at=(row*output.width+column)*4,original=((y+top+row)*source.width+x+left+column)*source.channels;
    for(let channel=0;channel<3;channel++)assert.equal(output.pixels[at+channel],source.pixels[original+channel]);
    if(!output.pixels[at+3])transparent++;
    else if(output.pixels[at]>60&&output.pixels[at]>2*output.pixels[at+1]&&output.pixels[at]>1.7*output.pixels[at+2])crimson++;
  }
  assert.ok(transparent>output.width*output.height*.2);assert.ok(crimson>4000);
  assert.match(referencePortrait('host_50'),/reference-enemy-fronts\/host_50\.png/);
});

// Independent decoder for the delivered non-interlaced, eight-bit RGB/RGBA
// rasters. This exercises real PNG transparency instead of trusting metadata.
function decodePng(buffer){
  assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20),type=buffer[25];
  assert.equal(buffer[24],8);assert.ok(type===2||type===6);assert.equal(buffer[28],0);
  const channels=type===6?4:3,idat=[];
  for(let offset=8;offset<buffer.length;){
    const length=buffer.readUInt32BE(offset),kind=buffer.toString('ascii',offset+4,offset+8);
    if(kind==='IDAT')idat.push(buffer.subarray(offset+8,offset+8+length));
    offset+=length+12;
  }
  const raw=inflateSync(Buffer.concat(idat)),stride=width*channels,pixels=Buffer.alloc(width*height*channels);
  assert.equal(raw.length,(stride+1)*height);
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];assert.ok(filter<=4);
    for(let x=0;x<stride;x++){
      const at=y*stride+x,left=x>=channels?pixels[at-channels]:0,above=y?pixels[at-stride]:0,corner=y&&x>=channels?pixels[at-stride-channels]:0;
      let prediction=0;
      if(filter===1)prediction=left;
      else if(filter===2)prediction=above;
      else if(filter===3)prediction=Math.floor((left+above)/2);
      else if(filter===4){const p=left+above-corner,a=Math.abs(p-left),b=Math.abs(p-above),c=Math.abs(p-corner);prediction=a<=b&&a<=c?left:b<=c?above:corner;}
      pixels[at]=(raw[y*(stride+1)+1+x]+prediction)&255;
    }
  }
  return {width,height,channels,pixels};
}

test('all 136 historical cutouts remain exact transparent derivatives while runtime enemies use separate front portraits',()=>{
  assert.equal(manifest.identities.length,136);assert.equal(manifest.revision,REFERENCE_PORTRAIT_REVISION);
  assert.equal(json('public/release.json').uiPortraitRevision,manifest.revision);
  assert.equal(manifest.maskSha256,hash(bytes('tools/reference-cutout-masks.json')));
  const sourceById=new Map(originals.identities.map(row=>[row.id,row]));
  assert.deepEqual(manifest.identities.map(row=>row.id).sort(),[...sourceById.keys()].sort());
  for(const row of manifest.identities){
    const before=sourceById.get(row.id),sourceBytes=bytes(row.sourceCrop),outputBytes=bytes(row.output);
    assert.equal(hash(sourceBytes),before.sha256,row.id);assert.equal(hash(outputBytes),row.sha256,row.id);
    assert.equal(row.sourceCropSha256,before.sha256);assert.equal(row.originalSourceSha256,before.sourceSha256);
    const enemy=row.category==='enemies';assert.equal(referencePortrait(row.id,{base:'/project/'}),`/project/assets/ui/${enemy?'reference-enemy-fronts':'reference-cutouts'}/${row.id}.png?v=${enemy?ENEMY_FRONT_PORTRAIT_REVISION:REFERENCE_PORTRAIT_REVISION}`);
    const source=decodePng(sourceBytes),output=decodePng(outputBytes);
    assert.equal(output.channels,4,row.id);assert.deepEqual([output.width,output.height],row.dimensions);
    const [left,top,right,bottom]=row.sourceCropBounds;
    assert.ok(left>=0&&top>=0&&right<=source.width&&bottom<=source.height);
    assert.deepEqual([right-left,bottom-top],row.dimensions);
    let transparent=0,opaque=0,edge=0;
    for(let y=0;y<output.height;y++)for(let x=0;x<output.width;x++){
      const actual=(y*output.width+x)*4,original=((y+top)*source.width+x+left)*source.channels;
      for(let channel=0;channel<3;channel++)assert.equal(output.pixels[actual+channel],source.pixels[original+channel],`${row.id} retains source RGB`);
      const alpha=output.pixels[actual+3];if(alpha===0)transparent++;else if(alpha===255)opaque++;else edge++;
    }
    assert.equal(transparent,row.transparentPixels);assert.ok(transparent>output.width*output.height*.05,row.id);
    assert.equal(opaque,row.opaquePixels);assert.ok(opaque>output.width*output.height*.15,row.id);assert.equal(edge,row.edgePixels);assert.ok(edge>0);
    for(const [x,y]of settings.opaqueProbes[row.id]||[])assert.equal(output.pixels[((y-top)*output.width+x-left)*4+3],255,`${row.id} preserves pale cloth/armor`);
  }
});

test('the transparent review gallery resolves all exact files and uses English current copy',()=>{
  const gallery=new URL('../output/design/cartographer-ui-v041-20261016/portraits/index.html',import.meta.url);
  const markup=readFileSync(gallery,'utf8');assert.match(markup,/<html lang="en">/);
  const images=[...markup.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/g)];assert.equal(images.length,136);
  for(let index=0;index<images.length;index++)assert.equal(hash(readFileSync(new URL(images[index][1],gallery))),manifest.identities[index].sha256);
});

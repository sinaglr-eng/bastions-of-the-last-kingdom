import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {referenceEnemyPortrait,referenceDefenderPortrait,ENEMY_FRONT_PORTRAIT_REVISION,REFERENCE_PORTRAIT_REVISION} from '../ui/reference-portraits.js';
const bytes=file=>readFileSync(new URL('../'+file,import.meta.url)),json=file=>JSON.parse(bytes(file)),sha=value=>createHash('sha256').update(value).digest('hex');
const manifest=json('public/assets/ui/reference-enemy-fronts/manifest.json'),originals=json('public/assets/ui/reference-portraits/manifest.json');

// Independent PNG scanline decoder. Source images may be RGB or RGBA; final
// transparency and every RGB channel are checked against actual source bytes.
function decodePng(buffer){
  assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20),type=buffer[25];assert.equal(buffer[24],8);assert.ok(type===2||type===6);assert.equal(buffer[28],0);
  const channels=type===6?4:3,idat=[];
  for(let offset=8;offset<buffer.length;){const length=buffer.readUInt32BE(offset);if(buffer.toString('ascii',offset+4,offset+8)==='IDAT')idat.push(buffer.subarray(offset+8,offset+8+length));offset+=length+12;}
  const raw=inflateSync(Buffer.concat(idat)),stride=width*channels,pixels=Buffer.alloc(width*height*channels);assert.equal(raw.length,(stride+1)*height);
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];assert.ok(filter<=4);
    for(let x=0;x<stride;x++){
    const at=y*stride+x,left=x>=channels?pixels[at-channels]:0,above=y?pixels[at-stride]:0,corner=y&&x>=channels?pixels[at-stride-channels]:0;let prediction=0;
    if(filter===1)prediction=left;else if(filter===2)prediction=above;else if(filter===3)prediction=Math.floor((left+above)/2);else if(filter===4){const p=left+above-corner,a=Math.abs(p-left),b=Math.abs(p-above),c=Math.abs(p-corner);prediction=a<=b&&a<=c?left:b<=c?above:corner;}
    pixels[at]=(raw[y*(stride+1)+1+x]+prediction)&255;
    }
  }
  return {width,height,channels,pixels};
}

test('all 50 runtime enemy portraits use separately reviewed FRONT crops and preserve exact approved RGB with real alpha',()=>{
  assert.equal(manifest.revision,ENEMY_FRONT_PORTRAIT_REVISION);assert.equal(manifest.identities.length,50);assert.equal(sha(bytes(manifest.sourceManifest)),manifest.sourceManifestSha256);assert.equal(sha(bytes(manifest.maskSettings)),manifest.maskSettingsSha256);
  assert.deepEqual(manifest.identities.map(row=>row.id),Array.from({length:50},(_,index)=>`host_${String(index+1).padStart(2,'0')}`));
  const sources=new Map(originals.identities.filter(row=>row.category==='enemies').map(row=>[row.id,row]));
  for(const row of manifest.identities){
    const original=sources.get(row.id);assert.equal(row.name,original.name);assert.equal(row.view,'FRONT');assert.equal(row.reviewStatus,'approved');assert.ok(row.reviewDecision.length>30);assert.equal(row.rectangleMode,'left, top, right, bottom');
    const sourceBytes=bytes(row.source),outputBytes=bytes(row.output);assert.equal(sha(sourceBytes),row.sourceSha256);assert.equal(sha(outputBytes),row.sha256);
    assert.equal(row.id==='host_50'?row.source:row.sourceSha256,row.id==='host_50'?'public/assets/ui/portrait-variants/lord-bernhard-crimson-reference.png':original.sourceSha256);
    const source=decodePng(sourceBytes),output=decodePng(outputBytes),[x,y,right,bottom]=row.sourceRectangle,[left,top,trimRight,trimBottom]=row.trimRectangle;
    assert.deepEqual([source.width,source.height],[1536,1024]);assert.ok(x>=0&&y>=0&&right<=512&&bottom<=512,'Only the FRONT panel may supply RGB');assert.equal(output.channels,4);assert.deepEqual([output.width,output.height],row.dimensions);assert.deepEqual(row.dimensions,[trimRight-left,trimBottom-top]);
    const actualRgb=Buffer.alloc(output.width*output.height*3),expectedRgb=Buffer.alloc(actualRgb.length);let transparent=0,opaque=0,edge=0,crimson=0;
    for(let iy=0;iy<output.height;iy++)for(let ix=0;ix<output.width;ix++){
      const pixel=iy*output.width+ix,at=pixel*4,originalAt=((y+top+iy)*source.width+x+left+ix)*source.channels;
      for(let channel=0;channel<3;channel++){actualRgb[pixel*3+channel]=output.pixels[at+channel];expectedRgb[pixel*3+channel]=source.pixels[originalAt+channel];}
      const alpha=output.pixels[at+3];if(alpha===0)transparent++;else if(alpha===255)opaque++;else edge++;
      if(alpha>0&&output.pixels[at]>60&&output.pixels[at]>2*output.pixels[at+1]&&output.pixels[at]>1.7*output.pixels[at+2])crimson++;
    }
    assert.deepEqual(actualRgb,expectedRgb,row.id+' must not recolor, redraw, mirror or resize source RGB');assert.equal(transparent,row.transparentPixels);assert.equal(opaque,row.opaquePixels);assert.equal(edge,row.edgePixels);assert.ok(transparent>output.width*output.height*.04);assert.ok(opaque>output.width*output.height*.12);assert.ok(edge>0);
    for(const [px,py]of row.opaqueProbesSource)assert.equal(output.pixels[((py-y-top)*output.width+px-x-left)*4+3],255,row.id+' preserves the reviewed pale source facet');
    if(row.id==='host_50')assert.ok(crimson>4000,'The front rider and mount retain approved crimson accents');
    assert.equal(referenceEnemyPortrait(row.id,{base:'/project/'}),`/project/assets/ui/reference-enemy-fronts/${row.id}.png?v=${ENEMY_FRONT_PORTRAIT_REVISION}`);
  }
  assert.equal(referenceDefenderPortrait('archer',4,{base:'/project/'}),`/project/assets/ui/reference-cutouts/archer-4.png?v=${REFERENCE_PORTRAIT_REVISION}`);
});

test('the historical 136 portraits, 136 cutouts and 0.4.2 crimson derivative remain byte-identical',()=>{
  assert.equal(manifest.historicalAssetsPreserved,true);for(const [file,expected]of Object.entries(manifest.historicalAssetsSha256))assert.equal(sha(bytes(file)),expected,file);
  assert.equal(originals.identities.length,136);assert.equal(json('public/assets/ui/reference-cutouts/manifest.json').identities.length,136);
  const old=json('public/assets/ui/portrait-variants/manifest.json');assert.equal(sha(bytes(old.source)),old.sourceSha256);assert.equal(sha(bytes(old.output)),old.sha256);
  assert.equal(originals.identities.find(row=>row.id==='host_44').view,'LEFT panel; full axe and silhouette without neighboring caption');assert.equal(manifest.identities.find(row=>row.id==='host_44').view,'FRONT');
});

test('the English FRONT review gallery resolves all 50 exact delivered images',()=>{
  const file=new URL('../output/design/ui-refinements-v043-20261018/front-enemies/index.html',import.meta.url),markup=readFileSync(file,'utf8');assert.match(markup,/<html lang="en">/);assert.match(markup,/All 50 enemies use the top-left FRONT panel/);
  const images=[...markup.matchAll(/<img[^>]*src="([^"]+)"/g)];assert.equal(images.length,50);for(let index=0;index<images.length;index++)assert.equal(sha(readFileSync(new URL(images[index][1],file))),manifest.identities[index].sha256);
});

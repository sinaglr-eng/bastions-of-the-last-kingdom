import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {loadCurrentDatasets} from '../tools/current-datasets.mjs';
import {Game} from '../game/core/game.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {configuredWarbandInfo,currentWarbandInfo} from '../game/core/warband-info.js';
import {referencePortraitImageMap,enemyPortraitImage} from '../ui/reference-portraits.js';
import {enemyGroupPortraits} from '../ui/enemy-portraits.js';
import {warbandCardsMarkup} from '../ui/warband-cards.js';
import {wavePreviewMarkup} from '../ui/wave-preview.js';
import {currentWavePanelMarkup} from '../ui/current-wave-panel.js';
import {currentWaveSummaryMarkup} from '../ui/current-wave-summary.js';
import {selectedEnemyMarkup} from '../ui/selected-enemy.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url)),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const all=loadCurrentDatasets(),prior=loadCurrentDatasets({revision:'fr007r3'}),images=referencePortraitImageMap({base:'/fixture/'});
test('current FR008 preserves every numeric profile, recipe and enemy definition; only Baby Dragon targeting is amended',()=>{
 const withoutNarrative=value=>JSON.parse(JSON.stringify(value,(key,v)=>['text','description'].includes(key)?undefined:v));
 for(const id of Object.keys(all)){
  assert.equal(all[id].fr008,true);assert.equal(all[id].rulesetRevision,'fr008-r1-20261106');
  for(const key of ['towers','recipes','enemies','waves']){
   const expected=structuredClone(prior[id][key]);
   if(id==='grove'&&key==='towers'){const baby=expected.el_baby_fire_dragon;baby.groundOnly=false;baby.continuousAttack.targeting='ground-and-air';baby.abilities.find(a=>a.familyId==='flame-cone').targeting='ground-and-air';}
   assert.deepEqual(withoutNarrative(all[id][key]),withoutNarrative(expected),`${id} ${key}`);
  }
 }
});
test('FR008 wave 38 preserves explicit portrait identity through configured, live, preview, current and selected views',()=>{
 const d=all.forge,g=new Game(d,{seed:42});g.round=38;g.phase='combat';g.combat.spawnQueue=[];
 const definition=d.enemies.host_38,variants=definition.variants.map(variant=>configuredWarbandInfo({...definition,type:'host_38'},{variant}));
 assert.equal(variants[1].visualAsset,'host_38-wraith');
 const spawned=definition.variants.map(variant=>g.combat.spawn('host_38',{variant}));
 assert.equal(currentWarbandInfo(g).find(v=>v.visualAsset==='host_38-wraith').name,'Blood-Leech Trolls');
 const troll=enemyPortraitImage(images,variants[1]),knife=enemyPortraitImage(images,variants[0]);assert.ok(troll&&knife);assert.notEqual(troll,knife);
 const paired=enemyGroupPortraits({type:'host_38',variants},images);for(const name of ['Black Marsh Knifemen','Blood-Leech Trolls'])assert.ok(paired.includes(name));for(const src of [troll,knife])assert.ok(paired.includes(src));
 const atlas=warbandCardsMarkup([d.waves[37]],d.enemies,images,{atlas:true,startWave:38,balance:d.balance});
 const preview=wavePreviewMarkup({next:new WaveThreatAnalyzer(d).analyze(37)},d,images);
 for(const html of [atlas,preview,currentWavePanelMarkup(g,{images}),currentWaveSummaryMarkup(g,d,images)])for(const src of [troll,knife])assert.ok(html.includes(src),`Missing ${src}`);
 for(const [index,e]of spawned.entries()){const html=selectedEnemyMarkup(e,{data:d,combat:g.combat,images});assert.ok(html.includes(index?troll:knife));assert.ok(!html.includes(index?knife:troll));}
 assert.equal(enemyPortraitImage(images,{type:'host_38',visualAsset:'unknown-explicit-variant'}),null);
 assert.equal(enemyGroupPortraits({type:'host_38',visualAsset:'unknown-explicit-variant'},images),'');
});
test('FR008 recovered portrait keeps source identity, exact RGB pixels, transparency and the exact approved model',()=>{
 const m=json('public/assets/ui/reference-enemy-fronts/blood-leech-reference.json'),source=read(m.source),output=read(m.output);
 assert.equal(sha(source),m.sourceSha256);assert.equal(sha(read(m.parentSheet)),m.parentSheetSha256);assert.equal(sha(output),m.sha256);assert.equal(sha(read(m.sourceModel)),m.sourceModelSha256);
 const a=decodePng(source),b=decodePng(output),[x,y]=m.sourceRectangle,[left,top,right,bottom]=m.trimRectangle;assert.deepEqual([b.width,b.height],[right-left,bottom-top]);assert.equal(b.channels,4);
 let transparent=0,opaque=0;
 for(let j=0;j<b.height;j++)for(let i=0;i<b.width;i++){const p=(j*b.width+i)*4,q=((y+top+j)*a.width+x+left+i)*a.channels;assert.deepEqual(b.pixels.subarray(p,p+3),a.pixels.subarray(q,q+3));if(b.pixels[p+3]===0)transparent++;if(b.pixels[p+3]===255)opaque++;}
 assert.ok(transparent>20000&&opaque>50000);for(const p of [0,b.width-1,(b.height-1)*b.width,b.width*b.height-1])assert.equal(b.pixels[p*4+3],0);
 assert.equal(m.modelRenderFallbackUsed,false);assert.equal(m.resampled,false);
});
test('FR008 actual scheduled wave-38 weapons apply HP damage in all 628 cases without changing regeneration',async()=>{
 await import('../tools/verify-fr008-wave38.mjs');
 const r=json('output/implementation/fr008-current/wave38/results.json');assert.equal(r.summary.actualDamageChecks,628);assert.equal(r.summary.regenerationPerSecond,7842.25);
 for(const row of [...r.allProfiles,...r.knifemanSamples,...r.dwarfWithRuneMage])assert.ok(row.effectiveDamage>0);
 const baseline=json('output/design/fr008-current/wave38/results.json');
 for(const key of ['allProfiles','knifemanSamples','dwarfWithRuneMage','auraSamples','healingSamples']){
  const actual=structuredClone(r[key]);
  for(const row of actual)if(row.faction==='grove'&&row.family==='el_baby_fire_dragon'&&row.stats){assert.equal(row.stats.groundOnly,false);row.stats.groundOnly=true;}
  assert.deepEqual(actual,baseline[key],`${key}: the authorized Baby targeting metadata cannot change ground-wave damage or healing`);
 }
});

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

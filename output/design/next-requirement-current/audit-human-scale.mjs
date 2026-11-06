import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from '../../../tests/helpers/native-gltf.mjs';
import {championClassification} from '../../../game/render/champion-classification.js';
import {defenderClassificationMultiplier,defenderPresentationMultiplier} from '../../../game/render/defender-classification-scale.js';
import {BATTLEFIELD_UNIT_SCALE} from '../../../game/render/battlefield-scale.js';
import {loadCurrentDatasets} from '../../../tools/current-datasets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),out=path.dirname(fileURLToPath(import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f))),hash=b=>createHash('sha256').update(b).digest('hex');
const registry=read('data/factions-v060.json'),entries=registry.factions.find(f=>f.id==='crown').assets,data=loadCurrentDatasets().crown;
const manifest=read('public/assets/factions/v060/manifest.json'),manifestMap=new Map(manifest.assets.filter(a=>a.factionId==='crown').map(a=>[`${a.unitId}/${a.rank}`,a]));
// Bounding-body proxy includes garments/headwear, but excludes held weapons,
// shields, standalone magic and appendages. Full bounds are reported separately.
const excluded=/weapon|sword|greatsword|blade|spear|staff|crozier|bow\b|arrow|shield|brazier|crystal|orb\b|vfx|flame|fireball|halo|wing/i;
function size(b){return b.isEmpty()?null:b.getSize(new THREE.Vector3()).toArray();}
const rows=[];
for(const a of entries){
 const source=manifestMap.get(`${a.family}/${a.tier}`),packed=fs.readFileSync(path.join(root,'public',a.packedFile)),bytes=gunzipSync(packed);
 if(hash(bytes)!==source.sha256||hash(packed)!==source.packedSha256)throw Error('Source drift '+a.family);
 const g=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const mixer=new THREE.AnimationMixer(g.scene),idle=g.animations.find(c=>c.name==='Idle');if(idle){mixer.clipAction(idle).play();mixer.setTime(0);}g.scene.updateMatrixWorld(true);
 const full=new THREE.Box3(),body=new THREE.Box3(),excludedParts=[],includedParts=[],geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
 g.scene.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])if(m){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}if(n.isSkinnedMesh){n.skeleton.update();skeletons.add(n.skeleton);}if(!n.isMesh)return;let visible=true;for(let p=n;p;p=p.parent)visible&&=p.visible;if(!visible)return;const box=new THREE.Box3().setFromObject(n,true);full.union(box);const name=n.userData.sourcePartName||n.name;if(excluded.test(name))excludedParts.push(name);else {body.union(box);includedParts.push(name);}});
 const cf=defenderClassificationMultiplier(a.family),pf=defenderPresentationMultiplier(a.family,'crown'),factor=cf*pf*BATTLEFIELD_UNIT_SCALE;
 const nativeFull=size(full),nativeBody=size(body),scale=s=>s?.map(v=>v*factor);
 rows.push({id:`crown/${a.family}/${a.tier}`,family:a.family,rank:a.tier,name:data.towers[a.family].name,classification:championClassification(a.family)||'Draft basic',classFactor:cf,presentationFactor:pf,battlefieldFactor:BATTLEFIELD_UNIT_SCALE,totalFactor:factor,nativeFullSize:nativeFull,nativeBodySize:nativeBody,battlefieldFullSize:scale(nativeFull),battlefieldBodySize:scale(nativeBody),bodyParts:includedParts.length,excludedParts:excludedParts.length,excludedNames:excludedParts,sourceGlbSha256:source.sha256});
 mixer.stopAllAction();mixer.uncacheRoot(g.scene);for(const x of geometries)x.dispose();for(const x of materials)x.dispose();for(const x of textures)x.dispose();for(const x of skeletons)x.dispose();global.gc?.();
}
const classes=['Draft basic','Basic','Intermediate','Advanced','TOP','Secret'];
const summaries=classes.map(classification=>{const group=rows.filter(r=>r.classification===classification),vals=group.map(r=>r.battlefieldBodySize[1]).sort((a,b)=>a-b),full=group.map(r=>r.battlefieldFullSize[1]);return {classification,count:group.length,minBodyHeight:vals[0],medianBodyHeight:vals.length%2?vals[Math.floor(vals.length/2)]:(vals[vals.length/2-1]+vals[vals.length/2])/2,maxBodyHeight:vals.at(-1),minFullHeight:Math.min(...full),maxFullHeight:Math.max(...full),smallest:group.toSorted((a,b)=>a.battlefieldBodySize[1]-b.battlefieldBodySize[1]).slice(0,3).map(r=>({name:r.name,family:r.family,rank:r.rank,bodyHeight:r.battlefieldBodySize[1],fullHeight:r.battlefieldFullSize[1]})),largest:group.toSorted((a,b)=>b.battlefieldBodySize[1]-a.battlefieldBodySize[1]).slice(0,3).map(r=>({name:r.name,family:r.family,rank:r.rank,bodyHeight:r.battlefieldBodySize[1],fullHeight:r.battlefieldFullSize[1]}))};});
const report={status:'measured',date:'2026-11-06',runtimeVersion:'0.6.9',scope:'All 86 exact approved current V3 Human profiles: 48 draft ranks and 38 champion profiles including shared Lady Claire.',method:'Decode exact approved packed GLBs with the native test GLTF loader, sample actual Idle at t=0, measure precise skinned-mesh world bounds, compose current classification × family presentation × 0.704 battlefield factors. Full silhouette and semantic garment/headwear body proxy reported separately.',bodyProxyExcludedPattern:excluded.source,limits:['Garment/headwear body bounds are a semantic proxy, not manually annotated anatomical head height. Full bounds include weapons, magic and wings.','No shaded same-camera contact sheet was generated. Source portrait crops are not evidence of battlefield size.','Read-only analysis; no runtime, model, gallery or approval data was edited.'],currentFactors:{'Draft basic':1,Basic:1,Intermediate:1.1,Advanced:1.21,TOP:1.331,Secret:1.4641},summaries,rows};
fs.writeFileSync(path.join(out,'human-size-audit.json'),JSON.stringify(report,null,2)+'\n');
const columns=['id','name','classification','classFactor','presentationFactor','nativeBodyHeight','battlefieldBodyHeight','nativeFullHeight','battlefieldFullHeight'];
fs.writeFileSync(path.join(out,'human-size-audit.csv'),columns.join(',')+'\n'+rows.map(r=>[r.id,r.name,r.classification,r.classFactor,r.presentationFactor,r.nativeBodySize[1],r.battlefieldBodySize[1],r.nativeFullSize[1],r.battlefieldFullSize[1]].map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
console.log(JSON.stringify({status:report.status,profiles:rows.length,summaries},null,2));

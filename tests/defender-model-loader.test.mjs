import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial,Texture} from 'three';
import {DefenderModelLoader,defenderTemplateKey} from '../game/render/defender-model-loader.js';
import {installDefenderTemplate} from '../game/render/defender-assets.js';
import {geometricEntries} from '../game/render/geometric-assets.js';
import {disposeDecodedGeometricAsset,disposeGeometricResources} from '../game/render/geometric-resources.js';

// Vite accepts JSON imports without attributes. Match that read-only behavior
// to exercise the real Battlefield boundary without constructing WebGL/DOM.
const jsonHooks=registerHooks({load(url,context,nextLoad){
  if(url.startsWith('file:')&&url.endsWith('.json'))return {format:'module',source:`export default JSON.parse(${JSON.stringify(readFileSync(new URL(url),'utf8'))});`,shortCircuit:true};
  return nextLoad(url,context);
}});
const {Battlefield}=await import('../game/render/world.js');jsonHooks.deregister();

const definitions={soldier:{},mage:{},greenheart:{advanced:true}};
const tower=(id=1,family='soldier',tier=1,state='active')=>({id,family,tier,state,x:5+id,z:8});
const entry=(family='soldier',tier=1)=>({kind:'tower',family,tier,file:`${family}-${tier}.glb`});
const emptyAsset=()=>({scene:new Group()});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function trackedAsset(){
  let closes=0;
  const image={close(){closes++;}},texture=new Texture(image),geometry=new BoxGeometry(),material=new MeshBasicMaterial({map:texture});
  const scene=new Group();scene.add(new Mesh(geometry,material));
  const events={geometry:0,material:0,texture:0};
  for(const [name,resource]of Object.entries({geometry,material,texture}))resource.addEventListener('dispose',()=>events[name]++);
  return {gltf:{scene,scenes:[scene]},events,closes:()=>closes};
}

test('only placed active, draft or reserved units produce a key; champions share rank one',()=>{
  for(const state of ['active','draft','reserved'])assert.equal(defenderTemplateKey(tower(1,'soldier',3,state),definitions),'soldier:3');
  assert.equal(defenderTemplateKey(tower(1,'greenheart',6),definitions),'greenheart:1');
  for(const unit of [null,{family:'mage',tier:2,placed:false},{...tower(),state:'ruin'},{...tower(),state:'latent'},{...tower(),id:undefined},{...tower(),x:undefined},tower(1,'unknown'),tower(1,'soldier',NaN)])assert.equal(defenderTemplateKey(unit,definitions),null);
});

test('indexing the real 86-model roster dispatches zero GLBs and does not inspect any draft',()=>{
  const entries=['geometric-defenders.json','geometric-champions.json'].flatMap(name=>geometricEntries(JSON.parse(readFileSync(new URL(`../public/assets/geometric/${name}`,import.meta.url)))));
  let loads=0;
  const loader=new DefenderModelLoader({load:async()=>{loads++;return emptyAsset();},install:()=>true});
  assert.equal(entries.length,86);assert.equal(loader.index(entries),86);assert.equal(loads,0);assert.equal(loader.activeCount,0);assert.equal(loader.requests.size,0);
  loader.dispose();
});

test('a constructor-time placed request waits for manifests then starts exactly once',async()=>{
  const loads=[],installs=[];
  const loader=new DefenderModelLoader({load:async model=>{loads.push(model);return emptyAsset();},install:(model)=>{installs.push(model);return true;}});
  const first=loader.requestTower(tower(),definitions),second=loader.requestTower(tower(2),definitions);
  assert.equal(first,second);assert.equal(loads.length,0);
  const model=entry();loader.index([model]);assert.equal(loads.length,1);assert.equal(await first,true);assert.deepEqual(installs,[model]);loader.dispose();
});

test('missing and invalid manifest entries resolve to procedural fallback without model requests',async()=>{
  let loads=0;
  const loader=new DefenderModelLoader({load:async()=>{loads++;return emptyAsset();},install:()=>true});
  const waiting=loader.requestTower(tower(1,'mage'),definitions);
  assert.equal(loader.index([{...entry(),kind:'enemy'},entry('soldier',NaN),entry('soldier',0),entry()]),1);
  assert.equal(await waiting,false);assert.equal(await loader.requestTower(tower(2,'mage'),definitions),false);assert.equal(loads,0);loader.dispose();
});

test('unplaced and hidden draws never enter the request queue even with valid manifest families',async()=>{
  let loads=0;
  const loader=new DefenderModelLoader({load:async()=>{loads++;return emptyAsset();},install:()=>true});loader.index([entry('mage')]);
  for(const draw of [{family:'mage',tier:1,placed:false}, {...tower(1,'mage'),state:'latent'}, {identity:tower(2,'mage'),origin:'reserve',placed:false}])assert.equal(await loader.requestTower(draw,definitions),false);
  assert.equal(loads,0);assert.equal(loader.requests.size,0);loader.dispose();
});

test('all copies of a successfully installed rank share one completed request',async()=>{
  let loads=0,installs=0;
  const loader=new DefenderModelLoader({load:async()=>{loads++;return emptyAsset();},install:()=>{installs++;return true;}});loader.index([entry()]);
  const first=loader.requestTower(tower(),definitions);assert.equal(await first,true);
  for(let id=2;id<20;id++)assert.equal(loader.requestTower(tower(id),definitions),first);
  assert.equal(loads,1);assert.equal(installs,1);loader.dispose();
});

test('the FIFO request queue limits simultaneous decodes to three',async()=>{
  const started=[],pending=[];let running=0,peak=0;
  const loader=new DefenderModelLoader({concurrency:3,load:model=>{started.push(model.tier);running++;peak=Math.max(peak,running);return new Promise(resolve=>pending.push(()=>{running--;resolve(emptyAsset());}));},install:()=>true});
  loader.index(Array.from({length:8},(_,index)=>entry('soldier',index+1)));
  const requests=Array.from({length:8},(_,index)=>loader.requestTower(tower(index+1,'soldier',index+1),definitions));
  assert.deepEqual(started,[1,2,3]);assert.equal(loader.activeCount,3);
  while(pending.length){pending.shift()();await settle();}
  assert.deepEqual(await Promise.all(requests),Array(8).fill(true));assert.deepEqual(started,[1,2,3,4,5,6,7,8]);assert.equal(peak,3);assert.equal(loader.activeCount,0);loader.dispose();
});

test('rank changes and family changes request their own model while champion upgrades reuse one model',async()=>{
  const loads=[];
  const loader=new DefenderModelLoader({load:async model=>{loads.push(`${model.family}:${model.tier}`);return emptyAsset();},install:()=>true});loader.index([entry(),entry('soldier',2),entry('mage',2),entry('greenheart')]);
  const unit=tower();await loader.requestTower(unit,definitions);unit.tier=2;await loader.requestTower(unit,definitions);unit.family='mage';await loader.requestTower(unit,definitions);unit.family='greenheart';await loader.requestTower(unit,definitions);unit.tier=6;await loader.requestTower(unit,definitions);
  assert.deepEqual(loads,['soldier:1','soldier:2','mage:2','greenheart:1']);loader.dispose();
});

test('two failed attempts emit one original warning and later syncs do not restart downloads',async()=>{
  let loads=0;const error=new Error('GLB unavailable'),warnings=[];
  const loader=new DefenderModelLoader({load:async()=>{loads++;throw error;},install:()=>true,onFailure:(model,failure)=>warnings.push({model,failure})});const model=entry();loader.index([model]);
  assert.equal(await loader.requestTower(tower(),definitions),false);assert.equal(loads,2);assert.deepEqual(warnings,[{model,failure:error}]);
  for(let id=2;id<10;id++)assert.equal(await loader.requestTower(tower(id),definitions),false);assert.equal(loads,2);assert.equal(warnings.length,1);loader.dispose();
});

test('one transient decode failure retries once and successful recovery emits no warning',async()=>{
  let loads=0,installs=0,warnings=0;
  const loader=new DefenderModelLoader({load:async()=>{if(++loads===1)throw new Error('temporary failure');return emptyAsset();},install:()=>{installs++;return true;},onFailure:()=>warnings++});loader.index([entry()]);
  assert.equal(await loader.requestTower(tower(),definitions),true);assert.equal(loads,2);assert.equal(installs,1);assert.equal(warnings,0);loader.dispose();
});

test('configured limits cannot exceed three simultaneous decodes or two attempts',async()=>{
  let loads=0;const loader=new DefenderModelLoader({concurrency:Infinity,maxAttempts:99,load:async()=>{loads++;throw new Error('unavailable');},install:()=>true});loader.index([entry()]);
  assert.equal(loader.concurrency,3);assert.equal(loader.maxAttempts,2);assert.equal(await loader.requestTower(tower(),definitions),false);assert.equal(loads,2);loader.dispose();
});

test('a rejected installation releases decoded GPU resources and bitmap without retry',async()=>{
  const asset=trackedAsset();let loads=0;
  const loader=new DefenderModelLoader({load:async()=>{loads++;return asset.gltf;},install:()=>false});loader.index([entry()]);
  assert.equal(await loader.requestTower(tower(),definitions),false);assert.equal(loads,1);assert.deepEqual(asset.events,{geometry:1,material:1,texture:1});assert.equal(asset.closes(),1);loader.dispose();
});

test('an installation exception releases the first decode before a fresh retry is adopted',async()=>{
  const first=trackedAsset(),second=trackedAsset();let loads=0,installs=0;
  const loader=new DefenderModelLoader({load:async()=>{if(++loads===2)assert.deepEqual(first.events,{geometry:1,material:1,texture:1});return loads===1?first.gltf:second.gltf;},install:()=>{if(++installs===1)throw new Error('adapter failed');return true;}});loader.index([entry()]);
  assert.equal(await loader.requestTower(tower(),definitions),true);assert.equal(loads,2);assert.equal(first.closes(),1);assert.deepEqual(second.events,{geometry:0,material:0,texture:0});disposeDecodedGeometricAsset(second.gltf);loader.dispose();
});

test('disposing before manifests resolves waiting requests and never starts a decode',async()=>{
  let loads=0;
  const loader=new DefenderModelLoader({load:async()=>{loads++;return emptyAsset();},install:()=>true});const request=loader.requestTower(tower(),definitions);
  loader.dispose();assert.equal(await request,false);assert.equal(loader.index([entry()]),0);assert.equal(await loader.requestTower(tower(),definitions),false);assert.equal(loads,0);
});

test('dispose cancels queued work immediately and releases all late decodes without installing',async()=>{
  const pending=[],assets=[];let installs=0,warnings=0;
  const loader=new DefenderModelLoader({concurrency:3,load:()=>{const asset=trackedAsset();assets.push(asset);return new Promise(resolve=>pending.push(()=>resolve(asset.gltf)));},install:()=>{installs++;return true;},onFailure:()=>warnings++});loader.index(Array.from({length:8},(_,index)=>entry('soldier',index+1)));
  const requests=Array.from({length:8},(_,index)=>loader.requestTower(tower(index+1,'soldier',index+1),definitions));assert.equal(assets.length,3);loader.dispose();
  assert.deepEqual(await Promise.all(requests),Array(8).fill(false));assert.equal(loader.queue.length,0);assert.equal(loader.requests.size,0);
  for(const release of pending)release();await settle();assert.equal(assets.length,3);assert.equal(installs,0);assert.equal(warnings,0);assert.equal(loader.activeCount,0);
  for(const asset of assets){assert.deepEqual(asset.events,{geometry:1,material:1,texture:1});assert.equal(asset.closes(),1);}
});

test('the external battlefield disposal guard also rejects late assets and stops queued requests',async()=>{
  let disposed=false,release,loads=0,installs=0;const asset=trackedAsset();
  const loader=new DefenderModelLoader({concurrency:1,isDisposed:()=>disposed,load:()=>{loads++;return new Promise(resolve=>{release=()=>resolve(asset.gltf);});},install:()=>{installs++;return true;}});loader.index([entry(),entry('mage')]);
  const requests=[loader.requestTower(tower(),definitions),loader.requestTower(tower(2,'mage'),definitions)];disposed=true;release();
  assert.deepEqual(await Promise.all(requests),[false,false]);assert.equal(loads,1);assert.equal(installs,0);assert.deepEqual(asset.events,{geometry:1,material:1,texture:1});assert.equal(asset.closes(),1);
});

test('world template returns the procedural placeholder immediately then uses the arriving shared GLB',async()=>{
  let release,loads=0;
  const unit=tower(1,'mage'),field={disposed:false,imported:new Map(),templates:new Map(),models:new Map([[1,{signature:'fallback'}]]),game:{towers:[unit],data:{towers:definitions}},sync(){this.refreshes=(this.refreshes||0)+1;}};
  field.defenderLoader=new DefenderModelLoader({load:()=>{loads++;return new Promise(resolve=>{release=resolve;});},install:(model,asset)=>installDefenderTemplate(field,model,asset.scene),isDisposed:()=>field.disposed});field.defenderLoader.index([entry('mage')]);
  const placeholder=Battlefield.prototype.template.call(field,unit);assert.ok(placeholder.isObject3D);assert.equal(field.imported.size,0);assert.equal(loads,1);
  assert.equal(Battlefield.prototype.template.call(field,unit),placeholder);assert.equal(loads,1);
  const gltf=emptyAsset();release(gltf);assert.equal(await field.defenderLoader.requestTower(unit,definitions),true);assert.equal(field.refreshes,1);assert.equal(field.models.get(1).signature,'');assert.equal(Battlefield.prototype.template.call(field,unit),gltf.scene);assert.equal(loads,1);
  disposeGeometricResources([...field.templates.values(),...field.imported.values()]);field.defenderLoader.dispose();
});

test('world manifest loading indexes only and requests placed units rather than active or hidden draw cards',async()=>{
  const priorFetch=globalThis.fetch,models=[entry(),entry('mage'),entry('greenheart')],requested=[],loads=[];
  const field={disposed:false,game:{towers:[tower(),tower(2,'mage',1,'reserved'),{...tower(3),state:'ruin'}],data:{towers:definitions},activeDraw:0,draft:{draws:[{family:'greenheart',tier:1,placed:false}]}}};
  field.defenderLoader=new DefenderModelLoader({load:async model=>{loads.push(model.family);return emptyAsset();},install:()=>true});
  globalThis.fetch=async url=>{requested.push(String(url));return {ok:true,json:async()=>({entries:String(url).includes('geometric-champions')?[models[2]]:models.slice(0,2)})};};
  try{
    await Battlefield.prototype.loadDefenders.call(field);await settle();assert.equal(requested.length,2);assert.equal(field.defenderLoader.entries.size,3);assert.deepEqual(loads,['soldier','mage']);assert.equal(field.defenderLoader.requests.has('greenheart:1'),false);
  }finally{globalThis.fetch=priorFetch;field.defenderLoader.dispose();}
});

test('one unavailable roster preserves its warning while the other roster still loads needed placed units',async()=>{
  const priorFetch=globalThis.fetch,priorWarn=console.warn,loads=[],warnings=[],failure=new Error('champion manifest offline');
  const field={disposed:false,game:{towers:[tower()],data:{towers:definitions}}};field.defenderLoader=new DefenderModelLoader({load:async model=>{loads.push(model.family);return emptyAsset();},install:()=>true});
  globalThis.fetch=async url=>{if(String(url).includes('geometric-champions'))throw failure;return {ok:true,json:async()=>({entries:[entry()]})};};console.warn=(...args)=>warnings.push(args);
  try{await Battlefield.prototype.loadDefenders.call(field);await settle();assert.deepEqual(loads,['soldier']);assert.deepEqual(warnings,[['Geometric roster unavailable.',failure]]);}
  finally{globalThis.fetch=priorFetch;console.warn=priorWarn;field.defenderLoader.dispose();}
});

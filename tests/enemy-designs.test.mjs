import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {enemyAssetKey} from '../game/render/enemy-assets.js';

const read=file=>JSON.parse(readFileSync(new URL(file,import.meta.url)));
const enemies=read('../data/enemies.json'),waves=read('../data/waves.json'),designs=read('../data/enemy-designs.json');
const manifest=read('../public/assets/enemies/manifest.json');
const cosmeticFields=new Set(['name','appearance','visualAsset','designArchetype','auraStage']);
function gameplay(value){
 if(Array.isArray(value))return value.map(gameplay);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!cosmeticFields.has(key)).map(([key,value])=>[key,gameplay(value)]));
 return value;
}
const fingerprint=value=>createHash('sha256').update(JSON.stringify(gameplay(value))).digest('hex');
const approvedNames=[
 'Skřetí sběrači lebek','Gobliní trnonožci','Ogroví žrouti','Skřetí šrotokutálové','Netopýří zvědové',
 'Trollové mechových zad','Skřetí lovci z močálů','Trollí stínokrevníci','Gobliní prachotanečníci','Mogrok, Rozbíječ bran',
 'Skřetí hákonoši','Gobliní zvonožrouti','Skřetice Rudého klu','Skřetí zrcadloštítníci','Krvaví netopýří honáci',
 'Skřetí popelní kapsáři','Trollí nosiči prokletých totemů','Skřetí němí kati','Skřetí jezdci na krvavých vlcích','Gorvash, Kostěný patriarcha',
 'Trollové Hnilobného kořene','Ogroví železní berani','Skřetí zaklínači střepových duší','Gobliní nýtovaní mutanti','Skřetí jezdci na železných netopýrech',
 'Skřetí požírači kouzel','Přízrační netopýří jezdcové','Gobliní křídlošroti','Prizmatickí netopýří šejdíři','Zaruun, Pán bouřných křídel',
 'Skřetí dvojpečetní inkvizitoři','Trollí pijáci duší','Skřetí přízraky roztrženého světa','Gobliní šibeniční letci','Netopýří stráž Zatmění',
 'Skřetí křivopřísežníci','Skřetí jezdci na trhlinových vlcích','Nožíři Černé bažiny / Trollí krvesajové','Skřetí jezdci na hromových mantách','Vorlak, Dutý král nebes',
 'Skřetí krystalová falanga','Skřetí ohniví netopýří kopiníci','Ogroví strážci vězněných duší','Skřetí popelní popravčí','Létající bubeníci Černé hordy',
 'Ogroví revenanti v prázdné zbroji','Skřetí jezdci Posledního vytí','Netopýří zloději černého ohně','Trollí strážci Hluboké tlamy','Ghorun, Černý čaroděj na Královně wyvern',
];
const variantMap={
 host_31:[['Popelní dvojpečetní inkvizitoři','host_31-ember'],['Přízrační dvojpečetní inkvizitoři','host_31-wraith']],
 host_35:[['Popelní jezdci stráže Zatmění','host_35-ember'],['Přízrační jezdci stráže Zatmění','host_35-wraith']],
 host_36:[['Popelní křivopřísežníci','host_36-ember'],['Přízrační křivopřísežníci','host_36-wraith']],
 host_38:[['Nožíři Černé bažiny','host_38'],['Trollí krvesajové','host_38-wraith']],
 host_50:[['Ghorun Popelavý','host_50'],['Ghorun Zlatokletý','host_50-tyrant'],['Ghorun Bledý požírač','host_50-devourer']],
};

test('Dark Host changes only the five allowed visual fields and preserves every other enemy and wave field recursively',()=>{
 assert.equal(fingerprint(enemies),'e380e30df148e6d6f07d52bfad14ea15ec0cc1a2d35d34c4dddf6da7c950c4ac');
 assert.equal(fingerprint(waves),'1aa5d616e192d31d04c50ad5cf0a5012878f1b89c6ce41055f7dc1badcfcb737');
});

test('all 50 approved warband names, appearances and five aura stages are assigned to the matching waves and native models',()=>{
 assert.equal(designs.revision,'dark-host-v3');assert.equal(designs.designs.length,50);assert.equal(waves.length,50);
 assert.deepEqual(designs.auraStages.map(stage=>[stage.id,stage.waves,stage.color]),[
  [0,[1,10],null],[1,[11,20],'#f3d34a'],[2,[21,30],'#dc3748'],[3,[31,40],'#64239a'],[4,[41,50],'#100c18'],
 ]);
 assert.equal(designs.auraStages[4].edgeColor,'#8550b5');
 for(let index=0;index<50;index++){
  const id=`host_${String(index+1).padStart(2,'0')}`,design=designs.designs[index],enemy=enemies[id],asset=manifest.find(entry=>entry.id===id);
  assert.equal(design.wave,index+1);assert.equal(design.id,id);
  assert.equal(design.name,approvedNames[index]);assert.equal(enemy.name,approvedNames[index]);assert.equal(waves[index].name,approvedNames[index]);
  assert.equal(enemy.appearance,design.appearance);assert.ok(design.appearance.length>40);
  assert.equal(enemy.designArchetype,design.archetype);assert.equal(enemy.visualAsset,id);
  const stage=Math.floor(index/10);assert.equal(design.auraStage,stage);assert.equal(enemy.auraStage,stage);
  assert.ok(asset,`${id} native model exists`);assert.equal(asset.name,approvedNames[index]);assert.equal(asset.archetype,design.archetype);assert.equal(asset.auraStage,stage);
 }
});

test('all approved variants select their own native art while the 59-model roster excludes the retired balloon',()=>{
 assert.deepEqual(Object.keys(designs.variants).sort(),Object.keys(variantMap).sort());
 const expected=new Set(designs.designs.map(design=>design.id)),templates=new Map(manifest.map(asset=>[asset.id,asset]));
 for(const [id,variants]of Object.entries(variantMap)){
  assert.equal(enemies[id].variants.length,variants.length);assert.equal(designs.variants[id].length,variants.length);
  for(const [index,[name,visualAsset]]of variants.entries()){
   const variant=enemies[id].variants[index];assert.equal(variant.name,name);assert.equal(variant.visualAsset,visualAsset);assert.equal(designs.variants[id][index].name,name);
   assert.ok(templates.has(visualAsset),`${name} resolves to a real exported model`);expected.add(visualAsset);
   assert.equal(enemyAssetKey({...enemies[id],...variant,type:id,model:'unchanged-gameplay-model'},templates),visualAsset);
   assert.equal(templates.get(visualAsset).auraStage,enemies[id].auraStage);
  }
 }
 assert.equal(manifest.length,59);assert.deepEqual([...templates.keys()].sort(),[...expected].sort());
 assert.ok(!templates.has('host_05-balloon'));
});

test('the actual Ghorun wing geometry spans three ordinary scouts and one-and-a-half wave-40 bosses without import normalization',async()=>{
 const loader=new GLTFLoader(),resources=new Set();
 async function span(id){
  const asset=manifest.find(entry=>entry.id===id),bytes=readFileSync(new URL(`../public/assets/enemies/${asset.file}`,import.meta.url));
  const scene=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
  scene.traverse(node=>{if(node.isMesh){resources.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])resources.add(material);}});
  assert.equal(asset.nativeScale,1);return new Box3().setFromObject(scene,true).getSize(new Vector3()).x;
 }
 try{
  const scout=await span('host_05'),boss=await span('host_40');
  for(const id of ['host_50','host_50-tyrant','host_50-devourer']){
   const queen=await span(id);assert.ok(Math.abs(queen/scout-3)<.1,`${id} scout ratio: ${queen/scout}`);
   assert.ok(Math.abs(queen/boss-1.5)<.1,`${id} wave-40 ratio: ${queen/boss}`);
  }
 }finally{for(const resource of resources)resource.dispose();}
});

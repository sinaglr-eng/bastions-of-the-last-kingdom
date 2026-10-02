import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Box3,Vector3} from 'three';
import {NativeTestGLTFLoader as GLTFLoader} from './helpers/native-gltf.mjs';
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
 'Orc Skull Scavengers','Goblin Thornstriders','Ogre Gluttons','Orc Scrap Tinkers','Bat Scouts',
 'Mossback Trolls','Marsh Orc Hunters','Shadowblood Trolls','Goblin Dust Dancers','Mogrok, the Gatebreaker',
 'Orc Hookbearers','Goblin Bell Devourers','Red Tusk Orc Huntresses','Orc Mirror Shieldbearers','Blood Bat Riders',
 'Orc Ash Pickpockets','Cursed Totem Trolls','Silent Orc Executioners','Bloodwolf Orc Riders','Gorvash, the Bone Patriarch',
 'Rotroot Trolls','Iron Ram Ogres','Shard-Soul Orc Warlocks','Riveted Goblin Mutants','Iron Bat Orc Riders',
 'Orc Spell Eaters','Spectral Bat Riders','Goblin Scrapwings','Prismatic Bat Tricksters','Zaruun, Lord of Storm Wings',
 'Orc Dual-Seal Inquisitors','Soul-Drinker Trolls','Orc Wraiths of the Shattered World','Goblin Gallows Fliers','Eclipse Bat Guard',
 'Orc Oathbreakers','Riftwolf Orc Riders','Black Marsh Knifemen / Blood-Leech Trolls','Thunder Manta Orc Riders','Vorlak, the Hollow Sky King',
 'Orc Crystal Phalanx','Fire Bat Orc Lancers','Ogres of the Imprisoned Souls','Orc Ash Executioners','Flying Drummers of the Black Horde',
 'Ogre Revenants in Hollow Armor','Orc Riders of the Last Howl','Bat Thieves of Black Fire','Troll Guardians of the Deep Maw','Morvath, the Dread Sovereign',
];
const variantMap={
 host_31:[['Ashen Dual-Seal Inquisitors','host_31-ember'],['Spectral Dual-Seal Inquisitors','host_31-wraith']],
 host_35:[['Ashen Eclipse Bat Riders','host_35-ember'],['Spectral Eclipse Bat Riders','host_35-wraith']],
 host_36:[['Ashen Oathbreakers','host_36-ember'],['Spectral Oathbreakers','host_36-wraith']],
 host_38:[['Black Marsh Knifemen','host_38'],['Blood-Leech Trolls','host_38-wraith']],
 host_50:[['Morvath the Ashen','host_50'],['Morvath the Gold-Cursed','host_50-tyrant'],['Morvath the Bone-Crowned','host_50-devourer']],
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

test('Morvath keeps a visibly larger native wing span than scouts and wave-40 bosses, with actual export bounds recorded without import normalization',async()=>{
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
   const queen=await span(id),asset=manifest.find(entry=>entry.id===id);
   assert.ok(queen/scout>2.5&&queen/scout<3.2,`${id} scout ratio: ${queen/scout}`);
   assert.ok(queen/boss>1.25&&queen/boss<1.65,`${id} wave-40 ratio: ${queen/boss}`);
   assert.ok(Math.abs(queen-asset.bounds.size[0])<.003,`${id} actual span differs from native geometry metadata`);
  }
 }finally{for(const resource of resources)resource.dispose();}
});

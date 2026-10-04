import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {enemyAssetKey} from '../game/render/enemy-assets.js';
import {applyEnemyDesigns} from '../tools/enemy-designs.mjs';

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
 'Ogre Revenants in Hollow Armor','Orc Riders of the Last Howl','Bat Thieves of Black Fire','Troll Guardians of the Deep Maw','Ghorun, the Black Sorcerer on the Wyvern Queen',
];
const variantMap={
 host_31:[['Ashen Dual-Seal Inquisitors','host_31-ember'],['Spectral Dual-Seal Inquisitors','host_31-wraith']],
 host_35:[['Ashen Eclipse Bat Riders','host_35-ember'],['Spectral Eclipse Bat Riders','host_35-wraith']],
 host_36:[['Ashen Oathbreakers','host_36-ember'],['Spectral Oathbreakers','host_36-wraith']],
 host_38:[['Black Marsh Knifemen','host_38'],['Blood-Leech Trolls','host_38-wraith']],
 host_50:[['Ghorun the Ashen','host_50'],['Ghorun the Gold-Cursed','host_50-tyrant'],['Ghorun the Pale Devourer','host_50-devourer']],
};

test('only the approved balance, variant and matching description changes differ from the original Dark Host gameplay fingerprint',()=>{
 const historical=structuredClone(enemies);
 const approvedBalanceChanges=[
  [['troll','regen'],5,.05],
  [['host_02','hp'],61,52],
  [['host_03','hp'],80,68],
  [['host_08','regen'],1.024,.05],
  [['host_15','regen'],3.9,.05],
  [['host_21','regen'],10.732000000000001,.05],
  [['host_38','variants',1,'regen'],125.476,.05],
  [['host_16','thief'],13,50],
  [['host_34','thief'],19,50],
  [['host_48','thief'],24,50],
  [['host_19','rush'],1.7,5],
  [['host_42','rush'],1.7,5],
  [['host_47','rush'],1.7,5],
  [['host_24','reactiveArmor'],3,8],
  [['host_28','reactiveArmor'],3,8],
 ];
 for(const [path,before,after]of approvedBalanceChanges){
  const parent=path.slice(0,-1).reduce((value,key)=>value[key],historical),key=path.at(-1);
  assert.equal(parent[key],after,path.join('.')+' approved current value');parent[key]=before;
 }
 const moon=historical.host_28.variants[1];assert.equal(moon.reactiveArmor,0);assert.equal(moon.stealth,true);assert.deepEqual(moon.traits,['stealth']);
 for(const key of ['reactiveArmor','stealth','traits'])delete moon[key];
 assert.equal(Object.hasOwn(historical.host_30,'variants'),false,'Zaruun has no alternate active wave variant');
 historical.host_30.variants=[{name:'Zaruun, Lord of Storm Wings',visualAsset:'host_30'},{name:'Zaruun, Lord of Storm Wings · Moon Clan',color:'#667e91',model:'dragon',visualAsset:'host_30'}];
 // Descriptions of the specifically changed mixed squads also change. Restore
 // only these exact historical fields for the original recursive fingerprint.
 const descriptions={
  host_28:['Reactive armor','Direct hits build temporary armor.'],
  host_31:['Alternating immunity · Mirror shields','This wave rolls either magic or physical immunity. Shields absorb three direct hits; poison ticks and burning auras bypass them. Ritual wards resist magic; physical and pure attacks remain effective.'],
  host_35:['Alternating immunity','This wave rolls either magic or physical immunity.'],
  host_36:['Alternating immunity','This wave rolls either magic or physical immunity. Plated armor reduces physical damage; break armor or add magic.'],
  host_38:['Cloak & daggers','Cycles between cloak and short close-range disarms.'],
 };
 for(const [id,[threat,counter]]of Object.entries(descriptions)){historical[id].threat=threat;historical[id].counter=counter;}
 assert.equal(fingerprint(historical),'e380e30df148e6d6f07d52bfad14ea15ec0cc1a2d35d34c4dddf6da7c950c4ac','every other gameplay field stays byte-for-byte in the original recursive projection');
 assert.equal(fingerprint(waves),'1aa5d616e192d31d04c50ad5cf0a5012878f1b89c6ce41055f7dc1badcfcb737');
});

test('actual Dark Host authoring changes only the five visual fields and preserves the current balance and wave rules recursively',()=>{
 const subjects=structuredClone(enemies),stages=structuredClone(waves),before={enemies:gameplay(subjects),waves:gameplay(stages)};
 // Exercise real reassignment, rather than an already identical authoring pass.
 for(const [id,enemy]of Object.entries(subjects))if(id.startsWith('host_')){
  for(const key of cosmeticFields)enemy[key]='unassigned';
  for(const variant of enemy.variants||[])for(const key of cosmeticFields)variant[key]='unassigned';
 }
 for(const stage of stages)stage.name='unassigned';
 applyEnemyDesigns(subjects,stages);
 assert.deepEqual({enemies:gameplay(subjects),waves:gameplay(stages)},before);
 for(const design of designs.designs){assert.equal(subjects[design.id].name,design.name);assert.equal(subjects[design.id].visualAsset,design.id);}
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

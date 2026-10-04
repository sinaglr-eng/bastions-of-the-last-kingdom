import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {rankColor,rankAdornment,animateRank} from './render/ranks.js';
import {championClassification,championAuraLevel} from './render/champion-classification.js';
import {createChampionAura,animateChampionAura,disposeChampionAura} from './render/champion-aura.js';
import {animateSecretChampion} from './render/secret-champions.js';
import {animateGeometricOrbits} from './render/geometric-orbits.js';
import {cloneDefenderTemplate,disposeDefenderInstance} from './render/defender-assets.js';
import {attackRig,attackMuzzle,disposeAttack,previewGeometricAttack,updateGeometricPreview,resetAttack} from './render/battle-animation.js';
import {towerStats} from './core/math.js';
import balance from '../data/balance.json';
import {previewSecretAttack,updateSecretPreview,resetSecretAnimation} from './render/secret-animation.js';
import {CombatEffects} from './render/combat-effects.js';
import {castleWallModel,wallConnections,WALL_DECK_HEIGHT} from './render/walls.js';
import historicalTowers from '../data/towers.json';
import historicalEnemies from '../data/enemies.json';
import historicalWaves from '../data/waves.json';
import originalSources from '../public/assets/geometric/source-manifest.json';
import basicManifest from '../public/assets/geometric/geometric-defenders.json';
import {geometricEntries} from './render/geometric-assets.js';
import {basicFamilyFrame} from './render/atelier-framing.js';
import {campaignTowers,campaignEnemies,campaignWaves} from './core/campaign-roster.js';
import {atelierEnemyRoster,atelierSelection,atelierSelectionQuery,atelierEnemyProperties} from './core/atelier-roster.js';
import {createAtelierEnemyPreview,updateAtelierEnemyPreview,disposeAtelierEnemyPreview} from './render/atelier-enemy-preview.js';
import {disposeDecodedGeometricAsset} from './render/geometric-resources.js';
import {geometricModelPath} from './render/geometric-assets.js';
import {optimizeGeometricSiblings} from './render/geometric-batching.js';
import '../ui/atelier.css';
import {siteUrl} from './site-url.js';
import {defenderCode} from './core/unit-label.js';
import {releaseAsset,defenderPortrait,enemyPortrait,GAME_VERSION} from './release.js';

const towers=campaignTowers(historicalTowers);
const basicFrames=geometricEntries(basicManifest);
const enemyRows=atelierEnemyRoster(campaignEnemies(historicalEnemies),campaignWaves(historicalWaves));
const enemies=Object.fromEntries(enemyRows.map(row=>[row.id,row]));
const initial=atelierSelection(location.search,towers,enemies);
let roster=initial.roster,family=initial.id;
const isEnemy=()=>roster==='enemies',members=()=>isEnemy()?enemies:towers;
const lastSelection={defenders:roster==='defenders'?family:'archer',enemies:roster==='enemies'?family:enemyRows[0].id};
const roman=['I','II','III','IV','V','VI'],colors=['Modrá','Zelená','Fialová','Bílá','Zlatá','Záře'];
const rankEquipment={
 soldier:['Bez zbroje, s dřevěným kopím.','Přilba a meč.','Navíc dřevěný štít.','Navíc ocelový prsní plát.','Plná zbroj a železný štít.','Uzavřená rytířská přilba a delší plášť.'],
 archer:['Prostý krátký luk a kapuce.','Ramenní plášť a toulec.','Kožená vesta a zahnutý luk.','Dlouhý luk a delší plášť.','Ramenní ochrana a vrstvený luk.','Mistrovský luk a zpevněná vesta.'],
 druid:['Dřevěná hůl s jedním listem.','Listový ramenní plášť.','Jednoduché paroží.','Delší plášť a rozvětvená hůl.','Dřevěné nátepníky a zelený kámen.','Širší listový límec a mistrovská hůl.'],
 mage:['Malá špičatá čepice a jednoduchá hůl.','Široký kouzelnický klobouk.','Ramenní plášť a větší krystal.','Navíc zavřená kniha kouzel.','Delší plášť a vidlicová hlavice hole.','Otevřená kniha a mistrovský krystal.'],
 cleric:['Prostá kapuce a hůl s latinským křížem.','Mitra, světlá štóla a kříž.','Fialová mitra se zlatou obrubou.','Navíc plášť a zavřená kniha.','Zlatá mitra a delší plášť.','Zlatý kříž a otevřená kniha.'],
 runebreaker:['Dřevěné kladivo a pravítko.','Kožená zástěra a železné kladivo.','Pracovní brýle a nátepník.','Delší zástěra a tesařské kladivo.','Kovové chrániče a zesílená zástěra.','Mistrovské kladivo a ochranný plát.'],
 frostwarden:['Kapuce a malý ledový krystal.','Široký zimní límec.','Navíc malý ledový štít.','Kovové nátepníky a větší krystal.','Velký ledový štít a těžší plášť.','Ramenní ochrana a mistrovský krystal.'],
 stormcaller:['Prostá tunika, přirozené vlasy a malá blesková koruna.','Krátký plášť a trojramenná blesková koruna.','Sesílací nátepník, větší blesk a vyšší trojramenná koruna s krystalem.','Dlouhý plášť, druhý nátepník a pětiramenná koruna s bočními blesky.','Vyšší zlatá blesková koruna a větvený držený blesk.','Ramenní ochrana, mistrovská rukavice a sedmiramenná zlatá koruna.'],
};
const portrait=(id,tier=1)=>enemies[id]?enemyPortrait(id):defenderPortrait(id,tier);
const asset=(id,rank)=>releaseAsset(isEnemy()?`assets/geometric/enemies/${id}.glb`:geometricModelPath(id,rank,towers[id].advanced));
const basicCount=Object.values(towers).filter(t=>!t.advanced).length,championCount=Object.values(towers).filter(t=>t.advanced).length;
const variantCount=basicCount*6+championCount;
document.querySelector('#atelier').innerHTML=`
<header class="atelier-header"><a class="atelier-brand" href="${siteUrl('?update=cohesive')}" target="_blank" rel="noopener">♜ <span>BASTIONS<small>THE ROYAL ATELIER</small></span></a><div class="edition">THE ARMIES <b>${String(basicCount).padStart(2,'0')} CLASSES / ${championCount} CHAMPIONS / ${enemyRows.length} ENEMIES</b></div><a class="outline-link" href="${siteUrl('?update=cohesive')}" target="_blank" rel="noopener">Otevřít hru ↗</a></header>
<section class="model-stage" aria-label="Interaktivní 3D náhled postav"><div class="stage-heading"><span class="eyebrow">BLENDER 5.2 · GEOMETRIC EDITION ${GAME_VERSION}</span><h1 id="family-title">Archer.</h1><p id="family-subtitle">Obránci a nepřátelé.</p></div><div id="model-canvas"></div><div class="stage-caption"><span id="load-status" role="status">Načítám model z Blenderu…</span><small>Tažením otáčej · Kolečkem přibližuj</small></div><div class="view-controls"><button id="rotate" aria-pressed="false">↻ Automatická rotace</button><button id="reset">Obnovit pohled</button><button id="walls" aria-pressed="false">Kamenné hradby</button><button id="atelier-effects" aria-pressed="true">Aury a efekty</button></div></section>
<aside class="atelier-notes"><div class="roster-switch" role="group" aria-label="Zobrazovaná armáda"><button data-roster="defenders" aria-pressed="false">Obránci</button><button data-roster="enemies" aria-pressed="false">Nepřátelé</button></div><label class="eyebrow" id="family-picker-label" for="family-picker">VYBER POSTAVU</label><select id="family-picker"></select><h2 id="family-name">Archer</h2><p id="family-role"></p><div class="note-rule"></div><div class="rank-heading"><h3 id="rank-heading">Šest úrovní. Šest signálů.</h3><span id="rank-instruction">VYBER ÚROVEŇ</span></div><div class="rank-picker"></div><div class="design-detail"><span id="selected-rank"></span><p id="rank-detail"></p></div><div class="note-rule"></div><div class="materials"></div><p class="approval-note"></p><div class="asset-links"><a id="download-model" download>Stáhnout GLB ↓</a><a id="download-portrait" target="_blank" rel="noopener">Portrét z Blenderu ↗</a></div><details class="roster-details" open><summary></summary><div class="roster-grid"></div></details></aside>
<footer class="atelier-footer"><span>BLENDER 5.2 · v${GAME_VERSION} <b>${variantCount} VARIANTS</b></span><p>37 × 37 polí · Hradby s cimbuřím · Spirálové cesty kolem středu</p><span>BASTIONS / ASHEN VALE</span></footer>`;

const host=document.querySelector('#model-canvas'),scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.append(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Otáčení 3D modelu postavy');
const camera=new THREE.PerspectiveCamera(33,1,.1,50),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=2.4;controls.maxDistance=14;controls.maxPolarAngle=Math.PI*.49;controls.autoRotateSpeed=.7;
let viewRadius=1,viewCentre=new THREE.Vector3(0,1,0);
function reset(wallView=false){
 document.querySelectorAll('.view-presets button').forEach(button=>button.setAttribute('aria-pressed','false'));
 if(wallView){camera.position.set(-3.5,3.4,-5.4);controls.target.set(0,WALL_DECK_HEIGHT/2,0);}
 else{controls.target.copy(viewCentre);camera.position.copy(viewCentre).add(new THREE.Vector3(-2.5,1.45,-4.5).multiplyScalar(viewRadius));}
 controls.update();
}reset();
scene.add(new THREE.HemisphereLight('#dde9ed','#3c4c43',2.1));
function light(color,intensity,pos){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);return l;}
const key=light('#ffedce',3,[-3,6,-4]);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.015;key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;
light('#8ab6db',2.3,[4,3,-1]);light('#e8c47f',3.5,[0,4,4]);
const ground=new THREE.Mesh(new THREE.CircleGeometry(3.2,80),new THREE.MeshStandardMaterial({color:'#1c2c28',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;ground.receiveShadow=true;scene.add(ground);
for(const radius of [1.2,2.1,3]){const m=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.004,96),new THREE.MeshBasicMaterial({color:'#90a99a',transparent:true,opacity:.14,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.y=-.005;scene.add(m);}
const loader=new GLTFLoader(),cache=new Map();let selected=initial.tier,model=null,modelAura=null,wallsVisible=false,sequence=0,atelierDisposed=false;
let modelAttack=null,enemyPreview=null,effectsVisible=true,previewPaused=false,previewSpeed=1,previewShot=null,previewSerial=0;
const animationControls=document.createElement('span');animationControls.id='native-animation-controls';animationControls.hidden=true;
animationControls.innerHTML='<button id="animation-idle">Klidová animace</button><button id="animation-attack">Přehrát útok</button><button id="animation-pause" aria-pressed="false">Pozastavit</button><label>Rychlost <select id="animation-speed" aria-label="Rychlost animace"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="3">3×</option></select></label>';
document.querySelector('.view-controls').append(animationControls);
const referenceLink=document.createElement('a');referenceLink.id='view-reference';referenceLink.target='_blank';referenceLink.rel='noopener';referenceLink.textContent='Šest pohledů předlohy ↗';document.querySelector('.asset-links').append(referenceLink);
const viewPresets=document.createElement('div');viewPresets.className='view-presets';viewPresets.setAttribute('aria-label','Šest kontrolních pohledů');
viewPresets.innerHTML=[['front','Zepředu',0],['back','Zezadu',180],['left','Levý bok',-90],['right','Pravý bok',90],['three-quarter-front','¾ zepředu',35],['three-quarter-back','¾ zezadu',145]].map(([id,label,angle])=>`<button data-view="${id}" data-angle="${angle}" aria-pressed="false">${label}</button>`).join('');
document.querySelector('.stage-heading').append(viewPresets);
viewPresets.addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(!button)return;if(wallsVisible)toggleWalls();controls.autoRotate=false;document.querySelector('#rotate').setAttribute('aria-pressed','false');const angle=Number(button.dataset.angle)*Math.PI/180;controls.target.copy(viewCentre);camera.position.copy(viewCentre).add(new THREE.Vector3(5*Math.sin(angle),1.06,-5*Math.cos(angle)).multiplyScalar(viewRadius));controls.update();viewPresets.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
const previewTarget={id:-2,x:0,z:-2.5},previewTargetMesh=new THREE.Mesh(new THREE.TorusGeometry(.15,.018,4,24),new THREE.MeshBasicMaterial({color:'#ffe9b5',transparent:true,opacity:.8,depthWrite:false,toneMapped:false}));
previewTargetMesh.name='Atelier spell target';previewTargetMesh.position.set(previewTarget.x,1,previewTarget.z);previewTargetMesh.visible=false;scene.add(previewTargetMesh);
const previewEffects=new CombatEffects(scene,{sourceHeight:1.5,getMuzzle:(_source,out)=>attackMuzzle(modelAttack,out),maxEffects:8,maxProjectiles:2,reducedMotion:()=>!!reducedMotion?.matches});
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
const auraDescriptions=['Velká silná modrá aura se třemi kruhy, jiskrami a vysokými světelnými prameny.','Velká silná zelená aura se třemi kruhy, jiskrami a vysokými světelnými prameny.','Velká silná fialová aura se třemi kruhy, jiskrami a vysokými světelnými prameny.','Velká silná zlatá aura se třemi kruhy, jiskrami a vysokými světelnými prameny.','Tajný šampion s výraznou zlatou září, vysokými světelnými prameny a jiskrami. Všechny tři přísady musí padnout v jednom kole.'];
const wallGroup=new THREE.Group();wallGroup.visible=false;
const wallTiles=[[-1,-1],[0,-1],[1,-1],[1,0],[1,1]].map(([x,z])=>({x,z,state:'ruin'}));
for(const t of wallTiles){const m=castleWallModel(wallConnections(t,wallTiles));m.position.set(t.x*1,t.y||0,t.z*1);wallGroup.add(m);}scene.add(wallGroup);
function rosterButtons(){
 const enemy=isEnemy(),rows=enemy?enemyRows:Object.entries(towers).map(([id,definition])=>({...definition,id}));
 document.querySelectorAll('[data-roster]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.roster===roster)));
 document.querySelector('#family-picker-label').textContent=enemy?'VYBER NEPŘÍTELE':'VYBER OBRÁNCE';
 document.querySelector('#family-picker').innerHTML=enemy?rows.map(row=>`<option value="${row.id}">${String(row.wave).padStart(2,'0')} · ${row.name}</option>`).join(''):[false,true].map(advanced=>`<optgroup label="${advanced?'Šampioni':'Základní obránci'}">${rows.filter(row=>!!row.advanced===advanced).map(row=>`<option value="${row.id}">${row.name}</option>`).join('')}</optgroup>`).join('');
 document.querySelector('#family-picker').value=family;
 document.querySelector('.roster-details summary').textContent=enemy?`Všech ${rows.length} nepřátel · vlny 1–50`:`Všech ${rows.length} obránců a šampionů`;
 document.querySelector('.roster-grid').innerHTML=rows.map(row=>`<button data-family="${row.id}" aria-label="${enemy?`Vlna ${row.wave}: `:''}${row.name}" aria-pressed="${row.id===family}"><img loading="lazy" src="${portrait(row.id)}" alt=""><span>${enemy?`${row.wave}. `:''}${row.name}</span></button>`).join('');
 document.querySelector('.atelier-footer b').textContent=enemy?`${enemyRows.length} ENEMIES`:`${variantCount} DEFENDERS`;
}
function rankButtons(){
 const definition=members()[family],enemy=isEnemy(),advanced=!enemy&&definition.advanced;
 document.querySelector('#family-title').textContent=definition.name+'.';
 document.querySelector('.stage-heading').classList.toggle('long-title',definition.name.length>35);
 document.querySelector('#family-name').textContent=definition.name;
 document.querySelector('#family-role').textContent=enemy?(definition.appearance||definition.description||definition.role||'Nepřítel království.'):definition.description||definition.role;
 document.querySelector('.materials').innerHTML=enemy?`<span>01 <b>Vlna ${definition.wave} / 50</b></span><span>02 <b>${definition.flying?'Létající':'Pozemní'}</b></span><span>03 <b>${definition.boss?'Boss':'Nepřítel'}</b></span>`:'<span>01 <b>Barvená látka</b></span><span>02 <b>Patinovaná kůže</b></span><span>03 <b>Mosaz a ocel</b></span>';
 document.querySelector('#family-subtitle').textContent=enemy?`Vlna ${definition.wave} · ${definition.flying?'Létající':'Pozemní'} nepřítel${definition.boss?' · Boss':''}.`:advanced?`${championClassification(family)} · Šampion získaný kombinací obránců.`:'Základní obránce · šest úrovní výstroje.';
 document.querySelector('#rank-heading').textContent=enemy?'Prohlédni každou stranu.':advanced?'Jedinečná silueta.':'Šest úrovní. Šest signálů.';
 document.querySelector('#rank-instruction').textContent=enemy?'ŠEST POHLEDŮ · CHŮZE / LET':advanced?championClassification(family).toUpperCase():'VYBER ÚROVEŇ';
 document.querySelector('.approval-note').textContent=enemy?'Použij šest pohledů nad modelem. Tlačítko Chůze / Let přehrává pohyb ze hry; aury a efekty lze vypnout. Adresa stránky uchovává právě vybraného nepřítele.':'Použij šest pohledů nad modelem a přehrání útoku. Aury lze vypnout pro kontrolu vrstev výstroje. Adresa stránky uchovává postavu i úroveň.';
 document.querySelector('.rank-picker').innerHTML=enemy||advanced?'':roman.map((r,i)=>`<button class="rank-choice" data-rank="${i+1}" aria-label="${defenderCode(definition,i+1)}: ${colors[i]}" aria-pressed="false" style="--rank:${rankColor(i+1)}"><span class="rank-number">${defenderCode(definition,i+1)}</span><img src="${portrait(family,i+1)}" alt=""><strong>${colors[i]}</strong></button>`).join('');
 document.querySelector('#animation-idle').textContent=enemy?'Klidová póza':'Klidová animace';
 document.querySelector('#animation-attack').textContent=enemy?(definition.flying?'Přehrát let':'Přehrát chůzi'):'Přehrát útok';
 document.querySelectorAll('[data-family]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.family===family)));
}
function clearShot(){
 previewShot=null;previewEffects.syncProjectiles([]);for(const effect of [...previewEffects.effects])previewEffects.removeEffect(effect);previewTargetMesh.visible=false;
}
function clearModel(){
 if(enemyPreview){disposeAtelierEnemyPreview(enemyPreview);enemyPreview=null;}
 else if(model){disposeAttack(modelAttack);disposeDefenderInstance(model);disposeChampionAura(modelAura);const adornment=model.getObjectByName('Mythic aura')||model.getObjectByName('Rank signal');adornment?.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});model.removeFromParent();}
 model=null;modelAttack=null;modelAura=null;clearShot();
}
function setEffectVisibility(){
 if(modelAura)modelAura.visible=effectsVisible;
 const adornment=model?.getObjectByName('Mythic aura')||model?.getObjectByName('Rank signal');if(adornment)adornment.visible=effectsVisible;
 for(const {object} of [...previewEffects.effects,...previewEffects.projectiles.values()])object.visible=effectsVisible;
 if(enemyPreview)updateAtelierEnemyPreview(enemyPreview,0,{reducedMotion:!!reducedMotion?.matches,showEffects:effectsVisible});
}
async function showRank(rank){
 selected=rank;const request=++sequence,definition=members()[family],enemy=isEnemy(),advanced=!enemy&&definition.advanced,url=asset(family,rank);
 clearModel();animationControls.hidden=true;document.title=`${definition.name}${enemy?` · vlna ${definition.wave}`:advanced?'':` ${roman[rank-1]}`} · Royal Atelier`;
 history.replaceState(null,'',location.pathname+atelierSelectionQuery({roster,id:family,tier:rank}));
 document.querySelectorAll('[data-rank]').forEach(b=>{const active=Number(b.dataset.rank)===rank;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 document.querySelector('#selected-rank').textContent=enemy?`VLNA ${definition.wave} · ${definition.flying?'LET':'CHŮZE'}`:advanced?`${championClassification(family).toUpperCase()} · ŠAMPION`:`${defenderCode(definition,rank)} · ${colors[rank-1].toUpperCase()}`;
 document.querySelector('#rank-detail').textContent=enemy?`${definition.hp} HP · ${definition.armor||0} zbroj · rychlost ${definition.speed}. ${atelierEnemyProperties(definition).join(' · ')||'Bez zvláštních odolností.'}`:advanced?`${family==='archangel'?'Majestátní zlatá a slonovinová zbroj, božský meč a vysoká zlatá světelná aura.':auraDescriptions[championAuraLevel(family)]} Recept najdeš v herním Grimoáru.`:`${rankEquipment[family]?.[rank-1]||''} ${rank===6?'Světle zlatá látka, světelná aura a pomalu obíhající jiskry. Mýtická úroveň získaná sloučením dvou jednotek V.':`${colors[rank-1]} látka a barevná obruba podstavce. Stejnou barvu používá karta jednotky.`}`;
 const requestedAppearance={stormcaller:'Upravený návrh: přirozené vlasy a blesková koruna podle úrovně.',royalranger:'Upravená výstroj: kuše držená zadní rukou u spouště a přední rukou pod pažbou.',mothernature:'Upravená podoba: lesní duch s listovou maskou a zářícíma očima.',thunderheart:'Upravená výstroj: rytíř v ocelové a tmavomodré zbroji odlišné od fialového draka.'};
 if(!enemy&&requestedAppearance[family])document.querySelector('#rank-detail').textContent+=' '+requestedAppearance[family];
 document.querySelector('#download-model').href=url;document.querySelector('#download-portrait').href=portrait(family,rank);
 const sourceId=!enemy&&!advanced?`${family}-${rank}`:family,source=originalSources.find(row=>row.id===sourceId);
 referenceLink.href=siteUrl(`geometric-turnarounds-v1/${source.file}`);
 referenceLink.title='Původní geometrický návrh. Novější výslovné změny výstroje a podoby jsou uvedeny v popisu postavy.';
 document.querySelector('#load-status').textContent='Načítám model z Blenderu…';
 try{
  if(!cache.has(url))cache.set(url,loader.loadAsync(url).then(decoded=>{if(atelierDisposed){disposeDecodedGeometricAsset(decoded);throw new Error('Atelier closed');}decoded.scene.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});optimizeGeometricSiblings(decoded.scene,{animations:decoded.animations});return decoded;}).catch(error=>{cache.delete(url);throw error;}));
  const gltf=await cache.get(url);if(request!==sequence||atelierDisposed)return;
  gltf.scene.animations=gltf.animations;
  if(enemy){enemyPreview=createAtelierEnemyPreview(scene,definition,gltf.scene,{camera,balance});model=enemyPreview.figure;}
  else{model=cloneDefenderTemplate(gltf.scene);modelAttack=attackRig(model,family,definition);}
  model.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  animationControls.hidden=!(enemy||modelAttack?.native||modelAttack?.geometric);previewPaused=false;document.querySelector('#animation-pause').setAttribute('aria-pressed','false');
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),frame=!enemy&&!advanced?basicFamilyFrame(basicFrames,family):null;
  viewCentre=frame?new THREE.Vector3(...frame.centre):bounds.getCenter(new THREE.Vector3());viewRadius=frame?.radius??Math.max(1,size.y/2.2,size.x/2.1,size.z/2.1);
  controls.minDistance=Math.min(2.4,viewRadius*1.5);controls.maxDistance=Math.max(14,viewRadius*12);camera.far=Math.max(50,viewRadius*30);camera.updateProjectionMatrix();
  if(!enemy){if(!advanced)model.add(rankAdornment(rank));modelAura=createChampionAura(family);if(modelAura)model.add(modelAura);}
  model.visible=!wallsVisible;scene.add(model);setEffectVisibility();reset(wallsVisible);status();
 }catch{if(request===sequence&&!atelierDisposed)document.querySelector('#load-status').textContent='Model se nepodařilo načíst. Vyber jinou postavu nebo obnov stránku.';}
}
function status(){const d=members()[family];document.querySelector('#load-status').textContent=wallsVisible?'Hradby · spojené díly a rohové cimbuří':`${d.name} · ${isEnemy()?`Vlna ${d.wave} · ${d.flying?'Let':'Chůze'}`:d.advanced?championClassification(family):`${defenderCode(d,selected)} · ${colors[selected-1]}`} · Blender GLB`;}
function showFamily(id,rank=1){if(!Object.hasOwn(members(),id))return;family=id;lastSelection[roster]=id;document.querySelector('#family-picker').value=id;if(wallsVisible)toggleWalls();rankButtons();showRank(rank);}
function showRoster(id){if(!['defenders','enemies'].includes(id)||id===roster)return;roster=id;family=lastSelection[roster];rosterButtons();showFamily(family);document.querySelector('.atelier-notes').scrollTop=0;}

document.querySelector('#family-picker').addEventListener('change',e=>showFamily(e.target.value));
document.querySelector('.roster-grid').addEventListener('click',e=>{const b=e.target.closest('[data-family]');if(b)showFamily(b.dataset.family);});
document.querySelector('.rank-picker').addEventListener('click',e=>{const b=e.target.closest('[data-rank]');if(b){if(wallsVisible)toggleWalls();showRank(Number(b.dataset.rank));}});
document.querySelector('.roster-switch').addEventListener('click',e=>{const b=e.target.closest('[data-roster]');if(b)showRoster(b.dataset.roster);});
document.querySelector('#rotate').addEventListener('click',e=>{controls.autoRotate=!controls.autoRotate;e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));});
document.querySelector('#reset').addEventListener('click',()=>reset(wallsVisible));
function toggleWalls(){wallsVisible=!wallsVisible;wallGroup.visible=wallsVisible;if(model)model.visible=!wallsVisible;if(enemyPreview)enemyPreview.effects.group.visible=effectsVisible&&!wallsVisible;reset(wallsVisible);document.querySelector('#walls').setAttribute('aria-pressed',String(wallsVisible));status();}
document.querySelector('#walls').addEventListener('click',toggleWalls);
document.querySelector('#atelier-effects').addEventListener('click',e=>{effectsVisible=!effectsVisible;e.currentTarget.setAttribute('aria-pressed',String(effectsVisible));setEffectVisibility();});
document.querySelector('#animation-attack').addEventListener('click',()=>{if(wallsVisible)toggleWalls();previewPaused=false;document.querySelector('#animation-pause').setAttribute('aria-pressed','false');if(enemyPreview){enemyPreview.moving=true;return;}if(modelAttack?.geometric)previewGeometricAttack(modelAttack);else previewSecretAttack(modelAttack?.native);previewTargetMesh.visible=true;});
document.querySelector('#animation-idle').addEventListener('click',()=>{if(enemyPreview){enemyPreview.moving=false;updateAtelierEnemyPreview(enemyPreview,0,{showEffects:effectsVisible});}else resetAttack(modelAttack);clearShot();});
document.querySelector('#animation-pause').addEventListener('click',event=>{previewPaused=!previewPaused;event.currentTarget.setAttribute('aria-pressed',String(previewPaused));});
document.querySelector('#animation-speed').addEventListener('change',event=>previewSpeed=Number(event.target.value));
const resizeObserver=new ResizeObserver(()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();});resizeObserver.observe(host);
rosterButtons();rankButtons();showRank(initial.tier);
let previous=performance.now(),previewClock=0;
function frame(now){
 if(atelierDisposed)return;
 const dt=Math.min(.1,(now-previous)/1000);previous=now;controls.update(dt);
 const animationDt=previewPaused||wallsVisible?0:dt*previewSpeed;previewClock+=animationDt;
 if(enemyPreview)updateAtelierEnemyPreview(enemyPreview,animationDt,{reducedMotion:!!reducedMotion?.matches,showEffects:effectsVisible&&!wallsVisible});
 else if(model){
  animateRank(model,previewClock);
  if(modelAttack?.native||modelAttack?.geometric){
   const updater=modelAttack.geometric?updateGeometricPreview:updateSecretPreview,rig=modelAttack.geometric?modelAttack:modelAttack.native;
   updater(rig,animationDt,{reducedMotion:!!reducedMotion?.matches,onRelease:({elapsedAfterRelease})=>{
    const source={id:-1,family,tier:selected,state:'active',x:0,z:0},stats=towerStats(source,{balance,towers});previewShot={id:++previewSerial,source,target:previewTarget,start:{x:0,z:0},stats,progress:0,releaseFrameDt:elapsedAfterRelease,duration:Math.max(.08,Math.hypot(previewTarget.x,previewTarget.z)/(stats.projectileSpeed||22))};previewEffects.event('shot',previewShot);
   }});
   if(modelAttack.native&&modelAttack.glow){modelAttack.glow.visible=modelAttack.native.stage==='preview';modelAttack.glow.scale.setScalar(.6+Math.sin(modelAttack.native.phase*Math.PI)*1.05);}
  }
  if(modelAttack?.geometric)animateGeometricOrbits(model,previewClock,{reducedMotion:!!reducedMotion?.matches});
  else animateSecretChampion(model,previewClock,{reducedMotion:!!reducedMotion?.matches});
 }
 if(previewShot&&animationDt>0){const shotDt=previewShot.releaseFrameDt??animationDt;delete previewShot.releaseFrameDt;previewShot.progress+=shotDt/previewShot.duration;if(previewShot.progress>=1){previewEffects.event('impact',{source:previewShot.source,target:previewTarget,stats:previewShot.stats,x:previewTarget.x,z:previewTarget.z});previewShot=null;}}
 previewEffects.syncProjectiles(previewShot?[previewShot]:[],previewClock);previewEffects.update(animationDt,previewClock);for(const {object} of [...previewEffects.effects,...previewEffects.projectiles.values()])object.visible=effectsVisible&&!wallsVisible;
 if(!previewShot&&modelAttack?.native?.stage!=='preview'&&modelAttack?.stage!=='preview'&&!previewEffects.effects.length)previewTargetMesh.visible=false;
 animateChampionAura(modelAura,previewClock,{reducedMotion:!!reducedMotion?.matches});renderer.render(scene,camera);requestAnimationFrame(frame);
}
window.addEventListener('pagehide',()=>{atelierDisposed=true;sequence++;resizeObserver.disconnect();clearModel();previewEffects.dispose();controls.dispose();for(const pending of cache.values())pending.then(disposeDecodedGeometricAsset).catch(()=>{});cache.clear();scene.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});renderer.dispose();},{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted&&atelierDisposed)location.reload();});
requestAnimationFrame(frame);

import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {rankColor,rankAdornment,animateRank} from './render/ranks.js';
import {championClassification,championAuraLevel} from './render/champion-classification.js';
import {createChampionAura,animateChampionAura,disposeChampionAura} from './render/champion-aura.js';
import {animateSecretChampion} from './render/secret-champions.js';
import {cloneDefenderTemplate,disposeDefenderInstance} from './render/defender-assets.js';
import {attackRig,attackMuzzle,disposeAttack} from './render/battle-animation.js';
import {previewSecretAttack,updateSecretPreview,resetSecretAnimation} from './render/secret-animation.js';
import {CombatEffects} from './render/combat-effects.js';
import {castleWallModel,wallConnections} from './render/walls.js';
import towers from '../data/towers.json';
import '../ui/atelier.css';
import {siteUrl} from './site-url.js';
import {defenderCode} from './core/unit-label.js';
import {releaseAsset,defenderPortrait,GAME_VERSION} from './release.js';

const roman=['I','II','III','IV','V','VI'],colors=['Modrá','Zelená','Fialová','Bílá','Zlatá','Záře'];
const rankEquipment={
 soldier:['Bez zbroje, s dřevěným kopím.','Přilba a meč.','Navíc dřevěný štít.','Navíc ocelový prsní plát.','Plná zbroj a železný štít.','Uzavřená rytířská přilba a delší plášť.'],
 archer:['Prostý krátký luk a kapuce.','Ramenní plášť a toulec.','Kožená vesta a zahnutý luk.','Dlouhý luk a delší plášť.','Ramenní ochrana a vrstvený luk.','Mistrovský luk a zpevněná vesta.'],
 druid:['Dřevěná hůl s jedním listem.','Listový ramenní plášť.','Jednoduché paroží.','Delší plášť a rozvětvená hůl.','Dřevěné nátepníky a zelený kámen.','Širší listový límec a mistrovská hůl.'],
 mage:['Malá špičatá čepice a jednoduchá hůl.','Široký kouzelnický klobouk.','Ramenní plášť a větší krystal.','Navíc zavřená kniha kouzel.','Delší plášť a vidlicová hlavice hole.','Otevřená kniha a mistrovský krystal.'],
 cleric:['Prostá kapuce a sluneční kotouč.','Mitra a světlá štóla.','Sluneční hůl se čtyřmi paprsky.','Navíc plášť a zavřená kniha.','Vyšší mitra a delší plášť.','Osmipaprsková hůl a otevřená kniha.'],
 runebreaker:['Dřevěné kladivo a pravítko.','Kožená zástěra a železné kladivo.','Pracovní brýle a nátepník.','Delší zástěra a tesařské kladivo.','Kovové chrániče a zesílená zástěra.','Mistrovské kladivo a ochranný plát.'],
 frostwarden:['Kapuce a malý ledový krystal.','Široký zimní límec.','Navíc malý ledový štít.','Kovové nátepníky a větší krystal.','Velký ledový štít a těžší plášť.','Ramenní ochrana a mistrovský krystal.'],
 stormcaller:['Prostá tunika a malý blesk.','Čelenka a krátký plášť.','Sesílací nátepník a větší blesk.','Dlouhý plášť a druhý nátepník.','Širší čelenka a trojramenný blesk.','Ramenní ochrana a mistrovská rukavice.'],
};
const portrait=defenderPortrait;
const asset=(family,rank)=>releaseAsset(`assets/models/${towers[family].advanced?'advanced_'+family:'human_'+family+'_t'+rank}.glb`);
const requestedFamily=new URLSearchParams(location.search).get('family');
let family=towers[requestedFamily]?requestedFamily:'archer';
const basicCount=Object.values(towers).filter(t=>!t.advanced).length,championCount=Object.values(towers).filter(t=>t.advanced).length;
const variantCount=basicCount*6+championCount;
document.querySelector('#atelier').innerHTML=`
<header class="atelier-header"><a class="atelier-brand" href="${siteUrl('?update=cohesive')}" target="_blank" rel="noopener">♜ <span>BASTIONS<small>THE ROYAL ATELIER</small></span></a><div class="edition">THE DEFENDERS <b>${String(basicCount).padStart(2,'0')} CLASSES / ${championCount} CHAMPIONS</b></div><a class="outline-link" href="${siteUrl('?update=cohesive')}" target="_blank" rel="noopener">Otevřít hru ↗</a></header>
<section class="model-stage" aria-label="Interaktivní 3D náhled obránců"><div class="stage-heading"><span class="eyebrow">BLENDER 5.2 · CHAMPION EDITION ${GAME_VERSION}</span><h1 id="family-title">Archer.</h1><p id="family-subtitle">Osm tříd. Jeden společný styl.</p></div><div id="model-canvas"></div><div class="stage-caption"><span id="load-status" role="status">Načítám model z Blenderu…</span><small>Tažením otáčej · Kolečkem přibližuj</small></div><div class="view-controls"><button id="rotate" aria-pressed="false">↻ Automatická rotace</button><button id="reset">Obnovit pohled</button><button id="walls" aria-pressed="false">Kamenné hradby</button></div></section>
<aside class="atelier-notes"><label class="eyebrow" for="family-picker">VYBER OBRÁNCE</label><select id="family-picker">${[false,true].map(advanced=>`<optgroup label="${advanced?'Pokročilí obránci':'Základní třídy · šest úrovní'}">${Object.entries(towers).filter(([,t])=>!!t.advanced===advanced).map(([id,t])=>`<option value="${id}" ${id==='archer'?'selected':''}>${t.name}</option>`).join('')}</optgroup>`).join('')}</select><h2 id="family-name">Archer</h2><p id="family-role"></p><div class="note-rule"></div><div class="rank-heading"><h3 id="rank-heading">Šest úrovní. Šest signálů.</h3><span id="rank-instruction">VYBER ÚROVEŇ</span></div><div class="rank-picker"></div><div class="design-detail"><span id="selected-rank"></span><p id="rank-detail"></p></div><div class="note-rule"></div><div class="materials"><span>01 <b>Barvená látka</b></span><span>02 <b>Patinovaná kůže</b></span><span>03 <b>Mosaz a ocel</b></span></div><p class="approval-note">Základní obránci mají jednoduché lomené tvary společné s Rangerem. S každou úrovní přibývá čitelná výstroj; barva látky a obruba podstavce označují hodnost. Úroveň VI má zlatou záři a obíhající jiskry. Šampioni si zachovávají vlastní postavy, tvory a obléhací stroje.</p><div class="asset-links"><a id="download-model" download>Stáhnout GLB ↓</a><a id="download-portrait" target="_blank">Portrét z Blenderu ↗</a></div><details class="roster-details" open><summary>Celá družina · ${basicCount+championCount} typů</summary><div class="roster-grid">${Object.entries(towers).map(([id,t])=>`<button data-family="${id}" title="${t.name}" aria-label="Zobrazit ${t.name}"><img src="${portrait(id)}" alt="" loading="lazy"><span>${t.name}</span></button>`).join('')}</div></details></aside>
<footer class="atelier-footer"><span>BLENDER 5.2 · v${GAME_VERSION} <b>${variantCount} VARIANTS</b></span><p>37 × 37 polí · Hradby s cimbuřím · Spirálové cesty kolem středu</p><span>BASTIONS / ASHEN VALE</span></footer>`;

const host=document.querySelector('#model-canvas'),scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.append(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Otáčení 3D modelu obránce');
const camera=new THREE.PerspectiveCamera(33,1,.1,50),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=2.4;controls.maxDistance=14;controls.maxPolarAngle=Math.PI*.49;controls.autoRotateSpeed=.7;
let viewRadius=1,viewCentre=new THREE.Vector3(0,1,0);
function reset(wallView=false){
 if(wallView){camera.position.set(-3.5,3.4,-5.4);controls.target.set(0,.3,0);}
 else{controls.target.copy(viewCentre);camera.position.copy(viewCentre).add(new THREE.Vector3(-2.5,1.45,-4.5).multiplyScalar(viewRadius));}
 controls.update();
}reset();
scene.add(new THREE.HemisphereLight('#dde9ed','#3c4c43',2.1));
function light(color,intensity,pos){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);return l;}
const key=light('#ffedce',3,[-3,6,-4]);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.015;key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;
light('#8ab6db',2.3,[4,3,-1]);light('#e8c47f',3.5,[0,4,4]);
const ground=new THREE.Mesh(new THREE.CircleGeometry(3.2,80),new THREE.MeshStandardMaterial({color:'#1c2c28',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;ground.receiveShadow=true;scene.add(ground);
for(const radius of [1.2,2.1,3]){const m=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.004,96),new THREE.MeshBasicMaterial({color:'#90a99a',transparent:true,opacity:.14,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.y=-.005;scene.add(m);}
const loader=new GLTFLoader(),cache=new Map();let selected=1,model=null,modelAura=null,wallsVisible=false,sequence=0;
let modelAttack=null,previewPaused=false,previewSpeed=1,previewShot=null,previewSerial=0;
const animationControls=document.createElement('span');animationControls.id='native-animation-controls';animationControls.hidden=true;
animationControls.innerHTML='<button id="animation-idle">Klidová animace</button><button id="animation-attack">Přehrát útok</button><button id="animation-pause" aria-pressed="false">Pozastavit</button><label>Rychlost <select id="animation-speed" aria-label="Rychlost animace"><option value="0.5">½×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="3">3×</option></select></label>';
document.querySelector('.view-controls').append(animationControls);
const previewTarget={id:-2,x:0,z:-2.5},previewTargetMesh=new THREE.Mesh(new THREE.TorusGeometry(.15,.018,4,24),new THREE.MeshBasicMaterial({color:'#ffe9b5',transparent:true,opacity:.8,depthWrite:false,toneMapped:false}));
previewTargetMesh.name='Atelier spell target';previewTargetMesh.position.set(previewTarget.x,1,previewTarget.z);previewTargetMesh.visible=false;scene.add(previewTargetMesh);
const previewEffects=new CombatEffects(scene,{sourceHeight:1.5,getMuzzle:(_source,out)=>attackMuzzle(modelAttack,out),maxEffects:8,maxProjectiles:2,reducedMotion:()=>!!reducedMotion?.matches});
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
const auraDescriptions=['Velká silná modrá aura se třemi kruhy, jiskrami a vysokými světelnými prameny.','Velká silná zelená aura se třemi kruhy, jiskrami a vysokými světelnými prameny.','Velká silná fialová aura se třemi kruhy, jiskrami a vysokými světelnými prameny.','Velká silná zlatá aura se třemi kruhy, jiskrami a vysokými světelnými prameny.','Tajný šampion s výraznou zlatou září, vysokými světelnými prameny a jiskrami. Všechny tři přísady musí padnout v jednom kole.'];
const wallGroup=new THREE.Group();wallGroup.visible=false;
const wallTiles=[[-1,-1],[0,-1],[1,-1],[1,0],[1,1]].map(([x,z])=>({x,z,state:'ruin'}));
for(const t of wallTiles){const m=castleWallModel(wallConnections(t,wallTiles));m.position.set(t.x*1,t.y||0,t.z*1);wallGroup.add(m);}scene.add(wallGroup);
function rankButtons(){
 const advanced=towers[family].advanced;
 document.querySelector('#family-title').textContent=towers[family].name+'.';
 document.querySelector('#family-name').textContent=towers[family].name;
 document.querySelector('#family-role').textContent=towers[family].description||towers[family].role;
 document.querySelector('.materials').innerHTML='<span>01 <b>Barvená látka</b></span><span>02 <b>Patinovaná kůže</b></span><span>03 <b>Mosaz a ocel</b></span>';
 document.querySelector('#family-subtitle').textContent=advanced?`${championClassification(family)} · Šampion získaný kombinací obránců.`:'Základní obránce · šest úrovní výstroje.';
 document.querySelector('#rank-heading').textContent=advanced?'Jedinečná silueta.':'Šest úrovní. Šest signálů.';
 document.querySelector('#rank-instruction').textContent=advanced?championClassification(family).toUpperCase():'VYBER ÚROVEŇ';
 document.querySelector('.rank-picker').innerHTML=advanced?'':roman.map((r,i)=>`<button class="rank-choice" data-rank="${i+1}" aria-label="${defenderCode(towers[family],i+1)}: ${colors[i]}" aria-pressed="false" style="--rank:${rankColor(i+1)}"><span class="rank-number">${defenderCode(towers[family],i+1)}</span><img src="${portrait(family,i+1)}" alt=""><strong>${colors[i]}</strong></button>`).join('');
 document.querySelectorAll('[data-rank]').forEach(b=>b.addEventListener('click',()=>{if(wallsVisible)toggleWalls();showRank(Number(b.dataset.rank));}));
 document.querySelectorAll('[data-family]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.family===family)));
}
async function showRank(rank){
 selected=rank;const request=++sequence,advanced=towers[family].advanced,url=asset(family,rank);
 animationControls.hidden=true;
 document.querySelectorAll('[data-rank]').forEach(b=>{const active=Number(b.dataset.rank)===rank;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
 document.querySelector('#selected-rank').textContent=advanced?`${championClassification(family).toUpperCase()} · ŠAMPION`:`${defenderCode(towers[family],rank)} · ${colors[rank-1].toUpperCase()}`;
 document.querySelector('#rank-detail').textContent=advanced?`${auraDescriptions[championAuraLevel(family)]} Recept najdeš v herním Grimoáru.`:`${rankEquipment[family]?.[rank-1]||''} ${rank===6?'Světle zlatá látka, světelná aura a pomalu obíhající jiskry. Mýtická úroveň získaná sloučením dvou jednotek V.':`${colors[rank-1]} látka a barevná obruba podstavce. Stejnou barvu používá karta jednotky.`}`;
 document.querySelector('#download-model').href=url;document.querySelector('#download-portrait').href=portrait(family,rank);
 document.querySelector('#load-status').textContent='Načítám model z Blenderu…';
 try{
  if(!cache.has(url))cache.set(url,loader.loadAsync(url));
  const gltf=await cache.get(url);if(request!==sequence)return;
  if(model){disposeAttack(modelAttack);modelAttack=null;disposeDefenderInstance(model);disposeChampionAura(modelAura);modelAura=null;scene.remove(model);const rankGroup=model.getObjectByName('Mythic aura')||model.getObjectByName('Rank signal');rankGroup?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  previewShot=null;previewEffects.syncProjectiles([]);for(const effect of [...previewEffects.effects])previewEffects.removeEffect(effect);previewTargetMesh.visible=false;
  gltf.scene.animations=gltf.animations;model=cloneDefenderTemplate(gltf.scene);model.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  if(towers[family].secret)modelAttack=attackRig(model,family,towers[family]);
  animationControls.hidden=!modelAttack?.native;previewPaused=false;document.querySelector('#animation-pause').setAttribute('aria-pressed','false');
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());viewCentre=bounds.getCenter(new THREE.Vector3());viewRadius=Math.max(1,size.y/2.2,size.x/2.1,size.z/2.1);
  if(!advanced)model.add(rankAdornment(rank));
  modelAura=createChampionAura(family);if(modelAura)model.add(modelAura);
  model.visible=!wallsVisible;scene.add(model);reset(wallsVisible);status();
 }catch{document.querySelector('#load-status').textContent='Model se nepodařilo načíst. Obnov stránku.';}
}
function status(){document.querySelector('#load-status').textContent=wallsVisible?'Hradby · spojené díly a rohové cimbuří':`${towers[family].name} · ${towers[family].advanced?championClassification(family):`${defenderCode(towers[family],selected)} · ${colors[selected-1]}`} · Blender GLB`;}
function showFamily(id){family=id;document.querySelector('#family-picker').value=id;if(wallsVisible)toggleWalls();document.querySelector('#family-picker').value=family;rankButtons();showRank(1);}
document.querySelector('#family-picker').addEventListener('change',e=>showFamily(e.target.value));
document.querySelectorAll('[data-family]').forEach(b=>b.addEventListener('click',()=>showFamily(b.dataset.family)));
document.querySelector('#rotate').addEventListener('click',e=>{controls.autoRotate=!controls.autoRotate;e.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));});
document.querySelector('#reset').addEventListener('click',()=>reset(wallsVisible));
function toggleWalls(){wallsVisible=!wallsVisible;wallGroup.visible=wallsVisible;if(model)model.visible=!wallsVisible;reset(wallsVisible);document.querySelector('#walls').setAttribute('aria-pressed',String(wallsVisible));status();}
document.querySelector('#walls').addEventListener('click',toggleWalls);
document.querySelector('#animation-attack').addEventListener('click',()=>{if(wallsVisible)toggleWalls();previewPaused=false;document.querySelector('#animation-pause').setAttribute('aria-pressed','false');previewSecretAttack(modelAttack?.native);previewTargetMesh.visible=true;});
document.querySelector('#animation-idle').addEventListener('click',()=>{resetSecretAnimation(modelAttack?.native);previewShot=null;previewEffects.syncProjectiles([]);previewTargetMesh.visible=false;});
document.querySelector('#animation-pause').addEventListener('click',event=>{previewPaused=!previewPaused;event.currentTarget.setAttribute('aria-pressed',String(previewPaused));});
document.querySelector('#animation-speed').addEventListener('change',event=>previewSpeed=Number(event.target.value));
new ResizeObserver(()=>{const {width,height}=host.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}).observe(host);
document.querySelector('#family-picker').value=family;rankButtons();showRank(1);
let previous=performance.now(),previewClock=0;
function frame(now){
 const dt=Math.min(.1,(now-previous)/1000);previous=now;controls.update(dt);
 const animationDt=previewPaused||wallsVisible?0:dt*previewSpeed;previewClock+=animationDt;
 if(model){
  animateRank(model,now/1000);
  if(modelAttack?.native){
   updateSecretPreview(modelAttack.native,animationDt,{reducedMotion:!!reducedMotion?.matches,onRelease:({elapsedAfterRelease})=>{
    const source={id:-1,family,x:0,z:0},stats=towers[family];previewShot={id:++previewSerial,source,target:previewTarget,start:{x:0,z:0},stats,progress:0,releaseFrameDt:elapsedAfterRelease,duration:Math.max(.08,Math.hypot(previewTarget.x,previewTarget.z)/stats.projectileSpeed)};previewEffects.event('shot',previewShot);
   }});
   if(modelAttack.glow){modelAttack.glow.visible=modelAttack.native.stage==='preview';modelAttack.glow.scale.setScalar(.6+Math.sin(modelAttack.native.phase*Math.PI)*1.05);}
  }
  animateSecretChampion(model,previewClock,{reducedMotion:!!reducedMotion?.matches});
 }
 if(previewShot&&animationDt>0){const shotDt=previewShot.releaseFrameDt??animationDt;delete previewShot.releaseFrameDt;previewShot.progress+=shotDt/previewShot.duration;if(previewShot.progress>=1){previewEffects.event('impact',{source:previewShot.source,target:previewTarget,stats:previewShot.stats,x:previewTarget.x,z:previewTarget.z});previewShot=null;}}
 previewEffects.syncProjectiles(previewShot?[previewShot]:[],previewClock);previewEffects.update(animationDt,previewClock);
 if(!previewShot&&modelAttack?.native?.stage!=='preview'&&!previewEffects.effects.length)previewTargetMesh.visible=false;
 animateChampionAura(modelAura,previewClock,{reducedMotion:!!reducedMotion?.matches});renderer.render(scene,camera);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

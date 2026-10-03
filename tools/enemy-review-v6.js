import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {enemyFigure,disposeEnemyFigure,animateEnemyCues} from '../game/render/enemy-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {geometricMetadata,createGeometricMotionRig,resetGeometricMotion,animateGeometricEnemyMotion,beginGroundedDeath,animateGroundedDeath} from '../game/render/geometric-motion.js';
import {EnemyAbilityEffects} from '../game/render/geometric-enemy-effects.js';
import {createEnemyAura,animateEnemyAura} from '../game/render/enemy-aura.js';
import {scaleBattlefieldUnit} from '../game/render/battlefield-scale.js';

const page=document.querySelector('#page'),angle=document.querySelector('#angle'),state=document.querySelector('#state'),effects=document.querySelector('#effects'),labels=document.querySelector('#labels'),status=document.querySelector('#status'),play=document.querySelector('#play');
const definitions=await(await fetch('/data/enemies.json')).json(),manifest=await(await fetch('/assets/geometric/geometric-enemies.json')).json();
const ids=Object.keys(definitions).filter(id=>/^host_\d\d$/.test(id)).sort();
for(let start=0;start<ids.length;start+=10){const option=document.createElement('option');option.value=String(start);option.textContent=`Enemies ${start+1}–${Math.min(start+10,ids.length)}`;page.append(option);}
const loader=new GLTFLoader(),renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#ece9df');renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.setScissorTest(true);document.body.append(renderer.domElement);
let records=[],phase=0,running=false,elapsed=0,last=0,loading=false;

function clear(){
  for(const r of records){r.abilities.dispose();disposeEnemyFigure(r.figure);r.ground.geometry.dispose();r.ground.material.dispose();disposeDecodedGeometricAsset(r.gltf);}
  records=[];
}
async function load(){
  loading=true;running=false;play.textContent='Play';clear();labels.replaceChildren();status.textContent='Loading actual production GLBs';
  const first=Number(page.value);
  for(const id of ids.slice(first,first+10)){
    const bytes=await(await fetch(`/assets/geometric/enemies/${id}.glb?t=${Date.now()}`)).arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',bytes),assetSha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    const asset=manifest.entries.find(row=>row.id===id),expectedSha256=(asset?.qa||asset?.metrics)?.fileSha256;
    if(assetSha256!==expectedSha256)throw new Error(`${id}: actual loaded GLB does not match its current manifest`);
    const gltf=await loader.parseAsync(bytes,''),metadata=geometricMetadata(gltf.scene);
    const enemy={...definitions[id],id:0,type:id,x:0,z:0,traveled:0,statuses:{},shields:definitions[id].refraction||0,rechargeClock:8};
    const figure=enemyFigure(enemy,new Map([[id,gltf.scene]]));scaleBattlefieldUnit(figure,enemy);
    const rig=createGeometricMotionRig(figure);figure.userData.geometricMotion=rig;
    const scene=new THREE.Scene();scene.add(figure);scene.add(new THREE.HemisphereLight('#fffdf1','#69778f',1.45));
    const light=new THREE.DirectionalLight('#fff7de',1.6);light.position.set(-3,7,-5);scene.add(light);
    const bounds=new THREE.Box3().setFromObject(figure.userData.body,true),size=bounds.getSize(new THREE.Vector3()),height=Math.max(.3,size.y),centre=bounds.getCenter(new THREE.Vector3());
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(height*10,height*10),new THREE.MeshStandardMaterial({color:'#e2e0d6',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;scene.add(ground);
    const aura=createEnemyAura(enemy,figure.userData.body);if(aura){figure.userData.aura=aura;figure.add(aura);}
    const abilities=new EnemyAbilityEffects(scene,{maxEnemies:1,maxEffects:6}),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100);
    const label=document.createElement('div');label.className='label';label.dataset.id=id;label.dataset.assetSha256=assetSha256;label.title=`SHA-256 ${assetSha256}`;label.textContent=`${id} · ${enemy.flying?'flight':'gait'}${enemy.boss?' · boss ×1.5':''} · ${assetSha256.slice(0,12)}`;labels.append(label);
    records.push({id,gltf,metadata,enemy,figure,rig,scene,camera,ground,aura,abilities,size,height,centre,assetSha256,shardsVisible:figure.userData.shards?.visible});
  }
  loading=false;phase=0;elapsed=0;pose(0);
  window.enemyReviewV6={records,ids,pose,manifest,scope:'Actual production enemyFigure, battlefield scale, gait/flight, freeze, petrify, reduced motion, auras, defenses and grounded death. Per-model framing does not compare boss size against another enemy.'};
}
function flightFrequency(r){const archetype=r.enemy.designArchetype||'';return archetype.includes('wyvern')||r.enemy.model==='dragon'?3.4:archetype.includes('manta')?4.1:archetype==='iron-bat'?5.2:archetype==='wing-scrapper'?2.1:9;}
function pose(p){
  phase=p;const reducedMotion=state.value==='reduced';
  for(const r of records){
    delete r.figure.userData.death;r.rig.dead=false;resetGeometricMotion(r.rig);r.rig.phase=p*Math.PI*2;r.rig.clock=null;r.rig.traveled=null;r.figure.position.set(0,0,0);r.enemy.dead=false;r.enemy.traveled=0;
    if(r.figure.userData.shards)r.figure.userData.shards.visible=r.shardsVisible;
    r.enemy.statuses=state.value==='freeze'?{freeze:{time:1}}:state.value==='petrify'?{petrify:{time:1}}:{};
    const time=r.enemy.flying?p*Math.PI*2/flightFrequency(r):p;
    const bob=animateGeometricEnemyMotion(r.figure,r.enemy,time,{moving:true,reducedMotion});r.figure.position.y=(r.enemy.flying?.65:0)+bob;
    if(r.aura){r.aura.visible=effects.checked;animateEnemyAura(r.aura,time,{reducedMotion});}
    animateEnemyCues(r.figure,r.enemy,time,{reducedMotion});
    r.abilities.reducedMotion=reducedMotion;r.abilities.clear();if(effects.checked)r.abilities.sync([r.enemy],new Map([[r.enemy.id,r.figure]]),time);
    if(state.value==='death'){beginGroundedDeath(r.figure,r.enemy);animateGroundedDeath(r.figure,p*(r.enemy.flying?.95:.65));r.abilities.clear();}
  }
  status.textContent=`${records.length} actual assets · ${state.value} · phase ${p.toFixed(2)}`;
}
function render(time){
  const dt=last?Math.min(.05,(time-last)/1000):0;last=time;if(running&&!loading){elapsed+=dt*.35;pose(elapsed%1);}
  const width=innerWidth,height=innerHeight-70,rows=Math.ceil(Math.max(1,records.length)/4),tileW=width/4,tileH=height/rows;renderer.setSize(width,height,false);labels.style.gridAutoRows=`${tileH}px`;
  for(let i=0;i<records.length;i++){
    const r=records[i],aspect=tileW/tileH,span=['left','right'].includes(angle.value)?r.size.z:angle.value.startsWith('quarter-')?Math.hypot(r.size.x,r.size.z):r.size.x,vertical=Math.max(r.height*1.5,span/aspect*1.35),h=r.height;
    r.camera.left=-vertical*aspect/2;r.camera.right=vertical*aspect/2;r.camera.top=vertical/2;r.camera.bottom=-vertical/2;r.camera.updateProjectionMatrix();
    const target=new THREE.Vector3(r.centre.x,r.centre.y+(r.enemy.flying?.65:0),r.centre.z),offset=angle.value==='left'?[h*5,h*.65,0]:angle.value==='right'?[-h*5,h*.65,0]:angle.value==='back'?[0,h*.65,h*5]:angle.value==='quarter-front'?[h*3.5,h*.9,-h*4]:angle.value==='quarter-back'?[-h*3.5,h*.9,h*4]:[0,h*.65,-h*5];
    r.camera.position.copy(target).add(new THREE.Vector3(...offset));r.camera.lookAt(target);
    renderer.setViewport(i%4*tileW,height-(Math.floor(i/4)+1)*tileH,tileW,tileH);renderer.setScissor(i%4*tileW,height-(Math.floor(i/4)+1)*tileH,tileW,tileH);renderer.render(r.scene,r.camera);
  }
  requestAnimationFrame(render);
}
page.addEventListener('change',load);state.addEventListener('change',()=>pose(phase));effects.addEventListener('change',()=>pose(phase));play.addEventListener('click',()=>{running=!running;play.textContent=running?'Pause':'Play';});
for(const button of document.querySelectorAll('[data-phase]'))button.addEventListener('click',()=>{running=false;play.textContent='Play';pose(Number(button.dataset.phase));});
await load();requestAnimationFrame(render);

import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {rankAdornment,animateRank} from './ranks.js';
import {castleWallModel,wallConnections,hasWallFoundation,WALL_DECK_HEIGHT} from './walls.js';
import {enemyFigure,disposeEnemyFigure} from './enemy-assets.js';
import {bossAura,animateBossAura,beginDeath,animateDeath,siegeRig,animateSiege} from './battle-animation.js';
import {DraftMarkers} from './draft-markers.js';
import {siteUrl} from '../site-url.js';
import {SIZE} from '../core/grid.js';
import {MazePlanner} from './maze-planner.js';
import {edgePan,compassBearing} from './navigation.js';
import {configureTouchControls,PointerTapGesture} from './touch-input.js';
import {valleyEnvironment} from './environment.js';
import {meadowTerrain,interiorGrid} from './terrain.js';
import {seededRandom,towerStats,supportBonuses} from '../core/math.js';
import {towerModel,treeModel,rockModel,keepModel,houseModel,campModel,enemyModel,box,cone,cylinder,banner,beam,optimize,material} from './models.js';

const HALF=(SIZE-1)/2;
const v3=(x,y,z)=>new THREE.Vector3(x-HALF,y,z-HALF);
export class Battlefield {
  constructor(container,game,onTile) {
    this.container=container;this.game=game;this.onTile=onTile;this.time=0;this.models=new Map();this.enemies=new Map();this.shots=new Map();this.effects=[];this.templates=new Map();this.imported=new Map();this.enemyTemplates=new Map();this.showPath=true;this.showGrid=true;this.showRanges=false;this.hover=null;this.pathRevision=-1;this.keys=new Set();this.shake=0;
    this.corpses=new Map();this.corpseRound=game.round;
    this.edgePointer=null;this.compass=container.parentElement.querySelector('.map-compass');
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#9bbcc1');this.scene.fog=new THREE.Fog('#9bbcc1',88,155);
    this.camera=new THREE.PerspectiveCamera(38,1,0.1,210);this.camera.position.set(7,53,41);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','3D battlefield. Tap to place or select; drag one finger to pan; use two fingers to rotate or pinch to zoom.');this.renderer.domElement.tabIndex=0;
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(1,1,-1);this.controls.enableDamping=true;this.controls.dampingFactor=0.09;this.controls.minDistance=12;this.controls.maxDistance=90;this.controls.maxPolarAngle=Math.PI*0.43;this.controls.minPolarAngle=Math.PI*0.12;this.controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.ROTATE,RIGHT:THREE.MOUSE.PAN};configureTouchControls(this.controls);
    this.scene.add(new THREE.HemisphereLight('#e0eee0','#465847',2));
    const sun=new THREE.DirectionalLight('#fff0cc',3.4);sun.position.set(-18,38,13);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;sun.shadow.camera.far=100;sun.shadow.normalBias=0.04;sun.shadow.bias=-0.0001;this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight('#b2c6c6',0.25));
    this.createEnvironment();this.createOverlays();this.maze=new MazePlanner(this);this.draftMarkers=new DraftMarkers(this.scene,this.container);
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),-0.03);this.tapGesture=new PointerTapGesture();
    this.clearPointer=()=>{this.edgePointer=null;this.hover=null;this.cursor.visible=false;this.ghost.visible=false;this.maze.endStroke();};
    this.trackPointer=e=>{
      const rect=this.renderer.domElement.getBoundingClientRect();
      this.edgePointer=e.target===this.renderer.domElement&&e.pointerType!=='touch'&&!e.buttons?{x:e.clientX-rect.left,y:e.clientY-rect.top}:null;
    };
    document.addEventListener('pointermove',this.trackPointer);
    this.renderer.domElement.addEventListener('pointerdown',e=>{
      this.edgePointer=null;this.tapGesture.start(e);
      if(e.pointerType==='touch'){this.clearPointer();return;}
      if(this.maze.editing&&e.button===0){this.movePointer(e);this.maze.editor.begin();if(this.hover)this.maze.paint(this.hover.x,this.hover.z);}
    });
    this.renderer.domElement.addEventListener('pointermove',e=>{
      this.tapGesture.move(e);
      if(e.pointerType==='touch'){
        // This listener runs before OrbitControls' move listener. Small tap jitter
        // does not move the camera; a drag then pans from the original position.
        if(!this.tapGesture.navigating(e.pointerId))e.stopImmediatePropagation();
        return;
      }
      this.movePointer(e);if(this.maze.editing&&e.buttons===1&&this.hover)this.maze.paint(this.hover.x,this.hover.z);
    });
    this.renderer.domElement.addEventListener('pointerleave',this.clearPointer);
    this.renderer.domElement.addEventListener('pointerup',e=>{
      const tap=this.tapGesture.end(e);
      if(this.maze.editing){
        if(e.pointerType==='touch'&&tap){this.movePointer(e);this.maze.editor.begin();if(this.hover)this.maze.paint(this.hover.x,this.hover.z);}
        this.maze.endStroke();
      }else if(tap){this.movePointer(e);if(this.hover)this.onTile(this.hover.x,this.hover.z);}
      if(e.pointerType==='touch')this.clearPointer();else this.trackPointer(e);
    });
    const cancelPointer=e=>{this.tapGesture.cancel(e);this.clearPointer();};
    this.renderer.domElement.addEventListener('pointercancel',cancelPointer);
    this.renderer.domElement.addEventListener('lostpointercapture',cancelPointer);
    this.renderer.domElement.addEventListener('click',e=>{if(this.tapGesture.suppressClick(e)){e.preventDefault();e.stopPropagation();}},true);
    this.cancelInput=()=>{this.tapGesture.clear();this.clearPointer();};window.addEventListener('blur',this.cancelInput);
    this.renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
    this.unsubscribe=game.on((type,payload)=>this.event(type,payload));
    this.sync();
  }
  async loadAssets() {
    await Promise.all([this.loadDefenders(),this.loadEnemies()]);
  }
  async loadEnemies(){
    try{
      const response=await fetch(siteUrl('assets/enemies/manifest.json'));if(!response.ok)return;
      const entries=await response.json(),loader=new GLTFLoader();
      await Promise.all(entries.map(async entry=>{
        try{const gltf=await loader.loadAsync(siteUrl(`assets/enemies/${entry.file}`));gltf.scene.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});this.enemyTemplates.set(entry.id,gltf.scene);}catch{/* Keep the playable fallback if one file is unavailable. */}
      }));
      for(const model of this.enemies.values()){this.scene.remove(model);disposeEnemyFigure(model);}
      this.enemies.clear();
    }catch{/* Standalone mirrors can use the procedural fallback. */}
  }
  async loadDefenders() {
    const loader=new GLTFLoader();
    // The procedural templates make the game immediately playable; generated glTF replaces them when available.
    try {
      const response=await fetch(siteUrl('assets/models/manifest.json'));if(!response.ok)return;
      const entries=await response.json();
      await Promise.all(entries.filter(e=>e.kind==='tower'&&this.game.data.towers[e.family]).map(async e=>{
        try {const gltf=await loader.loadAsync(siteUrl(`assets/models/${e.file}`));gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});this.imported.set(`${e.family}:${e.tier}`,gltf.scene);}catch{/* The complete procedural model remains available. */}
      }));
      this.models.forEach(v=>v.signature='');this.sync();
    }catch{/* Static mirrors without the generated asset pack retain the procedural models. */}
  }
  createEnvironment() {
    const env=new THREE.Group(),rng=seededRandom(808);
    // The entire 37 × 37 playfield is open; only player-built defenses obstruct it.
    this.scene.add(meadowTerrain());
    // Decorative camp and keep sit beyond the left and right board edges.
    const keep=keepModel();keep.position.set(26.5,0,14);env.add(keep);
    const camp=campModel();camp.position.set(-22,0,-14);env.add(camp);
    this.scene.add(optimize(env));
    this.valley=valleyEnvironment();this.scene.add(this.valley.staticGroup,this.valley.water);if(this.valley.clouds)this.scene.add(this.valley.clouds);
    const checkpointGroup=new THREE.Group();
    this.game.grid.checkpoints.forEach((p,i)=>{
      const marker=new THREE.Group();cylinder(marker,0.48,0.55,0.07,i===0?'#9b5444':'#b9a16e',[0,0.1,0],8);
      banner(marker,0.25,0.1,0.15,i===0?'#923e34':'#366c87',0.85);marker.position.copy(v3(p.x,0,p.z));checkpointGroup.add(marker);
    });this.scene.add(optimize(checkpointGroup));
    this.grid=interiorGrid(SIZE);this.grid.position.y=0.045;this.grid.material.transparent=true;this.grid.material.opacity=0.14;this.grid.material.depthWrite=false;this.scene.add(this.grid);
  }
  createOverlays() {
    this.cursor=new THREE.Mesh(new THREE.PlaneGeometry(0.96,0.96),new THREE.MeshBasicMaterial({color:'#aedeaa',transparent:true,opacity:0.45,depthWrite:false}));this.cursor.rotation.x=-Math.PI/2;this.cursor.visible=false;this.scene.add(this.cursor);
    this.range=new THREE.Mesh(new THREE.RingGeometry(0.985,1,80),new THREE.MeshBasicMaterial({color:'#e6ca88',transparent:true,opacity:0.55,side:THREE.DoubleSide,depthWrite:false}));this.range.rotation.x=-Math.PI/2;this.range.visible=false;this.scene.add(this.range);
    this.selectionRing=new THREE.Mesh(new THREE.RingGeometry(0.56,0.61,4),new THREE.MeshBasicMaterial({color:'#ffe4a1',side:THREE.DoubleSide,transparent:true,opacity:0.9}));this.selectionRing.rotation.set(-Math.PI/2,0,Math.PI/4);this.selectionRing.visible=false;this.scene.add(this.selectionRing);
    this.ghost=new THREE.Group();this.scene.add(this.ghost);
    this.pathGroup=new THREE.Group();this.scene.add(this.pathGroup);
    this.rangeGroup=new THREE.Group();this.scene.add(this.rangeGroup);
    this.healthBars=new THREE.Group();this.scene.add(this.healthBars);
    this.labels=document.createElement('div');this.labels.className='map-labels';this.container.append(this.labels);
    this.labelItems=[{x:-22,z:-14,title:'ORC WARCAMP',className:'enemy',height:4},{x:26.5,z:14,title:'THE LAST KEEP',className:'keep',height:4},...this.game.grid.checkpoints.slice(1,-1).map((p,i)=>({x:p.x-HALF,z:p.z-HALF,title:`${i+1}`,className:'checkpoint-label',height:2}))].map(p=>{const el=document.createElement('span');el.className=`map-label ${p.className}`;el.textContent=p.title;this.labels.append(el);return {...p,el};});
  }
  template(t) {if(t.state==='ruin'){const mask=wallConnections(t,this.game.towers),key='wall:'+mask;if(!this.templates.has(key))this.templates.set(key,castleWallModel(mask));return this.templates.get(key);}const stats=this.game.data.towers[t.family],key=`${t.family}:${stats?.advanced?1:t.tier}`;if(this.imported.has(key))return this.imported.get(key);if(!this.templates.has(key))this.templates.set(key,towerModel(t.family,stats?.advanced?1:t.tier,stats?.advanced,stats?.model));return this.templates.get(key);}
  sync() {
    const ids=new Set(this.game.towers.map(t=>t.id));
    for(const [id,value]of this.models)if(!ids.has(id)){this.scene.remove(value.object);this.models.delete(id);}
    for(const t of this.game.towers) {
      const signature=`${t.family}:${t.tier}:${t.state}:${t.upgrades||0}:${hasWallFoundation(t)?wallConnections(t,this.game.towers):''}`;let value=this.models.get(t.id);
      if(!value||value.signature!==signature){
        if(value)this.scene.remove(value.object);
        const object=new THREE.Group(),actor=this.template(t).clone(true);
        if(t.state==='active'){
          const mask=wallConnections(t,this.game.towers),key='platform:'+mask;
          if(!this.templates.has(key))this.templates.set(key,castleWallModel(mask,true));
          object.add(this.templates.get(key).clone(true));actor.position.y=WALL_DECK_HEIGHT;
        }
        object.add(actor);object.position.copy(v3(t.x,0,t.z));this.scene.add(object);
        actor.rotation.y=t.state==='ruin'?0:Math.PI;
        if(t.state!=='ruin'&&(!this.game.data.towers[t.family]?.advanced||t.tier>1))actor.add(rankAdornment(Math.min(6,t.tier)));
        value={object,actor,signature,kick:0,siege:siegeRig(actor),hero:this.game.data.towers[t.family]?.unitKind!=='siege'&&t.state!=='ruin',phase:t.id*1.7};this.models.set(t.id,value);
      }
    }
    this.draftMarkers.sync(this.game,this.models);
    if(this.pathRevision!==this.game.grid.revision){this.pathRevision=this.game.grid.revision;this.rebuildPath();}
    const selected=this.game.selection;
    this.selectionRing.visible=!!selected;
    if(selected)this.selectionRing.position.copy(v3(selected.x,0.065,selected.z));
    this.range.visible=!!selected&&selected.state!=='ruin';
    if(this.range.visible){this.range.position.copy(v3(selected.x,0.07,selected.z));this.range.scale.setScalar(towerStats(selected,this.game.data).range+supportBonuses(selected,this.game.towers,this.game.data).range);}
    this.grid.visible=this.showGrid&&this.game.phase!=='combat';
    this.pathGroup.visible=this.showPath&&!this.maze.editing;
    this.maze.sync();
    this.ghost.visible=false;
    if(this.showRanges)this.rebuildRanges();else this.rangeGroup.visible=false;
  }
  rebuildPath() {
    this.pathGroup.children.slice().forEach(o=>{this.pathGroup.remove(o);o.geometry.dispose();o.material.dispose();});
    const points=this.game.grid.route.map(p=>v3(p.x,0.075,p.z));
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:'#edd6a0',transparent:true,opacity:0.8,dashSize:0.24,gapSize:0.35}));line.computeLineDistances();this.pathGroup.add(line);
  }
  rebuildRanges() {
    this.rangeGroup.children.slice().forEach(o=>{this.rangeGroup.remove(o);o.geometry.dispose();o.material.dispose();});
    for(const t of this.game.towers.filter(t=>t.state==='active')){const m=new THREE.Mesh(new THREE.RingGeometry(0.985,1,48),new THREE.MeshBasicMaterial({color:this.game.data.towers[t.family].color,transparent:true,opacity:0.22,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.copy(v3(t.x,0.06,t.z));m.scale.setScalar(towerStats(t,this.game.data).range+supportBonuses(t,this.game.towers,this.game.data).range);this.rangeGroup.add(m);}this.rangeGroup.visible=true;
  }
  movePointer(e) {
    const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    const p=new THREE.Vector3();if(!this.raycaster.ray.intersectPlane(this.plane,p))return;
    const x=Math.round(p.x+HALF),z=Math.round(p.z+HALF);
    if(!this.game.grid.inside(x,z)){this.cursor.visible=false;this.ghost.visible=false;this.hover=null;return;}
    if(this.hover?.x===x&&this.hover?.z===z&&this.hover?.rev===`${this.game.grid.revision}:${this.game.activeDraw}:${this.game.phase}`)return;
    this.hover={x,z,rev:`${this.game.grid.revision}:${this.game.activeDraw}:${this.game.phase}`};
    if(this.maze.editing){this.cursor.position.copy(v3(x,.065,z));this.cursor.visible=true;this.cursor.material.color.set(this.maze.brush==='erase'?'#ef997d':'#83e2ed');this.ghost.visible=false;this.renderer.domElement.style.cursor='crosshair';return;}
    const valid=this.game.phase==='build'&&this.game.grid.canPlace(x,z).ok;
    this.cursor.position.copy(v3(x,0.065,z));this.cursor.visible=true;this.cursor.material.color.set(valid?'#bbe3a2':this.game.grid.type(x,z)==='occupied'?'#eed69b':'#d75b47');
    this.renderer.domElement.style.cursor=this.game.grid.type(x,z)==='occupied'?'pointer':valid?'crosshair':'not-allowed';
    this.ghost.visible=false;
    if(valid){const draw=this.game.draft.draws[this.game.activeDraw];if(draw){this.ghost.traverse(o=>{if(o.isMesh)o.material.dispose();});this.ghost.clear();const t=this.template({family:'ruin',tier:1,state:'ruin'}).clone(true);t.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=0.45;o.castShadow=false;}});this.ghost.add(t);this.ghost.position.copy(v3(x,0.04,z));this.ghost.visible=true;}}
  }
  event(type,payload) {
    if(type==='change')this.sync();
    if(type==='shot'||type==='aura-attack'){const value=this.models.get(payload.source.id);if(value){value.kick=.15;if(value.siege)value.siege.elapsed=0;value.actor.rotation.y=Math.atan2(payload.target.x-payload.source.x,payload.target.z-payload.source.z)+(['archer','thornwarden','verdantguard'].includes(payload.source.family)?Math.PI/2:Math.PI);}}
    if(['place','combine','keep'].includes(type)){const t=payload.tower;this.burst(t.x,t.z,type==='combine'?'#ead091':'#c7d4a8',type==='combine'?2.5:0.7);}
    if(type==='impact'&&payload.melee){
      const slash=new THREE.Mesh(new THREE.RingGeometry(.45,.65,20,1,0,Math.PI*1.3),new THREE.MeshBasicMaterial({color:'#e8f5dc',transparent:true,side:THREE.DoubleSide}));slash.position.copy(v3(payload.x,.8,payload.z));slash.rotation.set(-Math.PI/3,0,this.time);this.scene.add(slash);this.effects.push({object:slash,life:.22,max:.22,size:.3});
    }
    if(type==='impact'){this.burst(payload.x,payload.z,payload.color,payload.radius);if(payload.heavy)this.shake=0.075;}
    if(type==='deflect')this.burst(payload.enemy.x,payload.enemy.z,'#a5dfdf',.5);
    if(type==='death'){
      const enemy=payload.enemy;let figure=this.enemies.get(enemy.id);
      if(!figure){figure=enemyFigure(enemy,this.enemyTemplates);figure.position.copy(v3(enemy.x,enemy.flying?.8:0,enemy.z));this.scene.add(figure);}
      figure.position.x=enemy.x-HALF;figure.position.z=enemy.z-HALF;
      this.enemies.delete(enemy.id);beginDeath(figure,enemy);this.corpses.set(enemy.id,figure);
      this.burst(enemy.x,enemy.z,'#bcc6a1',.35);
    }
    if(type==='leak'){this.burst(payload.enemy.x,payload.enemy.z,'#ff9a63',1.7);this.shake=0.12;}
    if(type==='chain') {const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([v3(payload.from.x,0.65,payload.from.z),v3(payload.to.x,0.65,payload.to.z)]),new THREE.LineBasicMaterial({color:payload.color,transparent:true}));this.scene.add(line);this.effects.push({object:line,life:0.25,max:0.25,line:true});}
  }
  burst(x,z,color,size) {
    const m=new THREE.Mesh(new THREE.RingGeometry(0.25,0.4,20),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.7,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.copy(v3(x,0.22,z));this.scene.add(m);this.effects.push({object:m,life:0.45,max:0.45,size});
  }
  resize(){const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
  resetCamera(){this.camera.position.set(7,53,41);this.controls.target.set(1,1,-1);this.controls.update();}
  tileScreen(x,z) {const p=v3(x,0.08,z).project(this.camera),r=this.renderer.domElement.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(-p.y+1)*r.height/2};}
  update(dt) {
    this.time+=dt;this.draftMarkers.update(this.time,this.camera,this.container.clientHeight);
    for(const v of this.models.values())animateRank(v.object,this.time);
    this.valley.update(dt,this.time,this.camera.position.distanceTo(this.controls.target));
    if(this.corpseRound!==this.game.round){this.clearCorpses();this.corpseRound=this.game.round;}
    const battleDt=this.game.paused?0:dt*this.game.speed;
    for(const corpse of this.corpses.values())animateDeath(corpse,battleDt);
    const pan=new THREE.Vector3();const forward=new THREE.Vector3().subVectors(this.controls.target,this.camera.position);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));
    if(this.keys.has('w')||this.keys.has('arrowup'))pan.add(forward);if(this.keys.has('s')||this.keys.has('arrowdown'))pan.sub(forward);if(this.keys.has('d')||this.keys.has('arrowright'))pan.add(right);if(this.keys.has('a')||this.keys.has('arrowleft'))pan.sub(right);
    const edge=(!document.hidden&&!document.querySelector('dialog[open]'))?edgePan(this.edgePointer,this.container.clientWidth,this.container.clientHeight):{x:0,y:0};
    pan.addScaledVector(right,edge.x).addScaledVector(forward,edge.y);if(pan.length()>1)pan.normalize();
    pan.multiplyScalar(dt*12);this.camera.position.add(pan);this.controls.target.add(pan);
    if(this.keys.has('q')||this.keys.has('e')){const offset=this.camera.position.clone().sub(this.controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),dt*(this.keys.has('q')?0.75:-0.75));this.camera.position.copy(this.controls.target).add(offset);}
    this.controls.update();
    if(this.compass)this.compass.style.transform=`rotate(${compassBearing(this.camera.position,this.controls.target)}rad)`;
    const active=new Set(this.game.combat.enemies.map(e=>e.id));
    for(const [id,m]of this.enemies)if(!active.has(id)){this.scene.remove(m);disposeEnemyFigure(m);this.enemies.delete(id);}
    for(const e of this.game.combat.enemies){if(e.dead)continue;let m=this.enemies.get(e.id);if(!m){m=enemyFigure(e,this.enemyTemplates);this.scene.add(m);this.enemies.set(e.id,m);const bg=new THREE.Mesh(new THREE.PlaneGeometry(0.7,0.065),new THREE.MeshBasicMaterial({color:'#232e24',depthTest:false}));const fill=new THREE.Mesh(new THREE.PlaneGeometry(0.67,0.045),new THREE.MeshBasicMaterial({color:e.boss?'#e2b362':'#94c888',depthTest:false}));bg.add(fill);fill.position.z=0.003;m.add(bg);m.userData.bar=bg;m.userData.fill=fill;if(e.boss){const aura=bossAura(e.clan);m.add(aura);m.userData.aura=aura;}}
      const flying=e.flying?.8:0;const bob=Math.sin(this.time*e.speed*8+e.id)*0.035;m.position.copy(v3(e.x,flying+bob,e.z));const to=e.route[Math.min(e.pathIndex,e.route.length-1)];m.rotation.y=Math.atan2(to.x-e.x,to.z-e.z)+Math.PI;
      const limbs=m.userData.limbs;limbs?.forEach((l,i)=>l.rotation.x=(l.userData.restRotation||0)+Math.sin(this.time*e.speed*7+e.id+(i%2)*Math.PI)*0.42);
      m.userData.wings?.forEach((wing,i)=>wing.rotation.z=wing.userData.restRotation+Math.sin(this.time*7+e.id)*.26*(i%2?1:-1));
      if(m.userData.aura)animateBossAura(m.userData.aura,this.time);
      m.userData.body.rotation.z=e.hit>0?0.1:0;m.userData.body.scale.setScalar(e.cloaked?.78:1);if(m.userData.shards)m.userData.shards.children.forEach((s,i)=>s.visible=i<e.shields);m.userData.bar.position.set(0,m.userData.barHeight||1.28,0);m.userData.fill.material.color.set(e.cloaked?'#8295c4':e.boss?'#e2b362':'#94c888');m.userData.bar.quaternion.copy(m.quaternion).invert().multiply(this.camera.quaternion);m.userData.fill.scale.x=Math.max(0,e.hp/e.maxHp);m.userData.fill.position.x=-(1-e.hp/e.maxHp)*0.335;
    }
    const shotIds=new Set(this.game.combat.projectiles.map(s=>s.id));
    for(const [id,m]of this.shots)if(!shotIds.has(id)){this.scene.remove(m);m.geometry.dispose();m.material.dispose();this.shots.delete(id);}
    for(const s of this.game.combat.projectiles){if(s.stats.melee)continue;let m=this.shots.get(s.id);if(!m){const physical=['physical','piercing'].includes(s.stats.type);m=new THREE.Mesh(physical?new THREE.BoxGeometry(0.045,0.045,0.55):new THREE.IcosahedronGeometry(0.12,0),new THREE.MeshBasicMaterial({color:s.stats.color}));this.scene.add(m);this.shots.set(s.id,m);}const p=s.progress;m.position.copy(v3(s.x,(1.5+WALL_DECK_HEIGHT)*(1-p)+(s.target.flying?1.9:s.target.boss?1.4:1.0)*p+Math.sin(p*Math.PI)*0.55,s.z));m.rotation.y=Math.atan2(s.target.x-s.start.x,s.target.z-s.start.z);}
    for(const value of this.models.values()){
      value.kick=Math.max(0,value.kick-dt);
      const idle=value.hero?Math.sin(this.time*2.8+value.phase)*.018:0;
      value.actor.scale.set(1-value.kick*.2,1+idle+value.kick*.65,1-value.kick*.2);
      animateSiege(value.siege,battleDt);
      value.actor.rotation.z=value.hero?Math.sin(this.time*2.8+value.phase)*.012:0;
    }
    for(const fx of this.effects){fx.life-=dt;fx.object.material.opacity=Math.max(0,fx.life/fx.max)*0.75;if(!fx.line)fx.object.scale.setScalar(0.5+(1-fx.life/fx.max)*fx.size*3);}
    this.effects=this.effects.filter(fx=>{if(fx.life>0)return true;this.scene.remove(fx.object);fx.object.geometry.dispose();fx.object.material.dispose();return false;});
    for(const p of this.labelItems){const v=new THREE.Vector3(p.x,p.height,p.z).project(this.camera);p.el.style.transform=`translate(${(v.x+1)*this.container.clientWidth/2}px,${(-v.y+1)*this.container.clientHeight/2}px) translate(-50%,-100%)`;p.el.style.display=Math.abs(v.x)>1||Math.abs(v.y)>1?'none':'';}
    if(this.shake>0){this.shake=Math.max(0,this.shake-dt);this.camera.position.y+=Math.sin(this.time*73)*this.shake*0.25;}
    this.renderer.render(this.scene,this.camera);
  }
  clearCorpses(){for(const corpse of this.corpses.values()){this.scene.remove(corpse);disposeEnemyFigure(corpse);}this.corpses.clear();}
  dispose(){this.clearCorpses();this.draftMarkers.dispose();this.unsubscribe();this.resizeObserver.disconnect();this.controls.dispose();this.maze.dispose();document.removeEventListener('pointermove',this.trackPointer);window.removeEventListener('blur',this.cancelInput);this.renderer.dispose();}
}

export function makeThumbnails(data) {
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(180,156);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff4dd','#61717a',3));const light=new THREE.DirectionalLight('#ffedcf',4);light.position.set(-3,5,4);scene.add(light);
  const camera=new THREE.PerspectiveCamera(32,180/156,0.1,20);camera.position.set(-2.3,2.2,-3.6);camera.lookAt(0,0.95,0);
  const images={};
  for(const [id,stats]of Object.entries(data.towers))for(let tier=1;tier<=(stats.advanced?1:data.balance.tiers.length);tier++){
    images[`${id}:${tier}`]=siteUrl(`assets/${id==='archer'?'archer':'army'}/${id}-t${tier}.png`);
    if(tier===1)images[id]=images[`${id}:${tier}`];
  }
  camera.position.set(-2.3,2.2,-3.6);camera.lookAt(0,.95,0);
  for(const id of Object.keys(data.enemies).filter(id=>id.startsWith('host_')))images['enemy:'+id]=siteUrl(`assets/enemies/${id}.png`);
  camera.position.set(-2.3,2.2,-3.6);camera.lookAt(0,.95,0);
  const wall=castleWallModel(10);scene.add(wall);camera.lookAt(0,.4,0);renderer.render(scene,camera);images.ruin=renderer.domElement.toDataURL('image/png');wall.traverse(o=>o.geometry?.dispose());renderer.dispose();return images;
}

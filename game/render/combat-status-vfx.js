import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const finite=(n,f=0)=>Number.isFinite(n)?n:f;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const STYLES={
  poison:{color:'#8bfd49',opacity:.55,shape:'cloud',particles:3},
  burn:{color:'#ffffff',opacity:.94,shape:'flame',particles:3},
  slow:{color:'#45dfff',opacity:.92,shape:'wind',particles:1},
  freeze:{color:'#a1eaff',opacity:.52,shape:'ice',particles:1},
  stun:{color:'#ffe076',opacity:.95,shape:'star',particles:3},
  root:{color:'#dfbd6b',opacity:.96,shape:'roots',particles:1},
  petrify:{color:'#c4c6ad',opacity:.40,shape:'stone',particles:1},
  armor:{color:'#ffcf8c',opacity:.84,shape:'flake',particles:2},
  bleed:{color:'#ec4f62',opacity:.84,shape:'drop',particles:3},
  healBlock:{color:'#ff7596',opacity:.9,shape:'cross',particles:1},
  regenReduction:{color:'#e8a0e5',opacity:.86,shape:'barredCross',particles:1},
  physicalPass:{color:'#ffc36b',opacity:.78,shape:'brokenShell',particles:1},
  magicalPass:{color:'#be9aff',opacity:.85,shape:'rune',particles:1},
  heat:{color:'#ffffff',opacity:.82,shape:'flame',particles:3},
  heal:{color:'#a3ecc0',opacity:.55,shape:'mote'},
  flash:{color:'#e9faff',opacity:.78,shape:'flash'},
};
const combined=parts=>{const flat=parts.map(part=>part.index?part.toNonIndexed():part),result=mergeGeometries(flat);for(const part of new Set([...parts,...flat]))part.dispose();return result;};
const painted=(geometry,color)=>{const c=new THREE.Color(color),values=new Float32Array(geometry.attributes.position.count*3);for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b;}geometry.setAttribute('color',new THREE.BufferAttribute(values,3));return geometry;};
function geometryFor(shape){
  if(shape==='wind'){const points=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*4;return new THREE.Vector3(Math.cos(a),i/48*1.1,Math.sin(a));});return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,.055,4,false);}
  if(shape==='flash')return new THREE.RingGeometry(.35,1,20);
  if(shape==='flame')return combined([
    painted(new THREE.ConeGeometry(.19,.92,5).translate(0,.30,0),'#ff651a'),
    painted(new THREE.ConeGeometry(.13,.66,5).rotateZ(-.18).translate(.06,.22,.04),'#ffbb32'),
    painted(new THREE.ConeGeometry(.075,.43,4).translate(0,.16,.10),'#fff6b2'),
    ...[0,1,2].map(i=>painted(new THREE.IcosahedronGeometry(.025+i*.006,0).translate(Math.sin(i*3)*.16,.9+i*.16,Math.cos(i*3)*.12),'#ffdc69')),
  ]);
  if(shape==='flake')return new THREE.BoxGeometry(.13,.18,.025);
  if(shape==='stone')return new THREE.IcosahedronGeometry(1,1);
  if(shape==='ice')return combined([new THREE.IcosahedronGeometry(1,0),...[-1,1].map(sign=>new THREE.OctahedronGeometry(.30,0).scale(.7,1.7,.7).translate(sign*.8,.2,0))]);
  if(shape==='star'){
    const points=Array.from({length:10},(_,i)=>{const angle=i*Math.PI/5+Math.PI/2,r=i%2?.045:.105;return new THREE.Vector2(Math.cos(angle)*r,Math.sin(angle)*r);});
    return new THREE.ExtrudeGeometry(new THREE.Shape(points),{depth:.025,bevelEnabled:false});
  }
  if(shape==='roots')return new THREE.TorusKnotGeometry(.27,.055,48,5,2,3).scale(1,.7,1);
  if(shape==='drop')return new THREE.ConeGeometry(.052,.15,6).rotateZ(Math.PI);
  if(shape==='cross'||shape==='barredCross'){
    const parts=[new THREE.BoxGeometry(.27,.065,.045),new THREE.BoxGeometry(.065,.27,.045)];
    if(shape==='barredCross')parts.push(new THREE.BoxGeometry(.38,.027,.055).rotateZ(-Math.PI/4));
    return combined(parts);
  }
  if(shape==='brokenShell')return combined([new THREE.TorusGeometry(.34,.026,4,16,Math.PI*.68),new THREE.TorusGeometry(.34,.026,4,16,Math.PI*.68).rotateZ(Math.PI),new THREE.BoxGeometry(.025,.18,.025).rotateZ(.4).translate(.1,0,0)]);
  if(shape==='rune')return new THREE.TorusKnotGeometry(.30,.018,32,3,3,2);
  if(shape==='cloud')return combined([new THREE.IcosahedronGeometry(.18,1),new THREE.IcosahedronGeometry(.13,1).translate(.12,.05,.05),new THREE.SphereGeometry(.06,8,6).translate(-.08,.27,0),new THREE.SphereGeometry(.04,8,6).translate(.1,.34,.04)]);
  return new THREE.IcosahedronGeometry(.045,1);
}
const persistentKinds=Object.keys(STYLES).filter(kind=>!['heal','flash'].includes(kind));

/** One bounded, separately owned composite per visible target. No combat writes. */
export class CombatStatusVfx{
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x,y,z),targetHeight=()=>1,isVisible=()=>true,reducedMotion=false,getTime=null,camera=null,getViewport=null,maxInstances=256}={}){
    this.scene=scene;this.position=position;this.targetHeight=targetHeight;this.isVisible=isVisible;this.reducedMotion=reducedMotion;this.getTime=getTime;this.maxInstances=Math.max(1,Math.floor(maxInstances));
    this.camera=camera;this.getViewport=getViewport;this.envelopes=new WeakMap();this.batches=new Map();this.pulses=new Map();this.targets=new Map();this.pose=new THREE.Object3D();this.disposed=false;this.count=0;this.time=0;
  }
  still(){return typeof this.reducedMotion==='function'?this.reducedMotion():this.reducedMotion;}
  batch(kind){
    if(this.batches.has(kind))return this.batches.get(kind);
    const style=STYLES[kind],object=new THREE.InstancedMesh(geometryFor(style.shape),new THREE.MeshBasicMaterial({color:'#ffffff',vertexColors:style.shape==='flame',transparent:true,opacity:style.opacity,depthWrite:false,depthTest:!['stun','healBlock','regenReduction'].includes(kind),side:THREE.DoubleSide,toneMapped:false,wireframe:kind==='petrify',blending:kind==='flash'?THREE.AdditiveBlending:THREE.NormalBlending}),this.maxInstances);
    object.renderOrder=8;
    object.name='Actual target '+kind;object.raycast=()=>{};object.frustumCulled=false;object.count=0;object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(object);this.batches.set(kind,object);return object;
  }
  pulse(kind,enemy,{amount=1,color}={}){
    if(this.disposed||!enemy||enemy.dead||this.isVisible(enemy)===false||!(amount>0)||!['flash','heal'].includes(kind))return;
    if(kind==='flash'&&this.still())return;
    // Coalesce a volley by target; keep healing and damage distinct.
    const at=finite(this.getTime?.(),this.time),key=kind+':'+enemy.id,old=this.pulses.get(key);
    if(old&&at-old.at<.08)return;
    if(!old&&this.pulses.size>=this.maxInstances)this.pulses.delete(this.pulses.keys().next().value);
    this.pulses.set(key,{kind,enemy,at,color,duration:kind==='heal'?.42:.20});
  }
  event(type,payload={}){
    if(type==='enemy-heal'&&payload.visible!==false)this.pulse('heal',payload.enemy,{amount:payload.amount,color:payload.cause==='recharge'?'#63e7d4':'#a5e9a5'});
    if(type==='damage-trace'&&payload.visible!==false&&payload.effectiveDamage>0&&(payload.effect==='lightning'||['stormcaller','starfall','thunderheart'].includes(payload.source?.family)&&payload.directHit))this.pulse('flash',payload.enemy,{color:payload.source?.family==='ladyclaire'?'#ffdf8c':'#cbecff'});
    if(type==='death'||type==='leak'){for(const [key,row]of this.pulses)if(row.enemy===payload.enemy)this.pulses.delete(key);}
    if(['wave-complete','won','lost'].includes(type))this.clear();
  }
  envelope(enemy,figures){
    const figure=figures?.get(enemy.id);
    let centre,height=1.4,radius=.45,foot;
    if(figure?.userData.body){
      figure.updateWorldMatrix(true,true);let box=this.envelopes.get(figure);
      if(!box){box=new THREE.Box3().setFromObject(figure.userData.body);if(!box.isEmpty())box.applyMatrix4(new THREE.Matrix4().copy(figure.matrixWorld).invert());else box.set(new THREE.Vector3(-.42,0,-.42),new THREE.Vector3(.42,Math.max(.8,(figure.userData.barHeight||1.55)-.15),.42));this.envelopes.set(figure,box);}
      const scale=figure.getWorldScale(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),local=box.getCenter(new THREE.Vector3());local.y=box.min.y;
      foot=figure.localToWorld(local);height=clamp(size.y*Math.abs(scale.y),.6,5);radius=clamp(Math.max(size.x*Math.abs(scale.x),size.z*Math.abs(scale.z))*.5,.25,2.5);centre=foot.clone();centre.y+=height*.46;
    }else{centre=this.position(enemy.x,this.targetHeight(enemy),enemy.z);foot=centre.clone();foot.y-=height*.46;}
    const camera=typeof this.camera==='function'?this.camera():this.camera,viewport=this.getViewport?.(),pixels=finite(viewport?.height,0);
    let unitPerPixel=0;if(camera&&pixels>0){if(camera.isOrthographicCamera)unitPerPixel=(camera.top-camera.bottom)/camera.zoom/pixels;else if(camera.isPerspectiveCamera)unitPerPixel=2*Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5)*camera.getWorldPosition(new THREE.Vector3()).distanceTo(centre)/pixels;}
    return {centre,footY:foot.y,top:foot.y+height,height,radius,feature:clamp(unitPerPixel*3,.055,.28)};
  }
  centre(enemy,figures){return this.envelope(enemy,figures).centre;}
  put(kind,centre,scale,angle=0,color=null){
    if(this.count>=this.maxInstances)return false;
    const batch=this.batch(kind),index=batch.count++;
    this.pose.position.copy(centre);this.pose.rotation.set(kind==='flash'?-Math.PI/2:0,angle,kind==='armor'?angle*.3:0);this.pose.scale.copy(scale);this.pose.updateMatrix();batch.setMatrixAt(index,this.pose.matrix);
    if(['stun','healBlock','regenReduction','physicalPass'].includes(kind)){const camera=typeof this.camera==='function'?this.camera():this.camera;if(camera?.isCamera){this.pose.quaternion.copy(camera.quaternion);this.pose.updateMatrix();batch.setMatrixAt(index,this.pose.matrix);}}
    batch.setColorAt(index,new THREE.Color(color||STYLES[kind].color));this.count++;return true;
  }
  status(kind,enemy,body,clock,index){
    const {centre,height:h,radius:r,feature}=body,total=STYLES[kind].particles||1,a=enemy.id*.73+index*Math.PI*2/total+clock*(kind==='poison'?.35:.7),at=centre.clone(),size=new THREE.Vector3(1,1,1),still=this.still();
    const wave=still?.5:(Math.sin(clock*2+enemy.id+index*2.1)+1)/2;
    if(kind==='petrify')size.set(r*1.15,h*.60,r*1.15);
    else if(kind==='freeze')size.set(r*1.12,h*.55,r*1.12);
    else if(kind==='slow'){at.y=body.footY+h*.10;size.set(r*1.25,h*.65,r*1.25);}
    else if(kind==='root'){at.y=body.footY+h*.28;size.set(r/.27,h*1.7,r/.27);}
    else if(kind==='healBlock'||kind==='regenReduction'){at.y=body.top+Math.max(.23,feature);size.setScalar(Math.max(h*.17,feature*1.3)/.135);}
    else if(kind==='physicalPass')size.set(r*1.20/.34,h*.57/.34,r*1.20/.34);
    else if(kind==='magicalPass')size.set(r*1.2/.30,h*.52/.30,r*1.2/.30);
    else{
      const radius=r*(kind==='stun'?.8:kind==='poison'?.95:1.0);
      at.x+=Math.cos(a)*radius;at.z+=Math.sin(a)*radius;
      if(kind==='burn'||kind==='heat'){at.y=body.footY+h*(.13+wave*.23);size.set(Math.max(r*2.1,feature/.19),h*(.80+wave*.18),Math.max(r*2.1,feature/.19));}
      else if(kind==='poison'){at.y=body.footY+h*(.28+wave*.24);size.setScalar(Math.max(r*2.9,feature/.18)*(.9+wave*.12));}
      else if(kind==='stun'){at.y=body.top+Math.max(.25,feature)+wave*.05;size.setScalar(Math.max(h*.15,feature*1.3)/.105);}
      else if(kind==='bleed'){at.y=body.footY+h*(.7-wave*.45);size.setScalar(Math.max(h*.075,feature)/.052);}
      else if(kind==='armor'){at.y=body.footY+h*(.7-wave*.25);size.setScalar(Math.max(h*.18,feature*1.4)/.13);}
    }
    this.put(kind,at,size,kind==='slow'?clock*.3+enemy.id:a);
  }
  sync(enemies,{states=new Map(),figures=new Map(),time=this.time,heatTargets=new Set()}={}){
    if(this.disposed)return;this.time=finite(time,this.time);this.count=0;this.targets.clear();
    for(const batch of this.batches.values())batch.count=0;
    const clock=this.still()?0:this.time,visible=enemies.filter(e=>!e.dead&&this.isVisible(e)!==false),live=new Set(visible),rows=[];
    for(const enemy of visible){
      const effects=new Set((states.get(enemy.id)||[]).map(e=>e.key)),body=this.envelope(enemy,figures),kinds=[];
      // Reconciled AFTER the simulation step: an impact never establishes infection.
      for(const kind of persistentKinds)if(effects.has(kind)&&!(kind==='slow'&&['freeze','stun','root','petrify'].some(key=>effects.has(key))))kinds.push(kind);
      if(heatTargets.has(enemy.id)&&!kinds.includes('heat'))kinds.push('heat');
      if(kinds.length)this.targets.set(enemy.id,kinds);
      for(let layer=0;layer<kinds.length;layer++)rows.push({kind:kinds[layer],enemy,body,layer});
    }
    // Give active states their first marker before spending the bounded budget
    // on extra flames/bubbles. Crowds cannot be monopolized by one infection.
    // Visit each target before its additional simultaneous conditions as well.
    // A heavily affected front enemy must not hide the back of a full wave.
    rows.sort((a,b)=>a.layer-b.layer);
    for(const row of rows)this.status(row.kind,row.enemy,row.body,clock,0);
    for(let index=1;index<3&&this.count<this.maxInstances;index++)for(const row of rows)if(index<(STYLES[row.kind].particles||1))this.status(row.kind,row.enemy,row.body,clock,index);
    for(const [key,row]of this.pulses){
      const age=this.time-row.at;
      if(age>=row.duration||age<0||!live.has(row.enemy)){this.pulses.delete(key);continue;}
      const centre=this.centre(row.enemy,figures),p=age/row.duration;
      if(row.kind==='flash'){
        const size=this.still()?.26:.22+(1-p)*.26;
        this.put('flash',centre,new THREE.Vector3(size,size,size),0,row.color);
      }else for(let i=0;i<3;i++){
        const a=i*Math.PI*2/3+row.enemy.id,at=centre.clone().add(new THREE.Vector3(Math.cos(a)*.23,(this.still()?0:p*.35),Math.sin(a)*.23));
        this.put('heal',at,new THREE.Vector3(1,1,1),0,row.color);
      }
    }
    for(const batch of this.batches.values()){batch.visible=batch.count>0;batch.instanceMatrix.needsUpdate=true;if(batch.instanceColor)batch.instanceColor.needsUpdate=true;}
  }
  clear(){this.pulses.clear();this.targets.clear();this.count=0;for(const batch of this.batches.values()){batch.count=0;batch.visible=false;}}
  dispose(){if(this.disposed)return;this.clear();for(const batch of this.batches.values()){batch.geometry.dispose();batch.material.dispose();batch.dispose();batch.removeFromParent();}this.batches.clear();this.disposed=true;}
}

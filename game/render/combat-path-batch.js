import * as THREE from 'three';

const up=new THREE.Vector3(0,1,0),pose=new THREE.Object3D();
const seedNumber=seed=>Number.isFinite(Number(seed))?Number(seed):[...String(seed)].reduce((n,c)=>n*31+c.charCodeAt(0),0)%997;

/** Smooth geometry, one release pulse, and no screen-wide light or strobe. */
export const electricPulse=(progress=0,motion=true)=>motion?.62+.38*Math.exp(-Math.max(0,progress)*9):.8;
export function electricPathSegments(from,to,{seed=0,clock=0,motion=true}={}){
  seed=seedNumber(seed);const delta=new THREE.Vector3().subVectors(to,from),side=new THREE.Vector3(delta.z,0,-delta.x);
  if(side.lengthSq()<1e-8)side.set(1,0,0);else side.normalize();
  const points=[],segments=[],phase=motion?clock*2.4:0,amplitude=Math.min(.24,.06+delta.length()*.018);
  for(let i=0;i<10;i++){const t=i/9,envelope=Math.sin(t*Math.PI);points.push(from.clone().addScaledVector(delta,t).addScaledVector(side,Math.sin(i*9.17+seed+phase)*amplitude*envelope).add(new THREE.Vector3(0,Math.cos(i*4.6+seed+phase)*amplitude*.6*envelope,0)));if(i)segments.push([points[i-1],points[i]]);}
  for(const [index,sign]of [[3,-1],[5,1],[7,-1]]){
    const a=points[index],b=a.clone().addScaledVector(delta,.08).addScaledVector(side,sign*Math.min(.65,.2+delta.length()*.035));
    b.y+=.10;const middle=a.clone().lerp(b,.5).addScaledVector(side,-sign*.07);segments.push([a,middle],[middle,b]);
  }
  return {points,segments};
}
export function electricRadius(from,to,camera=null,viewportHeight=720){
  const middle=from.clone().add(to).multiplyScalar(.5),height=Math.max(1,viewportHeight||720);
  const pixel=camera?.isPerspectiveCamera?2*middle.distanceTo(camera.position)*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/height:camera?.isOrthographicCamera?(camera.top-camera.bottom)/Math.max(.001,camera.zoom)/height:.035;
  return Math.max(.022,Math.min(.14,pixel*.72));
}

/** Typed, bounded instancing keeps actual weapon shapes during busy waves. */
export class CombatPathBatch{
  constructor(scene,{capacity=4096,camera=null,getViewport=null}={}){
    this.scene=scene;this.capacity=capacity;this.camera=camera;this.getViewport=getViewport;this.records=[];this.object=null;this.disposed=false;this.batches=new Map();this.geometries=new Map();
  }
  batch(key,count){
    let row=this.batches.get(key);if(row&&row.capacity>=count)return row;
    const capacity=Math.min(this.capacity*32,Math.max(32,2**Math.ceil(Math.log2(Math.max(1,count)))));
    const geometry=this.geometries.get(key)|| (key==='heads'?new THREE.ConeGeometry(1,1,4):key==='bodies'?new THREE.IcosahedronGeometry(1,0):new THREE.CylinderGeometry(1,1,1,4));this.geometries.set(key,geometry);
    const material=row?.object.material||new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:key==='corona'?.36:key==='core'?.98:.86,depthWrite:false,blending:THREE.NormalBlending,toneMapped:false});
    if(row){row.object.dispose();row.object.removeFromParent();}
    const object=new THREE.InstancedMesh(geometry,material,capacity);object.name=`Overflow weapon ${key}`;object.raycast=()=>{};object.frustumCulled=false;object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.object.add(object);
    row={object,capacity};this.batches.set(key,row);return row;
  }
  sync(paths){
    if(this.disposed)return;this.records=paths.slice(0,this.capacity);
    if(!this.object&&!this.records.length)return;
    if(!this.object){this.object=new THREE.Group();this.object.name='Actual typed overflow projectile and proc paths';this.scene.add(this.object);}
    const draw={shafts:[],heads:[],bodies:[],core:[],corona:[]},camera=typeof this.camera==='function'?this.camera():this.camera,height=this.getViewport?.()?.height;
    const segment=(key,a,b,r,color)=>draw[key].push({a,b,r,color});
    const body=(at,r,color,scale=null)=>draw.bodies.push({at,r,color,scale});
    const arc=(at,radius,width,color,angle=Math.PI*1.5,tilt=0)=>{for(let i=0;i<9;i++){const p=i/9*angle+tilt,q=(i+1)/9*angle+tilt;segment('shafts',at.clone().add(new THREE.Vector3(Math.cos(p)*radius,Math.sin(p)*radius,0)),at.clone().add(new THREE.Vector3(Math.cos(q)*radius,Math.sin(q)*radius,0)),width,color);}};
    for(const packet of this.records){
      const {from,to,color='#e6dfc8',kind='arrow',motion=true,clock=0,seed=0,progress=0}=packet,delta=to.clone().sub(from),direction=delta.clone().normalize();
      const lightning=['lightning','stormSpear'].includes(kind),r=electricRadius(from,to,camera,height);
      if(kind==='fire-splash'){
        const reach=Math.max(.01,packet.radius||0)*(motion?.24+.76*Math.sin(Math.min(1,progress*1.8)*Math.PI*.5):.75),fade=Math.max(0,1-progress),tint=new THREE.Color('#ff8d27').multiplyScalar(.6+.4*fade);
        if(packet.eruption!==false)for(let i=0;i<6;i++){const a=i*Math.PI/3,end=to.clone().add(new THREE.Vector3(Math.cos(a)*reach,.12,Math.sin(a)*reach));segment('corona',to,end,Math.max(.025,reach*.10),tint);segment('core',to,to.clone().lerp(end,.56),Math.max(.012,reach*.035),new THREE.Color('#ffd68a').multiplyScalar(.65+.35*fade));}
        for(const at of packet.victims||[])body(at,.075*fade,'#ffab4f',new THREE.Vector3(.7,1.6,.7));continue;
      }
      if(lightning){const pulse=electricPulse(progress,motion),electric=electricPathSegments(from,to,{seed,clock,motion}),coronaColor=new THREE.Color(color);if(coronaColor.b>coronaColor.r*.9)coronaColor.lerp(new THREE.Color('#268fe8'),.55);for(const[a,b]of electric.segments){segment('corona',a,b,r*3.0,coronaColor);segment('core',a,b,r*.68,new THREE.Color('#f4fdff').multiplyScalar(pulse));}continue;}
      if(kind==='flame'){
        // Sparse broken tongues preserve a cone instead of falling back to an opaque laser.
        const side=new THREE.Vector3(delta.z,0,-delta.x).normalize();
        for(let lane=0;lane<3;lane++)for(let i=0;i<6;i++){const a=i/6,b=Math.min(1,a+.14),phase=motion?clock*5:0,shift=(lane-1)*.12*a+Math.sin(i*2.7+phase+lane)*.035*a,start=from.clone().addScaledVector(delta,a).addScaledVector(side,shift),end=from.clone().addScaledVector(delta,b).addScaledVector(side,shift*1.1);segment('corona',start,end,.025+a*.12,lane%2?'#e45c17':'#ff8e27');if(lane===1&&i<4)segment('core',start,end,.018+a*.04,'#ffe2a1');}
        continue;
      }
      if(kind==='siege'&&packet.subtype==='catapult-stone'){body(to,.17,'#929286',new THREE.Vector3(1,.83,1.13));continue;}
      if(['arrow','venomArrow','siege','dart','bullet','bulletRapid','shell'].includes(kind)){
        const length=['bullet','bulletRapid'].includes(kind)?.30:kind==='shell'?.24:kind==='siege'?.95:.48,start=to.clone().addScaledVector(direction,-Math.min(length,delta.length()));
        segment('shafts',start,to,['bullet','bulletRapid'].includes(kind)?.018:.023,kind==='arrow'||kind==='siege'?'#d4bd8f':color);
        if(!['bullet','bulletRapid'].includes(kind))draw.heads.push({a:to.clone().addScaledVector(direction,-.06),b:to.clone().addScaledVector(direction,.05),r:kind==='shell'?.07:kind==='siege'?.08:.045,color:kind==='venomArrow'?color:'#c7ced0'});
        if(['arrow','venomArrow','siege'].includes(kind)){const side=new THREE.Vector3(direction.z,0,-direction.x).normalize().multiplyScalar(kind==='siege'?.075:.045),tail=start.clone().lerp(to,.16);segment('shafts',tail.clone().sub(side),tail.clone().add(side),.010,'#dedecf');}
        if(['bullet','bulletRapid'].includes(kind))segment('core',start,to,.014,color);
        if(packet.style?.element==='lightning'){const electric=electricPathSegments(start,to,{seed,clock,motion});for(const[a,b]of electric.segments){segment('corona',a,b,.045,color);segment('core',a,b,.012,'#f4fdff');}}
        continue;
      }
      if(['grenade','cannon','stone','forge'].includes(kind)){body(to,kind==='cannon'?.145:kind==='stone'?.17:.10,kind==='cannon'?'#59636b':kind==='stone'?'#929286':kind==='grenade'?'#394247':'#6a7478');if(kind==='grenade')segment('shafts',to.clone().add(new THREE.Vector3(0,.11,0)),to.clone().add(new THREE.Vector3(.015,.21,0)),.012,'#d1b77b');if(kind==='forge')segment('core',to.clone().add(new THREE.Vector3(0,-.07,-.07)),to.clone().add(new THREE.Vector3(0,.07,.07)),.012,'#ffad52');continue;}
      if(['melee','axe','pick','claw','treeSlam','hammer','thrust'].includes(kind)){
        if(progress<.72&&!packet.ricochet)continue;const end=packet.target||to;
        if(kind==='thrust'){segment('shafts',end.clone().addScaledVector(direction,-.24),end.clone().addScaledVector(direction,.14),.020,color);draw.heads.push({a:end,b:end.clone().addScaledVector(direction,.12),r:.04,color});}
        else if(kind==='melee'||kind==='axe')arc(end,.25,kind==='axe'?.045:.018,color,Math.PI*.9,-.7);
        else if(kind==='claw')for(let i=0;i<3;i++)arc(end.clone().add(new THREE.Vector3((i-1)*.07,0,0)),.13,.012,color,Math.PI*.75,-.8);
        else if(kind==='hammer'){arc(end,.15,.020,color,Math.PI*1.65);body(end,.06,'#b9bdb8');}
        else if(kind==='treeSlam')for(let i=0;i<3;i++)body(end.clone().add(new THREE.Vector3(Math.sin(i*2)*.13,Math.cos(i*2)*.10,0)),.045,i%2?'#8d794f':'#5f723e');
        else segment('shafts',end.clone().add(new THREE.Vector3(-.09,.14,0)),end.clone().add(new THREE.Vector3(.06,-.07,0)),.022,color);continue;
      }
      if(kind==='web'){for(let i=0;i<8;i++){const p=i/8,q=(i+1)/8,a=from.clone().lerp(to,p),b=from.clone().lerp(to,q);a.y-=Math.sin(p*Math.PI)*.07;b.y-=Math.sin(q*Math.PI)*.07;segment('shafts',a,b,.008,color);}continue;}
      if(kind==='moon'){arc(to,.13,.020,color,Math.PI*1.4);continue;}
      if(kind==='drum'){for(let i=0;i<3;i++)arc(to.clone().addScaledVector(direction,-i*.09),.15+i*.05,.010,color,Math.PI*1.65,i*.3);continue;}
      if(kind==='runic'){for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,b=(i+1)*Math.PI/2+Math.PI/4;segment('shafts',to.clone().add(new THREE.Vector3(Math.cos(a)*.13,Math.sin(a)*.13,0)),to.clone().add(new THREE.Vector3(Math.cos(b)*.13,Math.sin(b)*.13,0)),.014,color);}body(to,.055,color);continue;}
      if(kind==='frost'){for(let i=0;i<3;i++){const at=to.clone().add(new THREE.Vector3(Math.sin(i*2)*.06,Math.cos(i*2)*.06,-.04));draw.heads.push({a:at,b:at.clone().addScaledVector(direction,.19),r:.04,color});}continue;}
      if(kind==='roots'){body(to,.075,color,new THREE.Vector3(.7,1.15,1));for(const s of [-1,1])body(to.clone().add(new THREE.Vector3(s*.07,0,0)),.06,'#719848',new THREE.Vector3(.4,1.2,.6));continue;}
      body(to,.075,color);arc(to,.14,.009,color,Math.PI*1.4);if(kind==='holy')for(let i=0;i<4;i++){const a=i*Math.PI/2;segment('shafts',to.clone().add(new THREE.Vector3(Math.cos(a)*.16,Math.sin(a)*.16,0)),to.clone().add(new THREE.Vector3(Math.cos(a)*.22,Math.sin(a)*.22,0)),.008,color);}
    }
    for(const[key,instances]of Object.entries(draw)){
      const prior=this.batches.get(key);if(!instances.length){if(prior){prior.object.count=0;prior.object.visible=false;}continue;}
      const {object}=this.batch(key,instances.length);object.count=instances.length;object.visible=true;
      instances.forEach((item,index)=>{if(item.at){pose.position.copy(item.at);pose.quaternion.identity();pose.scale.copy(item.scale||up.clone().set(1,1,1)).multiplyScalar(item.r);}else{const delta=item.b.clone().sub(item.a),length=delta.length();pose.position.copy(item.a).add(item.b).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(up,length>1e-8?delta.multiplyScalar(1/length):up);pose.scale.set(item.r,Math.max(.001,length),item.r);}pose.updateMatrix();object.setMatrixAt(index,pose.matrix);object.setColorAt(index,new THREE.Color(item.color));});
      object.instanceMatrix.needsUpdate=true;if(object.instanceColor)object.instanceColor.needsUpdate=true;
    }
    this.object.visible=this.records.length>0;
  }
  clear(){this.records=[];if(this.object){for(const {object}of this.batches.values()){object.count=0;object.visible=false;}this.object.visible=false;}}
  dispose(){if(this.disposed)return;this.clear();for(const {object}of this.batches.values()){object.dispose();object.material.dispose();}for(const geometry of this.geometries.values())geometry.dispose();this.object?.removeFromParent();this.batches.clear();this.geometries.clear();this.disposed=true;}
}

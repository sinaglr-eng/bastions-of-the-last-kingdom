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
    const capacity=Math.min(this.capacity*15,Math.max(32,2**Math.ceil(Math.log2(Math.max(1,count)))));
    const geometry=this.geometries.get(key)|| (key==='heads'?new THREE.ConeGeometry(1,1,4):key==='bodies'?new THREE.IcosahedronGeometry(1,0):new THREE.CylinderGeometry(1,1,1,4));this.geometries.set(key,geometry);
    const material=row?.object.material||new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:key==='corona'?.34:key==='core'?.98:.86,depthWrite:false,blending:key==='core'?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false});
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
    const body=(at,r,color)=>draw.bodies.push({at,r,color});
    for(const packet of this.records){
      const {from,to,color='#e6dfc8',kind='arrow',motion=true,clock=0,seed=0,progress=0}=packet,delta=to.clone().sub(from),direction=delta.clone().normalize();
      const lightning=['lightning','stormSpear'].includes(kind),r=electricRadius(from,to,camera,height);
      if(lightning){const pulse=electricPulse(progress,motion),electric=electricPathSegments(from,to,{seed,clock,motion}),coronaColor=new THREE.Color(color);if(coronaColor.b>coronaColor.r*.9)coronaColor.lerp(new THREE.Color('#268fe8'),.55);for(const[a,b]of electric.segments){segment('corona',a,b,r*3.0,coronaColor);segment('core',a,b,r*.68,new THREE.Color('#f4fdff').multiplyScalar(pulse));}continue;}
      if(kind==='flame'){segment('corona',from,to,Math.max(.08,r*3),'#ff791f');segment('core',from,to,Math.max(.035,r),'#ffd787');body(to,.12,'#ff9c3d');continue;}
      if(['arrow','venomArrow','siege','dart','bullet','bulletRapid','shell'].includes(kind)){
        const length=['bullet','bulletRapid'].includes(kind)?.30:kind==='shell'?.24:.48,start=to.clone().addScaledVector(direction,-Math.min(length,delta.length()));
        segment('shafts',start,to,['bullet','bulletRapid'].includes(kind)?.018:.023,kind==='arrow'||kind==='siege'?'#d4bd8f':color);
        if(!['bullet','bulletRapid'].includes(kind))draw.heads.push({a:to.clone().addScaledVector(direction,-.06),b:to.clone().addScaledVector(direction,.05),r:kind==='shell'?.07:.055,color});
        if(['bullet','bulletRapid'].includes(kind))segment('core',start,to,.014,color);
        if(packet.style?.element==='lightning'){const electric=electricPathSegments(start,to,{seed,clock,motion});for(const[a,b]of electric.segments){segment('corona',a,b,.045,color);segment('core',a,b,.012,'#f4fdff');}}
        continue;
      }
      if(['grenade','cannon','stone','forge'].includes(kind)){body(to,kind==='cannon'?.13:.10,kind==='cannon'?'#6e7479':color);continue;}
      if(['melee','axe','pick','claw','treeSlam','hammer','thrust'].includes(kind)){
        const end=packet.target||to,a=end.clone().add(new THREE.Vector3(-.18,0,-.12)),b=end.clone().add(new THREE.Vector3(.18,.12,.12));segment('shafts',a,b,.035,color);if(['hammer','treeSlam'].includes(kind))body(end,.10,color);else segment('shafts',a.clone().add(new THREE.Vector3(0,.08,.19)),b.clone().add(new THREE.Vector3(0,-.08,-.19)),.021,color);continue;
      }
      if(kind==='web'){segment('shafts',from,to,.012,color);continue;}
      // Spell beads and rune crescents remain local to the real projectile;
      // the overflow path never turns them into an unrelated physical arrow.
      body(to,kind==='moon'?.10:.08,color);if(kind==='drum')body(to,.15,color);
    }
    for(const[key,instances]of Object.entries(draw)){
      const prior=this.batches.get(key);if(!instances.length){if(prior){prior.object.count=0;prior.object.visible=false;}continue;}
      const {object}=this.batch(key,instances.length);object.count=instances.length;object.visible=true;
      instances.forEach((item,index)=>{if(item.at){pose.position.copy(item.at);pose.quaternion.identity();pose.scale.setScalar(item.r);}else{const delta=item.b.clone().sub(item.a),length=delta.length();pose.position.copy(item.a).add(item.b).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(up,length>1e-8?delta.multiplyScalar(1/length):up);pose.scale.set(item.r,Math.max(.001,length),item.r);}pose.updateMatrix();object.setMatrixAt(index,pose.matrix);object.setColorAt(index,new THREE.Color(item.color));});
      object.instanceMatrix.needsUpdate=true;if(object.instanceColor)object.instanceColor.needsUpdate=true;
    }
    this.object.visible=this.records.length>0;
  }
  clear(){this.records=[];if(this.object){for(const {object}of this.batches.values()){object.count=0;object.visible=false;}this.object.visible=false;}}
  dispose(){if(this.disposed)return;this.clear();for(const {object}of this.batches.values()){object.dispose();object.material.dispose();}for(const geometry of this.geometries.values())geometry.dispose();this.object?.removeFromParent();this.batches.clear();this.geometries.clear();this.disposed=true;}
}

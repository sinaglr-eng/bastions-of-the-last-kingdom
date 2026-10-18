import * as THREE from 'three';

const finite=(n,f=0)=>Number.isFinite(n)?n:f;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const STYLES={
  poison:{color:'#71ab53',opacity:.16,shape:'cloud'},
  burn:{color:'#ffa14b',opacity:.65,shape:'flame'},
  slow:{color:'#7ccfda',opacity:.38,shape:'wind'},
  freeze:{color:'#ffe5a1',opacity:.7,shape:'star'},
  petrify:{color:'#aeb6a3',opacity:.16,shape:'stone'},
  armor:{color:'#e5bd79',opacity:.5,shape:'flake'},
  heat:{color:'#ee994d',opacity:.26,shape:'flame'},
  heal:{color:'#a3ecc0',opacity:.55,shape:'mote'},
  flash:{color:'#d2efff',opacity:.42,shape:'flash'},
};
const geometryFor=shape=>shape==='wind'?new THREE.TorusGeometry(1,.018,3,18,Math.PI*1.45):shape==='flash'?new THREE.RingGeometry(.55,1,16):shape==='flame'?new THREE.ConeGeometry(.12,.32,4):shape==='flake'?new THREE.OctahedronGeometry(.065,0):shape==='stone'?new THREE.IcosahedronGeometry(1,0):shape==='star'?new THREE.OctahedronGeometry(.075,0):new THREE.IcosahedronGeometry(shape==='cloud'?.20:.045,0);

/** One bounded, separately owned composite per visible target. No combat writes. */
export class CombatStatusVfx{
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x,y,z),targetHeight=()=>1,isVisible=()=>true,reducedMotion=false,getTime=null,maxInstances=256}={}){
    this.scene=scene;this.position=position;this.targetHeight=targetHeight;this.isVisible=isVisible;this.reducedMotion=reducedMotion;this.getTime=getTime;this.maxInstances=Math.max(1,Math.floor(maxInstances));
    this.batches=new Map();this.pulses=new Map();this.targets=new Map();this.pose=new THREE.Object3D();this.disposed=false;this.count=0;this.time=0;
  }
  still(){return typeof this.reducedMotion==='function'?this.reducedMotion():this.reducedMotion;}
  batch(kind){
    if(this.batches.has(kind))return this.batches.get(kind);
    const style=STYLES[kind],object=new THREE.InstancedMesh(geometryFor(style.shape),new THREE.MeshBasicMaterial({color:style.color,transparent:true,opacity:style.opacity,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,wireframe:kind==='petrify'}),this.maxInstances);
    object.name='Actual target '+kind;object.raycast=()=>{};object.frustumCulled=false;object.count=0;object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(object);this.batches.set(kind,object);return object;
  }
  pulse(kind,enemy,{amount=1,color}={}){
    if(this.disposed||!enemy||this.isVisible(enemy)===false||!(amount>0))return;
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
  centre(enemy,figures){
    const figure=figures?.get(enemy.id);
    if(figure?.userData.body){figure.updateWorldMatrix(true,false);return figure.localToWorld(new THREE.Vector3(0,(figure.userData.barHeight||1.3)*.43,0));}
    return this.position(enemy.x,this.targetHeight(enemy),enemy.z);
  }
  put(kind,centre,scale,angle=0,color=null){
    if(this.count>=this.maxInstances)return false;
    const batch=this.batch(kind),index=batch.count++;
    this.pose.position.copy(centre);this.pose.rotation.set(kind==='slow'||kind==='flash'?-Math.PI/2:0,angle,kind==='freeze'?angle:0);this.pose.scale.copy(scale);this.pose.updateMatrix();batch.setMatrixAt(index,this.pose.matrix);
    batch.setColorAt(index,new THREE.Color(color||STYLES[kind].color));this.count++;return true;
  }
  sync(enemies,{states=new Map(),figures=new Map(),time=this.time,heatTargets=new Set()}={}){
    if(this.disposed)return;this.time=finite(time,this.time);this.count=0;this.targets.clear();
    for(const batch of this.batches.values())batch.count=0;
    const clock=this.still()?0:this.time,visible=enemies.filter(e=>!e.dead&&this.isVisible(e)!==false);
    for(const enemy of visible){
      const effects=new Set((states.get(enemy.id)||[]).map(e=>e.key)),centre=this.centre(enemy,figures),scale=clamp(finite(figures.get(enemy.id)?.scale?.y,1),.5,1.35),kinds=[];
      // Reconciled AFTER the simulation step: an impact never establishes infection.
      for(const kind of ['poison','burn','petrify','freeze','slow','armor'])if(effects.has(kind)&&!(kind==='slow'&&(effects.has('freeze')||effects.has('petrify'))))kinds.push(kind);
      if(heatTargets.has(enemy.id))kinds.push('heat');
      if(kinds.length)this.targets.set(enemy.id,kinds);
      for(const kind of kinds){
        const base=centre.clone();
        if(kind==='petrify'){this.put(kind,base,new THREE.Vector3(.36*scale,.65*scale,.36*scale));continue;}
        if(kind==='slow'){base.y-=.21*scale;this.put(kind,base,new THREE.Vector3(.38*scale,.38*scale,.38*scale),clock*.35+enemy.id);continue;}
        const total=kind==='poison'?2:kind==='freeze'?3:2;
        for(let i=0;i<total;i++){
          const a=enemy.id*.73+i*Math.PI*2/total+clock*(kind==='poison'?.28:.45),r=(kind==='poison'?.23:.25)*scale;
          const at=base.clone().add(new THREE.Vector3(Math.cos(a)*r,(kind==='freeze'?.55:-.04)+Math.sin(clock*.8+i)*.06,Math.sin(a)*r));
          this.put(kind,at,new THREE.Vector3(scale,scale,scale),a);
        }
      }
    }
    for(const [key,row]of this.pulses){
      const age=this.time-row.at;
      if(age>=row.duration||age<0||this.isVisible(row.enemy)===false||row.enemy.dead){this.pulses.delete(key);continue;}
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

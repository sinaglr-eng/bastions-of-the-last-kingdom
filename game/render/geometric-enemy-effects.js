import * as THREE from 'three';

const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const noPick=()=>{};
const styles=Object.freeze({armor:'#bfd0d9',physicalImmune:'#fff0bd',magicImmune:'#cda8ff',magic:'#b59df5',fire:'#ffac64',frost:'#8be2f1',poison:'#a1d975',holy:'#fff3b5',arcane:'#c8a6ff',refraction:'#9aedeb',reactive:'#f1c17b',regen:'#91d978',recharge:'#6adcca'});

// These symbols describe actual defenses, independently of wave-colour auras
// and existing positive/negative support bands. No effect changes combat data.
export function enemyDefenseVisualState(enemy){
  if(!enemy||enemy.dead)return [];
  const states=[],resists=enemy.resists||{};
  const armor=Math.max(0,finite(enemy.armor)+finite(enemy.reactiveArmor)*finite(enemy.reactiveStacks)-finite(enemy.armorShred));
  if(enemy.physicalImmune)states.push({kind:'physicalImmune',amount:1});
  else if(armor>0)states.push({kind:enemy.reactiveStacks>0?'reactive':'armor',amount:clamp(armor/30,.15,1)});
  if(enemy.magicImmune)states.push({kind:'magicImmune',amount:1});
  else{
    const common=finite(resists.magic)+finite(enemy.ward)-finite(enemy.magicShred),magic=clamp(common,0,.85);
    if(magic>0)states.push({kind:'magic',amount:magic});
    for(const kind of ['fire','frost','poison','holy','arcane']){
      const typed=finite(resists[kind]),effective=clamp(common+typed,0,.85);
      if(typed>0&&effective>0)states.push({kind,amount:effective});
    }
  }
  if(enemy.refraction&&enemy.shields>0)states.push({kind:'refraction',amount:clamp(enemy.shields,0,8),count:clamp(Math.floor(enemy.shields),0,8)});
  if(enemy.regen&&!enemy.statuses?.healBlock)states.push({kind:'regen',amount:1});
  if(enemy.recharge&&!enemy.statuses?.healBlock&&enemy.rechargeClock>7.25)states.push({kind:'recharge',amount:1});
  return states;
}
function lineGlyph(kind){
  const shield=[[-.12,.12],[.12,.12],[.10,-.055],[0,-.15],[-.10,-.055],[-.12,.12]];
  const rune=[[-.14,0],[0,.16],[.14,0],[0,-.16],[-.14,0]];
  const paths=kind==='armor'||kind==='physicalImmune'||kind==='reactive'?[shield]:kind==='regen'||kind==='recharge'?[[[-.13,0],[.13,0]],[[0,-.13],[0,.13]]]:[rune,[[-.085,0],[.085,0]],[[0,-.095],[0,.095]]];
  if(kind.endsWith('Immune'))paths.push([[-.12,-.14],[.12,.14]]);
  const vertices=[];
  for(const path of paths)for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,w=.015;
    const nx=-dy/length*w,ny=dx/length*w;
    vertices.push(a[0]+nx,a[1]+ny,0,a[0]-nx,a[1]-ny,0,b[0]+nx,b[1]+ny,0,b[0]+nx,b[1]+ny,0,a[0]-nx,a[1]-ny,0,b[0]-nx,b[1]-ny,0);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}
function effectMaterial(color,opacity=.72){return new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});}
function dispose(root){
  const resources=new Set();root.traverse(node=>{if(node.geometry)resources.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:[node.material])if(m)resources.add(m);if(node.isInstancedMesh)node.dispose();});resources.forEach(resource=>resource.dispose());root.removeFromParent();
}

export class EnemyAbilityEffects{
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x,y,z),isVisible=()=>true,reducedMotion=false,maxEnemies=256,maxEffects=48}={}){
    this.scene=scene;this.position=position;this.isVisible=isVisible;this.reducedMotion=reducedMotion;this.maxEnemies=Math.max(1,Math.floor(maxEnemies));this.maxEffects=Math.max(1,Math.floor(maxEffects));
    this.group=new THREE.Group();this.group.name='Enemy defenses and rifts';scene.add(this.group);this.batches=new Map();this.effects=[];this.measurements=new WeakMap();this.disposed=false;this.pose=new THREE.Object3D();this.up=new THREE.Vector3(0,1,0);
  }
  still(){return typeof this.reducedMotion==='function'?!!this.reducedMotion():!!this.reducedMotion;}
  batch(kind){
    if(this.batches.has(kind))return this.batches.get(kind);
    const root=new THREE.Group();root.name='Defense: '+kind;
    const ring=new THREE.InstancedMesh(new THREE.RingGeometry(.88,1,24,1,0,Math.PI*1.6),effectMaterial(styles[kind],.50),this.maxEnemies);
    const glyph=new THREE.InstancedMesh(lineGlyph(kind),effectMaterial(styles[kind],.78),this.maxEnemies);
    const crystals=kind==='refraction'?new THREE.InstancedMesh(new THREE.OctahedronGeometry(.09),effectMaterial(styles[kind],.62),this.maxEnemies*8):null;
    for(const object of [ring,glyph,crystals].filter(Boolean)){object.count=0;object.raycast=noPick;object.frustumCulled=false;object.renderOrder=3;root.add(object);}
    this.group.add(root);const batch={root,ring,glyph,crystals,count:0,crystalCount:0};this.batches.set(kind,batch);return batch;
  }
  measure(figure){
    if(!figure?.userData.body)return {height:1.5,radius:.38};
    if(this.measurements.has(figure))return this.measurements.get(figure);
    const bounds=new THREE.Box3().setFromObject(figure.userData.body,true),size=bounds.getSize(new THREE.Vector3());
    const measure={height:clamp(size.y,.4,12),radius:clamp(Math.min(size.x,size.z)*.62,.28,1.4)};this.measurements.set(figure,measure);return measure;
  }
  sync(enemies,figures=new Map(),time=0){
    if(this.disposed)return;
    for(const batch of this.batches.values()){batch.count=0;batch.crystalCount=0;}
    const clock=this.still()?0:Math.max(0,finite(time));let count=0;
    for(const enemy of enemies){
      if(enemy.dead||!this.isVisible(enemy)||count>=this.maxEnemies)continue;
      count++;const figure=figures.get(enemy.id),measure=this.measure(figure),states=enemyDefenseVisualState(enemy);
      for(let i=0;i<states.length;i++){
        const state=states[i],batch=this.batch(state.kind),index=batch.count++;if(index>=this.maxEnemies){batch.count=this.maxEnemies;continue;}
        const radius=measure.radius*(1+i*.075),y=enemy.flying?(figure?.position.y??.8)+measure.height*.30:.055+i*.011;
        this.pose.position.copy(this.position(enemy.x,y,enemy.z));this.pose.rotation.set(-Math.PI/2,0,clock*.20+finite(enemy.id)*.71+i*.8);this.pose.scale.set(radius,radius,1);this.pose.updateMatrix();batch.ring.setMatrixAt(index,this.pose.matrix);
        this.pose.position.copy(this.position(enemy.x+measure.radius*.8,Math.max(.3,(figure?.position.y||0)+measure.height*(.42+i*.085)),enemy.z-measure.radius*.74));this.pose.rotation.set(0,Math.PI/4,0);this.pose.scale.setScalar(.86+state.amount*.18);this.pose.updateMatrix();batch.glyph.setMatrixAt(index,this.pose.matrix);
        if(batch.crystals&&!figure?.userData.shards)for(let n=0;n<state.count;n++){
          const angle=n*Math.PI*2/Math.max(1,state.count)+clock*.32;
          this.pose.position.copy(this.position(enemy.x+Math.cos(angle)*measure.radius,(figure?.position.y||0)+measure.height*.44+Math.sin(clock*2+n)*.045,enemy.z+Math.sin(angle)*measure.radius));this.pose.rotation.set(0,angle,0);this.pose.scale.set(1,1.45,1);this.pose.updateMatrix();batch.crystals.setMatrixAt(batch.crystalCount++,this.pose.matrix);
        }
      }
    }
    for(const batch of this.batches.values()){
      batch.root.visible=batch.count>0;
      for(const object of [batch.ring,batch.glyph]){object.count=batch.count;object.instanceMatrix.needsUpdate=true;}
      if(batch.crystals){batch.crystals.count=batch.crystalCount;batch.crystals.instanceMatrix.needsUpdate=true;}
    }
  }
  event(type,payload={}){
    if(this.disposed)return;
    if(type==='teleport'&&payload.enemy&&payload.visible!==false&&this.isVisible(payload.enemy)&&payload.from&&payload.to)this.teleport(payload);
    if(type==='deflect'&&payload.enemy&&this.isVisible(payload.enemy))this.deflection(payload.enemy);
  }
  add(object,duration,animate,target){
    if(this.effects.length>=this.maxEffects)this.remove(this.effects[0]);
    object.traverse(node=>node.raycast=noPick);this.group.add(object);const record={object,duration,elapsed:0,animate,target};this.effects.push(record);animate(object,0,this.still());return record;
  }
  remove(record){const index=this.effects.indexOf(record);if(index<0)return;this.effects.splice(index,1);dispose(record.object);}
  teleport({enemy,from,to}){
    const angle=Math.atan2(to.x-from.x,to.z-from.z),height=enemy.flying?1.05:0;
    for(const [point,arrival] of [[from,false],[to,true]]){
      const root=new THREE.Group();root.name=arrival?'Rift arrival':'Rift departure';root.position.copy(this.position(point.x,height,point.z));root.rotation.y=angle;
      const veil=new THREE.Mesh(new THREE.PlaneGeometry(.9,2.1),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{opacity:{value:1}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 v;uniform float opacity;void main(){float y=sin(v.y*3.14159265),edge=abs(v.x-.5)*2.;float torn=.78+.14*sin(v.y*37.)+.08*sin(v.y*81.);float a=(1.-smoothstep(torn-.15,torn,edge))*y*opacity;vec3 c=mix(vec3(.018,.009,.032),vec3(.54,.18,.87),smoothstep(torn-.24,torn-.10,edge));gl_FragColor=vec4(c,a);}' }));veil.position.y=1.05;root.add(veil);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.45,.018,4,28),effectMaterial('#b875ff',.85));ring.scale.y=2.25;ring.position.y=1.05;root.add(ring);
      this.add(root,.52,(object,p,still)=>{const width=still?1:(arrival?.08+.92*Math.sin(Math.PI*Math.min(1,p*1.5)):Math.sin(p*Math.PI));object.scale.x=Math.max(.05,width);object.children[0].material.uniforms.opacity.value=Math.sin(Math.PI*Math.min(.99,.08+p*.9));object.children[1].material.opacity=.85*(1-p);},enemy);
    }
  }
  deflection(enemy){
    const root=new THREE.Group();root.name='Refraction hit';root.position.copy(this.position(enemy.x,enemy.flying?1.3:.85,enemy.z));
    const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(.54,1),new THREE.MeshBasicMaterial({color:'#b0fff6',transparent:true,opacity:.34,wireframe:true,depthWrite:false,toneMapped:false}));root.add(shell);
    this.add(root,.23,(object,p,still)=>{object.scale.setScalar(still?1:1+p*.32);object.children[0].material.opacity=.34*(1-p);},enemy);
  }
  update(dt){
    if(this.disposed)return;const elapsed=Math.max(0,finite(dt));
    for(const record of [...this.effects]){
      record.elapsed+=elapsed;
      if(record.elapsed>=record.duration||record.target?.dead||!this.isVisible(record.target)){this.remove(record);continue;}
      record.animate(record.object,clamp(record.elapsed/record.duration,0,1),this.still());
    }
  }
  clear(){for(const effect of [...this.effects])this.remove(effect);for(const batch of this.batches.values()){batch.count=0;batch.root.visible=false;batch.ring.count=0;batch.glyph.count=0;if(batch.crystals)batch.crystals.count=0;}}
  dispose(){if(this.disposed)return;this.clear();dispose(this.group);this.batches.clear();this.disposed=true;}
}

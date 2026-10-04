import * as THREE from 'three';
import {ENEMY_DEFENSE_SYMBOLS,enemyDefenseVisualState} from './enemy-defense-symbols.js';
export {enemyDefenseVisualState} from './enemy-defense-symbols.js';

const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const noPick=()=>{};
const styles=Object.fromEntries(Object.entries(ENEMY_DEFENSE_SYMBOLS).map(([kind,symbol])=>[kind,symbol.color]));
const glyphsPerDefense=3,dotsPerDefense=6,goldenFraction=(Math.sqrt(5)-1)/2;

// A wave number, boss flag, flying model or ordinary armor value does not
// describe a special mechanic. Read the spawned variant's real combat fields.
export function hasEnemySpecialMechanic(enemy){
  if(!enemy||enemy.dead)return false;
  if(enemy.physicalImmune||enemy.magicImmune||enemy.stealth||enemy.cloakDaggers||enemy.disarm)return true;
  if(['magic','fire','frost','poison','holy','arcane'].some(kind=>finite(enemy.resists?.[kind])>0)||finite(enemy.ward)>0)return true;
  if(['reactiveArmor','refraction','regen','recharge','evasion','untouchable','krakenShell','blink','thief'].some(kind=>finite(enemy[kind])>0))return true;
  return finite(enemy.rush)>1||finite(enemy.hasteAura)>1;
}

function lineGlyph(kind){
  const paths=ENEMY_DEFENSE_SYMBOLS[kind].paths.map(path=>path.map(([x,y])=>[x/24,y/24]));
  const vertices=[];
  for(const path of paths)for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,w=.085;
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
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x,y,z),isVisible=()=>true,reducedMotion=false,camera=null,balance=null,maxEnemies=256,maxEffects=48}={}){
    this.scene=scene;this.position=position;this.isVisible=isVisible;this.reducedMotion=reducedMotion;this.camera=camera;this.balance=balance;this.maxEnemies=Math.max(1,Math.floor(maxEnemies));this.maxEffects=Math.max(1,Math.floor(maxEffects));
    this.group=new THREE.Group();this.group.name='Enemy defenses and rifts';scene.add(this.group);this.batches=new Map();this.effects=[];this.measurements=new WeakMap();this.disposed=false;this.pose=new THREE.Object3D();this.up=new THREE.Vector3(0,1,0);
    this.cameraQuaternion=new THREE.Quaternion();this.centre=new THREE.Vector3();this.worldBounds=new THREE.Box3();this.shieldBounds=new Map();
  }
  still(){return typeof this.reducedMotion==='function'?!!this.reducedMotion():!!this.reducedMotion;}
  batch(kind){
    if(this.batches.has(kind))return this.batches.get(kind);
    const root=new THREE.Group();root.name='Defense: '+kind;
    const glyph=new THREE.InstancedMesh(lineGlyph(kind),new THREE.MeshBasicMaterial({color:styles[kind],transparent:true,opacity:1,blending:THREE.NormalBlending,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),this.maxEnemies*glyphsPerDefense);
    glyph.name='Small colored defense glyphs';
    const dots=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:styles[kind],transparent:true,opacity:.85,depthTest:false,depthWrite:false,toneMapped:false}),this.maxEnemies*dotsPerDefense);
    dots.name='Matching floating defense dots';
    let crystals=null,shell=null;
    if(kind==='refraction'){
      const shield=new THREE.Shape();shield.moveTo(-.32,.34);shield.lineTo(.32,.34);shield.lineTo(.26,-.12);shield.lineTo(0,-.39);shield.lineTo(-.26,-.12);shield.closePath();
      crystals=new THREE.InstancedMesh(new THREE.ShapeGeometry(shield),new THREE.MeshBasicMaterial({color:styles[kind],transparent:true,opacity:.58,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),this.maxEnemies*8);
      crystals.name='Remaining direct-hit shield charge panels';
      shell=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,8,0,Math.PI*2/3-.025,.06,Math.PI-.12),effectMaterial(styles[kind],.17),this.maxEnemies*8);
      shell.name='Continuous magical shield charge sectors';shell.renderOrder=4;shell.material.depthTest=true;
    }
    for(const object of [glyph,dots,crystals,shell].filter(Boolean)){object.count=0;object.raycast=noPick;object.frustumCulled=false;object.renderOrder=object===shell?4:5;root.add(object);}
    this.group.add(root);const batch={root,glyph,dots,crystals,shell,panels:crystals,count:0,glyphCount:0,dotCount:0,crystalCount:0,shellCount:0};this.batches.set(kind,batch);return batch;
  }
  measure(figure){
    if(!figure?.userData.body)return {height:1.5,radius:.38};
    if(this.measurements.has(figure))return this.measurements.get(figure);
    figure.updateWorldMatrix(true,true);const bounds=new THREE.Box3(),inverse=figure.matrixWorld.clone().invert();
    figure.userData.body.traverse(node=>{const p=node.geometry?.attributes.position;if(!node.isMesh||!p)return;const matrix=new THREE.Matrix4().multiplyMatrices(inverse,node.matrixWorld);for(let i=0;i<p.count;i++)bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));});
    const measure={bounds};this.measurements.set(figure,measure);return measure;
  }
  sync(enemies,figures=new Map(),time=0,{camera,balance}={}){
    if(this.disposed)return;
    for(const batch of this.batches.values()){batch.count=0;batch.glyphCount=0;batch.dotCount=0;batch.crystalCount=0;batch.shellCount=0;}
    const living=new Set(enemies.filter(enemy=>!enemy.dead).map(enemy=>enemy.id));for(const id of this.shieldBounds.keys())if(!living.has(id))this.shieldBounds.delete(id);
    const clock=this.still()?0:Math.max(0,finite(time));let count=0;
    const view=camera||(typeof this.camera==='function'?this.camera():this.camera),rules=balance||(typeof this.balance==='function'?this.balance():this.balance);
    if(view)view.getWorldQuaternion(this.cameraQuaternion);else this.cameraQuaternion.identity();
    for(const enemy of enemies){
      if(enemy.dead||!this.isVisible(enemy)||count>=this.maxEnemies)continue;
      const figure=figures.get(enemy.id);if(figure?.visible===false)continue;
      const states=enemyDefenseVisualState(enemy,{balance:rules});if(!states.length)continue;
      count++;const measure=this.measure(figure);
      if(figure&&measure.bounds){figure.updateWorldMatrix(true,true);this.worldBounds.copy(measure.bounds).applyMatrix4(figure.matrixWorld);this.worldBounds.getCenter(this.centre);}
      else{this.centre.copy(this.position(finite(enemy.x),enemy.flying?(figure?.position.y??.8)+.75:.75,finite(enemy.z)));this.worldBounds.setFromCenterAndSize(this.centre,new THREE.Vector3(.6,1.5,.6));}
      const size=this.worldBounds.getSize(new THREE.Vector3()),height=Math.max(.4,size.y),glyphScale=clamp(height*.065,.07,.16),dotScale=clamp(height*.011,.012,.026);
      const radiusX=Math.max(.22,size.x*.5)+glyphScale*.8,radiusZ=Math.max(.22,size.z*.5)+glyphScale*.8;
      // Small particles wrap the measured body in world space. Their heights
      // spread across the torso and drift up/down; camera orientation affects
      // only the readable strokes, never the orbit's size or centre.
      const orbit=(slot,total,scale,phaseOffset=0)=>{
        const phase=finite(enemy.id)*.71+slot*Math.PI*2/total+phaseOffset,angle=clock*.38+phase;
        const level=.22+.56*((slot*goldenFraction+phaseOffset*.1)%1)+.075*Math.sin(clock*.82+phase);
        this.pose.position.set(this.centre.x+Math.cos(angle)*radiusX,this.worldBounds.min.y+height*level,this.centre.z+Math.sin(angle)*radiusZ);
        this.pose.quaternion.copy(this.cameraQuaternion);this.pose.scale.setScalar(scale);this.pose.updateMatrix();
      };
      for(let i=0;i<states.length;i++){
        const state=states[i],batch=this.batch(state.kind),index=batch.count++;if(index>=this.maxEnemies){batch.count=this.maxEnemies;continue;}
        for(let n=0;n<glyphsPerDefense;n++){orbit(i+n*states.length,states.length*glyphsPerDefense,glyphScale);batch.glyph.setMatrixAt(batch.glyphCount++,this.pose.matrix);}
        for(let n=0;n<dotsPerDefense;n++){orbit(i+n*states.length,states.length*dotsPerDefense,dotScale,.47);batch.dots.setMatrixAt(batch.dotCount++,this.pose.matrix);}
        if(batch.crystals)for(let n=0;n<Math.min(8,state.count);n++){
          orbit(n,Math.min(8,state.count),glyphScale*1.8,1.05);batch.crystals.setMatrixAt(batch.crystalCount++,this.pose.matrix);
        }
        if(batch.shell){
          // The complete measured unit stays inside a three-sector magical
          // veil. Each blocked hit removes one sector; zero charges removes it.
          this.shieldBounds.set(enemy.id,this.worldBounds.clone());
          for(let n=0;n<Math.min(8,state.count);n++){
            this.pose.position.copy(this.centre);this.pose.rotation.set(0,clock*.18+n*Math.PI*2/3,0);
            this.pose.scale.set(Math.max(.25,size.x*.56+.075),height*.56+.055,Math.max(.25,size.z*.56+.075));this.pose.updateMatrix();
            batch.shell.setMatrixAt(batch.shellCount++,this.pose.matrix);
          }
        }
      }
    }
    for(const batch of this.batches.values()){
      batch.root.visible=batch.count>0;
      batch.glyph.count=batch.glyphCount;batch.dots.count=batch.dotCount;
      for(const object of [batch.glyph,batch.dots])object.instanceMatrix.needsUpdate=true;
      if(batch.crystals){batch.crystals.count=batch.crystalCount;batch.crystals.instanceMatrix.needsUpdate=true;}
      if(batch.shell){batch.shell.count=batch.shellCount;batch.shell.instanceMatrix.needsUpdate=true;}
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
    if(enemy.refraction&&enemy.shields===0){this.shatterShield(enemy);return;}
    const root=new THREE.Group();root.name='Refraction hit';root.position.copy(this.position(enemy.x,enemy.flying?1.3:.85,enemy.z));
    const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(.54,1),new THREE.MeshBasicMaterial({color:'#b0fff6',transparent:true,opacity:.34,wireframe:true,depthWrite:false,toneMapped:false}));root.add(shell);
    this.add(root,.23,(object,p,still)=>{object.scale.setScalar(still?1:1+p*.32);object.children[0].material.opacity=.34*(1-p);},enemy);
  }
  shatterShield(enemy){
    const bounds=this.shieldBounds.get(enemy.id),centre=bounds?bounds.getCenter(new THREE.Vector3()):this.position(enemy.x,enemy.flying?1.3:.75,enemy.z),size=bounds?bounds.getSize(new THREE.Vector3()):new THREE.Vector3(.6,1.5,.6);
    const root=new THREE.Group();root.name='Magical shield breaks after its final blocked hit';root.position.copy(centre);
    const geometry=new THREE.TetrahedronGeometry(.075),material=effectMaterial(styles.refraction,.7);
    for(let n=0;n<12;n++){
      const angle=n*Math.PI*2/12,level=(n%3-1)*.3,shard=new THREE.Mesh(geometry,material);shard.userData.start=new THREE.Vector3(Math.cos(angle)*(size.x*.5+.075),level*size.y,Math.sin(angle)*(size.z*.5+.075));
      shard.position.copy(shard.userData.start);shard.rotation.set(angle,level,n*.7);root.add(shard);
    }
    this.add(root,.5,(object,p,still)=>{for(const shard of object.children){shard.position.copy(shard.userData.start).multiplyScalar(still?1:1+p*.6);if(!still)shard.rotation.z+=p*.03;}material.opacity=.7*(1-p);},enemy);
  }
  update(dt){
    if(this.disposed)return;const elapsed=Math.max(0,finite(dt));
    for(const record of [...this.effects]){
      record.elapsed+=elapsed;
      if(record.elapsed>=record.duration||record.target?.dead||!this.isVisible(record.target)){this.remove(record);continue;}
      record.animate(record.object,clamp(record.elapsed/record.duration,0,1),this.still());
    }
  }
  clear(){for(const effect of [...this.effects])this.remove(effect);this.shieldBounds.clear();for(const batch of this.batches.values()){batch.count=0;batch.glyphCount=0;batch.dotCount=0;batch.crystalCount=0;batch.shellCount=0;batch.root.visible=false;batch.glyph.count=0;batch.dots.count=0;if(batch.crystals)batch.crystals.count=0;if(batch.shell)batch.shell.count=0;}}
  dispose(){if(this.disposed)return;this.clear();dispose(this.group);this.batches.clear();this.disposed=true;}
}

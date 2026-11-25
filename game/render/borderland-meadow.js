import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BATTLEFIELD_ASSET,releaseAsset} from '../release.js';
import {cellKey} from '../core/grid.js';
import {disposeGeometricResources} from './geometric-resources.js';
import {meadowMarket} from './meadow-market.js';

// Keep the board usable during first download and on an interrupted connection.
function loadingField(grid){
  const root=new THREE.Group();
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(grid.size,grid.size),
    new THREE.MeshStandardMaterial({color:0x95a45b,roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.035;floor.receiveShadow=true;root.add(floor);
  const half=(grid.size-1)/2,foundation=new THREE.CylinderGeometry(.41,.43,.06,12);
  const stone=new THREE.MeshStandardMaterial({color:0xb9ab82});
  for(const point of grid.checkpoints){
    const marker=new THREE.Mesh(foundation,stone);
    marker.position.set(point.x-half,.005,point.z-half);root.add(marker);
  }
  return root;
}

function paintedSky(texture){
  const material=new THREE.ShaderMaterial({
    uniforms:{painting:{value:texture},line:{value:.835},aspect:{value:1},bearing:{value:0}},
    depthWrite:false,depthTest:false,toneMapped:false,
    vertexShader:'varying vec2 screenUV; void main(){screenUV=uv;gl_Position=vec4(position.xy,.9999,1.);}',
    fragmentShader:`uniform sampler2D painting; uniform float line,aspect,bearing; varying vec2 screenUV;
      void main(){
        float v=(screenUV.y-line)/max(.18,1.-line);
        float u=(screenUV.x-.5)*aspect*.42+.5+bearing;
        vec3 color=texture2D(painting,vec2(1.-abs(mod(u,2.)-1.),1.-clamp(v*.84+.14,.015,.995))).rgb;
        vec3 haze=mix(vec3(.59,.64,.54),vec3(.78,.81,.74),screenUV.y);
        gl_FragColor=vec4(mix(haze,color,smoothstep(-.38,.15,v)),1.);
        #include <colorspace_fragment>
      }`
  });
  const sky=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  sky.name='Painted alpine horizon';sky.frustumCulled=false;sky.renderOrder=-10000;
  return sky;
}

function dressingCells(node,grid){
  if(Array.isArray(node.userData.meadowCells))return node.userData.meadowCells.map(p=>Array.isArray(p)?p.join(','):p);
  const box=new THREE.Box3().setFromObject(node),half=(grid.size-1)/2;
  const cells=new Set([node.userData.meadowCell.join(',')]);
  for(let z=Math.max(0,Math.floor(box.min.z+half+.5));z<=Math.min(grid.size-1,Math.floor(box.max.z+half+.5));z++){
    for(let x=Math.max(0,Math.floor(box.min.x+half+.5));x<=Math.min(grid.size-1,Math.floor(box.max.x+half+.5));x++)cells.add(cellKey(x,z));
  }
  return [...cells];
}

function disposeMap(root){
  root.traverse(node=>{if(node.isInstancedMesh)node.dispose();});
  disposeGeometricResources(root);
  root.removeFromParent();
}

// Keep logical visibility on individual props, and submit the visible ones
// as one instance list per surface. Rebuild only when a board route changes.
function batchDressing(model,dressing){
  const surfaces=new Map();
  for(const prop of dressing){
    prop.node.traverse(mesh=>{
      if(!mesh.isMesh||mesh.isInstancedMesh||mesh.morphTargetInfluences)return;
      const key=mesh.geometry.uuid+':'+mesh.material.uuid;
      if(!surfaces.has(key))surfaces.set(key,[]);
      surfaces.get(key).push({prop,mesh});
    });
  }
  const batches=[];
  const inverse=model.matrixWorld.clone().invert();
  for(const members of surfaces.values()){
    if(members.length<2)continue;
    const first=members[0].mesh;
    const batch=new THREE.InstancedMesh(first.geometry,first.material,members.length);
    batch.name='Field dressing / '+first.geometry.name;
    batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const entries=members.map(({prop,mesh},index)=>{
      const matrix=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
      batch.setMatrixAt(index,matrix);mesh.layers.disableAll();
      return {node:prop.node,matrix};
    });
    // Full extents remain valid when any subset is packed at the start.
    batch.computeBoundingSphere();batch.computeBoundingBox();model.add(batch);
    batches.push({batch,entries});
  }
  return batches;
}

export class BorderlandMeadow{
  constructor(scene,grid){
    this.scene=scene;this.grid=grid;this.root=new THREE.Group();this.root.name='Borderland Meadow';
    this.root.visible=false;scene.add(this.root);
    this.placeholder=loadingField(grid);scene.add(this.placeholder);
    this.previewAnchor=new THREE.Group();this.previewAnchor.name='Next wave at the camp gate';
    this.previewAnchor.position.set(-19.9,0,-14);scene.add(this.previewAnchor);
    this.dressing=[];this.ready=false;this.closed=false;
  }
  async load(loadAsync=url=>new GLTFLoader().loadAsync(url)){
    if(this.ready||this.closed)return;
    if(this.pending)return this.pending;
    this.pending=this.install(loadAsync).finally(()=>{this.pending=null;});
    return this.pending;
  }
  async install(loadAsync){
    const gltf=await loadAsync(releaseAsset(BATTLEFIELD_ASSET));
    if(this.closed){disposeMap(gltf.scene);return;}
    const people=[];let horizon;
    try{
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(node=>{
        if(Number.isInteger(node.userData.marketStart))people.push(node);
        if(Array.isArray(node.userData.meadowCell))this.dressing.push({node,cells:dressingCells(node,this.grid)});
        if(!node.isMesh)return;
        const mat=node.material;
        if(mat.name==='Painted alpine distance'){
          horizon=mat.emissiveMap||mat.map;node.visible=false;
        }else{
          node.castShadow=!mat.transparent;node.receiveShadow=true;
        }
      });
      this.batches=batchDressing(gltf.scene,this.dressing);
      this.market=meadowMarket(people);
      this.mixer=new THREE.AnimationMixer(gltf.scene);
      for(const clip of gltf.animations)this.mixer.clipAction(clip).play();
      this.mixer.update(0);
      if(horizon){this.sky=paintedSky(horizon);this.root.add(this.sky);}
      this.root.add(gltf.scene);this.sync(this.grid);
      this.ready=true;this.root.visible=true;
      disposeMap(this.placeholder);this.placeholder=null;
    }catch(error){
      this.dressing.length=0;this.market=null;this.mixer?.stopAllAction();
      this.mixer=null;if(this.sky){disposeMap(this.sky);this.sky=null;}
      disposeMap(gltf.scene);throw error;
    }
  }
  sync(grid,route=grid.route){
    this.grid=grid;
    const blocked=new Set(grid.occupied.keys());
    for(const p of grid.route||[])blocked.add(cellKey(p.x,p.z));
    if(route!==grid.route&&route?.length){
      let a=route[0];
      for(const b of route){
        const steps=Math.max(Math.abs(b.x-a.x),Math.abs(b.z-a.z),1);
        for(let step=0;step<=steps;step++){
          const t=step/steps;
          blocked.add(cellKey(Math.round(a.x+(b.x-a.x)*t),Math.round(a.z+(b.z-a.z)*t)));
        }
        a=b;
      }
    }
    for(const prop of this.dressing)prop.node.visible=!prop.cells.some(key=>blocked.has(key));
    for(const {batch,entries} of this.batches||[]){
      let count=0;
      for(const {node,matrix} of entries)if(node.visible)batch.setMatrixAt(count++,matrix);
      batch.count=count;batch.instanceMatrix.needsUpdate=true;
    }
  }
  update(dt,camera,controls){
    if(!this.ready)return;
    if(dt>0){
      this.mixer.update(dt);this.market(dt);
    }
    if(this.sky){
      const u=this.sky.material.uniforms;
      u.aspect.value=camera.aspect;u.bearing.value=.027*Math.sin(controls.getAzimuthalAngle());
      u.line.value=.825+.014*Math.cos(controls.getPolarAngle());
    }
  }
  dispose(){
    this.closed=true;this.mixer?.stopAllAction();
    if(this.mixer)this.mixer.uncacheRoot(this.mixer.getRoot());
    this.dressing.length=0;this.market=null;
    disposeMap(this.root);if(this.placeholder)disposeMap(this.placeholder);
    this.previewAnchor.removeFromParent();
  }
}

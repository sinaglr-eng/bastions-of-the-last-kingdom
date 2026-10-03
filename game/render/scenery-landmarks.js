import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {releaseAsset} from '../release.js';
import {keepModel,campModel,optimize} from './models.js';

export const LANDMARK_SITES=Object.freeze({
  camp:Object.freeze({x:-25,y:0,z:-14,file:'fortified-warcamp-v8.glb',labelHeight:4.2}),
  keep:Object.freeze({x:38,y:0,z:14,file:'royal-castle-v7.glb',labelHeight:19.4})
});
export const WARCAMP_PREVIEW_LOCAL=Object.freeze({x:2.25,y:.595,z:0});

export const LANDMARK_CLEARINGS=Object.freeze([
  Object.freeze({x:-39,z:-14,halfWidth:24,halfDepth:31,height:-.04}),
  Object.freeze({x:48,z:4,halfWidth:32,halfDepth:40,height:-.04})
]);
export function landmarkClearingDistance(x,z){
  return Math.min(...LANDMARK_CLEARINGS.map(site=>Math.max(Math.abs(x-site.x)-site.halfWidth,Math.abs(z-site.z)-site.halfDepth,0)));
}
export const isLandmarkClearing=(x,z,margin=0)=>landmarkClearingDistance(x,z)<=margin;

function disposeVisual(object){
  const geometries=new Set(),materials=new Set();
  object.traverse(part=>{
    if(part.geometry)geometries.add(part.geometry);
    if(object.userData.importedLandmark&&part.material){
      for(const material of Array.isArray(part.material)?part.material:[part.material])materials.add(material);
    }
  });
  geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
  object.removeFromParent();
}

// Keep the preview anchor independent from the replaceable visual asset. It survives
// asynchronous GLB loading and accepts one decorative enemy without touching game state.
export function createLandmarkScenery(){
  const group=new THREE.Group();group.name='Fortified valley landmarks';
  const roots={},visuals={},rotors=[];let disposed=false,loading;
  for(const [key,site]of Object.entries(LANDMARK_SITES)){
    const root=new THREE.Group();root.name=key==='camp'?'Orc fortified settlement':'Royal last castle';
    root.position.set(site.x,site.y,site.z);group.add(root);roots[key]=root;
    const fallback=key==='camp'?campModel():keepModel();fallback.scale.setScalar(key==='camp'?1.23:2.35);
    const visual=optimize(fallback);visual.name=key+' playable fallback';root.add(visual);visuals[key]=visual;
  }
  const previewAnchor=new THREE.Group();previewAnchor.name='Upcoming warband presentation';
  previewAnchor.position.set(WARCAMP_PREVIEW_LOCAL.x,WARCAMP_PREVIEW_LOCAL.y,WARCAMP_PREVIEW_LOCAL.z);
  roots.camp.add(previewAnchor);
  return {
    group,previewAnchor,camp:roots.camp,keep:roots.keep,sites:LANDMARK_SITES,
    load(loader=new GLTFLoader()){
      if(disposed)return Promise.resolve({camp:false,keep:false});
      return loading??=Promise.all(Object.entries(LANDMARK_SITES).map(async([key,site])=>{
        try{
          const asset=await loader.loadAsync(releaseAsset(`assets/scenery/${site.file}`));
          const visual=asset.scene;visual.userData.importedLandmark=true;
          if(disposed){disposeVisual(visual);return [key,false];}
          visual.traverse(part=>{
            if(part.isMesh){part.castShadow=true;part.receiveShadow=true;}
            if(part.name==='MillWaterwheel')rotors.push({part,start:part.rotation.x});
          });
          disposeVisual(visuals[key]);visuals[key]=visual;roots[key].add(visual);return [key,true];
        }catch{return [key,false];}
      })).then(Object.fromEntries);
    },
    update(dt,time){if(disposed)return;for(const rotor of rotors)rotor.part.rotation.x=rotor.start+time*.58;},
    dispose(){if(disposed)return;disposed=true;rotors.length=0;Object.values(visuals).forEach(disposeVisual);group.removeFromParent();}
  };
}

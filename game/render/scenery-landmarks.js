import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {releaseAsset} from '../release.js';
import {keepModel,campModel,optimize} from './models.js';

export const LANDMARK_SITES=Object.freeze({
  camp:Object.freeze({x:-25,y:0,z:-14,file:'fortified-warcamp-v2.glb',labelHeight:4.2}),
  keep:Object.freeze({x:28,y:0,z:14,file:'royal-castle-v2.glb',labelHeight:8.2})
});
export const WARCAMP_PREVIEW_LOCAL=Object.freeze({x:2.25,y:.595,z:0});

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
  const roots={},visuals={};let disposed=false,loading;
  for(const [key,site]of Object.entries(LANDMARK_SITES)){
    const root=new THREE.Group();root.name=key==='camp'?'Orc fortified settlement':'Royal last castle';
    root.position.set(site.x,site.y,site.z);group.add(root);roots[key]=root;
    const fallback=key==='camp'?campModel():keepModel();fallback.scale.setScalar(key==='camp'?1.23:1.51);
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
          visual.traverse(part=>{if(part.isMesh){part.castShadow=true;part.receiveShadow=true;}});
          disposeVisual(visuals[key]);visuals[key]=visual;roots[key].add(visual);return [key,true];
        }catch{return [key,false];}
      })).then(Object.fromEntries);
    },
    dispose(){if(disposed)return;disposed=true;Object.values(visuals).forEach(disposeVisual);group.removeFromParent();}
  };
}

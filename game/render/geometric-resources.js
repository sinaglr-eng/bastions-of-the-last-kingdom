// An installed GLB owns its geometry/material/texture resources. Live actor
// clones share them and must be removed before this final cache cleanup.
// Renderer.dispose() alone does not emit geometry.dispose() for these buffers.
const disposedResources=new WeakSet(),closedImages=new WeakSet();
const object=value=>value!==null&&(typeof value==='object'||typeof value==='function');
import {retiredGeometricBuffers} from './geometric-batching.js';

export function disposeGeometricResources(roots){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const collectTexture=value=>{
    if(Array.isArray(value)){for(const entry of value)collectTexture(entry);}
    else if(value?.isTexture)textures.add(value);
  };
  for(const root of Array.isArray(roots)?roots:[roots]){
    for(const geometry of retiredGeometricBuffers(root))geometries.add(geometry);
    root?.traverse(node=>{
      if(node.geometry)geometries.add(node.geometry);
      for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)materials.add(material);
    });
  }
  for(const material of materials){
    for(const value of Object.values(material))collectTexture(value);
    for(const uniform of Object.values(material.uniforms||{}))collectTexture(uniform?.value);
  }
  const counts={geometries:0,materials:0,textures:0,bitmaps:0};
  const release=(resources,key)=>{
    for(const resource of resources)if(object(resource)&&!disposedResources.has(resource)){
      disposedResources.add(resource);resource.dispose?.();counts[key]++;
    }
  };
  release(geometries,'geometries');release(materials,'materials');release(textures,'textures');
  const closeImage=image=>{
    if(Array.isArray(image)){for(const entry of image)closeImage(entry);}
    else if(object(image)&&typeof image.close==='function'&&!closedImages.has(image)){
      closedImages.add(image);image.close();counts.bitmaps++;
    }
  };
  for(const texture of textures)closeImage(texture.source?.data??texture.image);
  return counts;
}

export function disposeDecodedGeometricAsset(gltf){
  return disposeGeometricResources([...new Set([gltf?.scene,...(gltf?.scenes||[])].filter(Boolean))]);
}

// Decode cannot be cancelled after dispatch. Make the late completion a real
// ownership decision so a restarted battlefield cannot retain unused assets.
export function adoptDecodedGeometricAsset(gltf,install,{isDisposed=()=>false}={}){
  try{
    if(isDisposed()||install(gltf)===false){disposeDecodedGeometricAsset(gltf);return false;}
    return true;
  }catch(error){disposeDecodedGeometricAsset(gltf);throw error;}
}

import {Float32BufferAttribute} from 'three';

// A constant linear RGB vertex color replaces only the diffuse color uniform.
// Every other render parameter must be identical, including exact shared
// texture objects and UVs. No transparency, custom shader, existing vertex
// color or animated cue enters this path.
const ignored=new Set(['id','uuid','name','version','userData','_listeners','color']);
function valueKey(value){
  if(value?.isTexture){
    if(value.isRenderTargetTexture||value.isVideoTexture||value.isFramebufferTexture||value.mipmaps?.length)return {texture:value.uuid};
    // GLTFLoader clones texture handles for material/UV bindings. They may
    // still sample the exact same decoded Source. Include every sampler and
    // transform field so a different image, channel or UV mapping never joins.
    return {source:value.source.uuid,mapping:value.mapping,channel:value.channel,wrapS:value.wrapS,wrapT:value.wrapT,magFilter:value.magFilter,minFilter:value.minFilter,anisotropy:value.anisotropy,format:value.format,internalFormat:value.internalFormat,type:value.type,colorSpace:value.colorSpace,flipY:value.flipY,premultiplyAlpha:value.premultiplyAlpha,unpackAlignment:value.unpackAlignment,generateMipmaps:value.generateMipmaps,compareFunction:value.compareFunction,rotation:value.rotation,offset:value.offset.toArray(),repeat:value.repeat.toArray(),center:value.center.toArray(),matrixAutoUpdate:value.matrixAutoUpdate,matrix:value.matrixAutoUpdate?null:value.matrix.toArray()};
  }
  if(value===null||['string','number','boolean','undefined'].includes(typeof value))return value;
  if(Array.isArray(value))return value.map(valueKey);
  if(value.isColor||value.isVector2||value.isVector3||value.isVector4||value.isEuler)return value.toArray();
  if(value.isPlane)return [value.normal.toArray(),value.constant];
  if(Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.keys(value).sort().map(k=>[k,valueKey(value[k])]));
  throw Error('Unsupported palette material property');
}
export function materialPaletteKey(material){
  if(material?.type!=='MeshStandardMaterial'||material.transparent||material.vertexColors)return null;
  try{return JSON.stringify(Object.keys(material).filter(k=>!ignored.has(k)).sort().map(k=>[k,valueKey(material[k])]));}catch{return null;}
}
export function withPaletteColor(geometry,color){
  const copy=geometry.clone(),count=copy.attributes.position.count,values=new Float32Array(count*3);
  for(let i=0;i<count;i++){values[i*3]=color.r;values[i*3+1]=color.g;values[i*3+2]=color.b;}
  copy.setAttribute('color',new Float32BufferAttribute(values,3));return copy;
}
export function paletteMaterial(source){
  const material=source.clone();material.name='Shared diffuse palette';material.color.setRGB(1,1,1);material.vertexColors=true;return material;
}

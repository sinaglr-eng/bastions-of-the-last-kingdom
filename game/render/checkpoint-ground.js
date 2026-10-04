import * as THREE from 'three';
import {CHECKPOINT_GROUND_Y} from './checkpoint-vignettes.js';

const extent=1.10,segments=96,textureSize=256;
const clamp=(value,low=0,high=1)=>Math.min(high,Math.max(low,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
// Stable coordinate noise never consumes the game seed, and needs no canvas.
function hash(x,z,salt=0){
  let n=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(salt,1274126177);
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
}
function noise(x,z,salt){
  const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz);
  return mix(mix(hash(ix,iz,salt),hash(ix+1,iz,salt),u),mix(hash(ix,iz+1,salt),hash(ix+1,iz+1,salt),u),v);
}
function outlineRadius(angle){
  return .43+.033*Math.cos(2*angle+.4)+.030*Math.sin(3*angle-.6)+.024*Math.cos(5*angle+1.2)+.010*Math.sin(11*angle)+.006*Math.cos(19*angle+.7);
}
const scuffs=[[-.18,-.12,.13,.032,.5],[.07,.03,.16,.038,-.3],[.22,.19,.11,.029,.4],[-.11,.24,.09,.030,-.5]];
function scuffAt(x,z){
  let worn=0;
  for(const [cx,cz,length,width,angle] of scuffs){
    const dx=x-cx,dz=z-cz,a=dx*Math.cos(angle)+dz*Math.sin(angle),b=-dx*Math.sin(angle)+dz*Math.cos(angle);
    worn=Math.max(worn,clamp(1-(a/length)**2-(b/width)**2));
  }
  return worn;
}

export function createCheckpointGroundTextures(){
  const color=new Uint8Array(textureSize*textureSize*4),relief=new Uint8Array(color.length);
  for(let row=0;row<textureSize;row++)for(let column=0;column<textureSize;column++){
    const x=((column+.5)/textureSize-.5)*extent,z=((row+.5)/textureSize-.5)*extent;
    const coarse=noise(x*9,z*9,11),crumbs=noise(x*43,z*43,17),grain=hash(column,row,31);
    const edge=1-smooth((outlineRadius(Math.atan2(z,x))-Math.hypot(x,z))/.050);
    const wear=scuffAt(x,z)*(.55+.45*crumbs);
    // Sparse, uneven small stones have a shaded edge and a lighter centre.
    const px=x*37,pz=z*37,cellX=Math.floor(px),cellZ=Math.floor(pz);
    const centreX=.22+.56*hash(cellX,cellZ,37),centreZ=.22+.56*hash(cellX,cellZ,41);
    const radius=.12+.13*hash(cellX,cellZ,43),distance=Math.hypot(px-cellX-centreX,(pz-cellZ-centreZ)*1.25);
    const pebble=hash(cellX,cellZ,47)>.80?smooth((radius-distance)/.055):0;
    const variation=(coarse-.5)*35+(crumbs-.5)*20+(grain-.5)*22;
    const soil=[132+variation+wear*18,101+variation*.85+wear*14,66+variation*.60+wear*9];
    const rim=[139+variation*.65,126+variation*.60,83+variation*.50];
    const stone=[160+grain*16,147+grain*15,119+grain*13];
    const offset=(row*textureSize+column)*4;
    for(let channel=0;channel<3;channel++)color[offset+channel]=clamp(mix(mix(soil[channel],rim[channel],edge*.82),stone[channel],pebble),0,255);
    // Relief is shading only: no raised slab, pebble mesh or walking obstacle.
    const height=clamp(107+(coarse-.5)*35+(crumbs-.5)*47+(grain-.5)*24-wear*30+pebble*73,0,255);
    relief[offset]=relief[offset+1]=relief[offset+2]=height;
    color[offset+3]=relief[offset+3]=255;
  }
  const map=new THREE.DataTexture(color,textureSize,textureSize,THREE.RGBAFormat);
  const bumpMap=new THREE.DataTexture(relief,textureSize,textureSize,THREE.RGBAFormat);
  map.name='Checkpoint opaque soil color';map.colorSpace=THREE.SRGBColorSpace;
  bumpMap.name='Checkpoint soil grain relief';
  for(const texture of [map,bumpMap]){
    texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
    texture.generateMipmaps=true;texture.needsUpdate=true;
  }
  return {map,bumpMap};
}

let sharedMaterial=null;
function groundMaterial(){
  if(sharedMaterial)return sharedMaterial;
  const {map,bumpMap}=createCheckpointGroundTextures();
  const material=new THREE.MeshStandardMaterial({color:0xffffff,map,bumpMap,bumpScale:.008,roughness:1,transparent:false,opacity:1,depthWrite:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  material.name='Checkpoint opaque textured earth';
  // optimize() transfers this exact material to the world scenery batch. World
  // disposal already releases each shared material once; it owns these maps too.
  const release=()=>{
    material.removeEventListener('dispose',release);map.dispose();bumpMap.dispose();
    if(sharedMaterial===material)sharedMaterial=null;
  };
  material.addEventListener('dispose',release);sharedMaterial=material;return material;
}

export function createCheckpointGroundGeometry(){
  const position=[],uv=[];
  for(let i=0;i<segments;i++){
    const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
    for(const [x,z] of [[0,0],[Math.cos(b)*outlineRadius(b),Math.sin(b)*outlineRadius(b)],[Math.cos(a)*outlineRadius(a),Math.sin(a)*outlineRadius(a)]]){
      position.push(x,CHECKPOINT_GROUND_Y,z);uv.push(x/extent+.5,z/extent+.5);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals();return geometry;
}

export function createCheckpointGround(){
  const mesh=new THREE.Mesh(createCheckpointGroundGeometry(),groundMaterial());
  mesh.name='Flush trampled ground';mesh.raycast=()=>{};mesh.receiveShadow=true;return mesh;
}

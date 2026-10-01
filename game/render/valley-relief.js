import * as THREE from 'three';
import {LANDMARK_CLEARINGS} from './scenery-landmarks.js';

// These controls keep the existing river course and bridge aligned with the map.
export const RIVER_CONTROL_POINTS=Object.freeze([
  [25,-39],[24,-29],[24,-23],[22.7,-14],[22.6,-3],[22,8],
  [23,18],[20,24],[7,26],[-8,28],[-25,33]
].map(point=>Object.freeze(point)));

export function valleyRiverDistance(x,z){
  let closest=Infinity;
  for(let i=1;i<RIVER_CONTROL_POINTS.length;i++){
    const a=RIVER_CONTROL_POINTS[i-1],b=RIVER_CONTROL_POINTS[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
    closest=Math.min(closest,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  return closest;
}

const hills=[[-46,-41,25,7.4],[43,-47,24,9.2],[-48,27,28,6.0],[41,47,29,7.4],[0,-62,31,7.2],[-10,64,38,5.4]];
export function valleyGroundHeight(x,z){
  const distance=Math.max(Math.abs(x),Math.abs(z));
  if(distance<=20.2)return -.21;
  let relief=0;
  for(const [cx,cz,width,height]of hills)relief+=Math.exp(-((x-cx)**2+(z-cz)**2)/(width*width))*height;
  const folds=Math.sin(x*.12+Math.sin(z*.07)*1.7)*.74+Math.cos(z*.14-x*.055)*.58;
  let height=-.20+THREE.MathUtils.smoothstep(distance,23,68)*(1.4+relief+folds);
  const channel=1-THREE.MathUtils.smoothstep(valleyRiverDistance(x,z),3.3,7.2);
  height=THREE.MathUtils.lerp(height,-.16,channel);
  // Castle and camp stand on clear, almost level shoulders rather than floating
  // above hills. The original playable field is not part of this mesh.
  for(const site of LANDMARK_CLEARINGS){
    const outside=Math.max(Math.abs(x-site.x)-site.halfWidth,Math.abs(z-site.z)-site.halfDepth,0);
    const clearing=1-THREE.MathUtils.smoothstep(outside,0,4.0);
    height=THREE.MathUtils.lerp(height,site.height,clearing);
  }
  return height;
}

// A hollow, continuous terrain ring: every vertex and face stays beyond the build
// field. Rolling shoulders, forested folds and distant slopes surround all sides.
export function createValleyRelief(){
  const rings=[20.35,22,24.5,28,34,41,49,62,76,94],segments=160;
  const positions=[],colors=[],indices=[];
  const meadow=new THREE.Color('#899267'),forest=new THREE.Color('#57785b'),rock=new THREE.Color('#738780'),distant=new THREE.Color('#829d96');
  for(let row=0;row<rings.length;row++)for(let i=0;i<=segments;i++){
    const angle=i/segments*Math.PI*2,denominator=Math.max(Math.abs(Math.cos(angle)),Math.abs(Math.sin(angle)));
    const x=Math.cos(angle)/denominator*rings[row],z=Math.sin(angle)/denominator*rings[row],y=valleyGroundHeight(x,z);
    positions.push(x,y,z);
    const forestWeight=(Math.sin(x*.13+Math.cos(z*.14))*.5+.5)*THREE.MathUtils.smoothstep(rings[row],24,42);
    const tint=meadow.clone().lerp(forest,forestWeight*.78).lerp(rock,THREE.MathUtils.smoothstep(y,2.8,9.5)*.62).lerp(distant,THREE.MathUtils.smoothstep(rings[row],50,94)*.48);
    colors.push(tint.r,tint.g,tint.b);
    if(row<rings.length-1&&i<segments){
      const a=row*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;
      indices.push(a,b,c,b,d,c);
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
  const ground=new THREE.Mesh(geometry,material);ground.name='Layered valley shoulders';ground.receiveShadow=true;return ground;
}

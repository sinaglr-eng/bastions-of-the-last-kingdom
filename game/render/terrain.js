import * as THREE from 'three';

// Continuous meadow material: shared world-space detail on the field and its shoulders.
// No raised board, border mesh, texture fetch, or decorative collision geometry.
export function meadowTerrain(){
  const geometry=new THREE.PlaneGeometry(110,110,220,220);geometry.rotateX(-Math.PI/2);
  const a=geometry.attributes.position;
  for(let i=0;i<a.count;i++){
    const d=Math.max(Math.abs(a.getX(i)),Math.abs(a.getZ(i))),t=THREE.MathUtils.smoothstep(d,18.5,21.2);
    a.setY(i,THREE.MathUtils.lerp(.031,-.22,t));
  }
  geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:'#81905e',roughness:1});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 meadowWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nmeadowWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=`
      varying vec3 meadowWorld;
      float meadowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float meadowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(meadowHash(i),meadowHash(i+vec2(1,0)),f.x),mix(meadowHash(i+vec2(0,1)),meadowHash(i+vec2(1,1)),f.x),f.y);}
      float meadowFbm(vec2 p){return meadowNoise(p)*.55+meadowNoise(p*2.1)*.28+meadowNoise(p*4.2)*.17;}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 ground=meadowWorld.xz;
      float grassPatch=meadowFbm(ground*.24),moss=meadowFbm(ground*.82+41.7);
      vec3 grass=mix(vec3(.31,.43,.22),vec3(.58,.65,.34),smoothstep(.2,.8,grassPatch));
      grass=mix(grass,vec3(.41,.50,.28),smoothstep(.57,.84,moss)*.5);
      float field=1.0-smoothstep(16.5,23.0,max(abs(ground.x),abs(ground.y)));
      grass=mix(grass*vec3(1.14,1.08,1.1),grass,field);
      float fine=meadowNoise(ground*15.0),grain=meadowNoise(ground*65.0);
      grass*=.86+fine*.2+grain*.10;
      vec2 blades=ground*24.0;vec2 cell=floor(blades),f=fract(blades);
      float seed=meadowHash(cell),blade=(1.0-smoothstep(.0,.10,abs(f.x-.5+(f.y-.5)*.35))) * smoothstep(.05,.25,f.y)*(1.0-smoothstep(.55,.94,f.y));
      grass+=vec3(.09,.10,.025)*blade*step(.65,seed);
      float clover=1.0-smoothstep(.02,.14,length(fract(ground*9.0)-.5));
      grass=mix(grass,grass*vec3(.78,.96,.72),clover*step(.86,meadowHash(floor(ground*9.0))));
      diffuseColor.rgb=grass*.28;
    `);
  };
  material.customProgramCacheKey=()=> 'continuous-meadow-v1';
  const terrain=new THREE.Mesh(geometry,material);terrain.receiveShadow=true;return terrain;
}

export function interiorGrid(size){
  const vertices=[];
  for(let i=1;i<size;i++){const p=i-size/2;vertices.push(p,0,-size/2,p,0,size/2,-size/2,0,p,size/2,0,p);}
  return new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),new THREE.LineBasicMaterial({color:'#d3dfb5',transparent:true,opacity:.15,depthWrite:false}));
}

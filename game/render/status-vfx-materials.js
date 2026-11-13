import * as THREE from 'three';

// Shared authoritative-clock uniforms keep materials stationary on pause and
// in reduced motion. No effect maintains an independent real-time clock.
export function statusMaterial(kind,style,geometry,uniforms){
  const material=new THREE.MeshBasicMaterial({color:'#ffffff',vertexColors:!!geometry.attributes.color,transparent:true,opacity:style.opacity,depthWrite:false,depthTest:!['stun','healBlock','regenReduction'].includes(kind),side:THREE.DoubleSide,toneMapped:false,blending:kind==='flash'?THREE.AdditiveBlending:THREE.NormalBlending});
  material.userData.statusKind=kind;material.userData.statusUniforms=uniforms;
  material.customProgramCacheKey=()=>`body-status-fr009-${kind}`;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uStatusTime=uniforms.time;shader.uniforms.uStatusStill=uniforms.still;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform float uStatusTime;
      uniform float uStatusStill;
      varying vec3 vStatusLocal;
      varying vec3 vStatusNormal;
      varying vec3 vStatusView;
      varying float vStatusSeed;`);
    const organic=kind==='poison'?`
      float billow=sin(position.x*17.0+uStatusTime*.85+vStatusSeed)*sin(position.y*13.0-uStatusTime*.6);
      transformed+=normal*billow*.015*(1.0-uStatusStill);`:(kind==='burn'||kind==='heat')?`
      float rise=clamp(position.y,0.0,1.2);
      transformed.x+=sin(position.y*9.0-uStatusTime*3.3+vStatusSeed)*.035*rise*(1.0-uStatusStill);
      transformed.z+=sin(position.y*7.0-uStatusTime*2.7+vStatusSeed+1.4)*.025*rise*(1.0-uStatusStill);`:'';
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vStatusLocal=position;
      vStatusSeed=0.0;
      vec3 statusNormal=normal;
      #ifdef USE_INSTANCING
        vStatusSeed=dot(instanceMatrix[3].xyz,vec3(1.71,2.13,3.07))*(1.0-uStatusStill);
        mat3 statusInstance=mat3(instanceMatrix);
        statusNormal/=max(vec3(dot(statusInstance[0],statusInstance[0]),dot(statusInstance[1],statusInstance[1]),dot(statusInstance[2],statusInstance[2])),vec3(.0001));
        statusNormal=statusInstance*statusNormal;
      #endif
      vStatusNormal=normalize(normalMatrix*statusNormal);
      ${organic}`);
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vStatusView=-mvPosition.xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform float uStatusTime;
      uniform float uStatusStill;
      varying vec3 vStatusLocal;
      varying vec3 vStatusNormal;
      varying vec3 vStatusView;
      varying float vStatusSeed;`);
    const finish=kind==='poison'?`
      float facing=abs(dot(normalize(vStatusNormal),normalize(vStatusView)));
      float density=.5+.5*sin(vStatusLocal.x*25.0+uStatusTime*.6+vStatusSeed)*sin(vStatusLocal.y*19.0-uStatusTime*.4);
      float bubbleRim=smoothstep(.12,.30,facing)*(1.0-smoothstep(.48,.78,facing));
      float softEdge=smoothstep(.025,.19,facing);
      diffuseColor.a*=softEdge*(.34+density*.14+bubbleRim*.44);
      diffuseColor.rgb=mix(vec3(.019,.072,.008),vec3(.42,.95,.07),bubbleRim*.92)*(.88+density*.12);`:(kind==='burn'||kind==='heat')?`
      float tongues=.5+.5*sin(vStatusLocal.y*19.0-uStatusTime*4.0+vStatusSeed+sin(vStatusLocal.x*35.0));
      diffuseColor.a*=.64+tongues*.28;
      diffuseColor.rgb*=.92+tongues*.12;`:kind==='freeze'?`
      float facing=abs(dot(normalize(vStatusNormal),normalize(vStatusView)));
      float frost=pow(1.0-facing,1.7);
      diffuseColor.a*=.32+frost*.65;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.98,1.0),frost*.48);`:kind==='flash'?`
      diffuseColor.rgb*=1.15;`:`
      float relief=.72+.28*abs(dot(normalize(vStatusNormal),normalize(vec3(-.4,.75,.6))));
      diffuseColor.rgb*=relief;`;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      ${finish}`);
  };
  return material;
}

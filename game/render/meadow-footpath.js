import {MathUtils} from 'three';

const {lerp,clamp,smoothstep}=MathUtils;

// A repeatable soil and grass pattern in ground coordinates. A stretch shared
// by two routes should keep the same bare patches when the maze changes.
function grain(x,y){
  let h=Math.imul(x,1597334677)^Math.imul(y,3812015801);
  h=Math.imul(h^(h>>>16),2246822507);
  return ((h^(h>>>13))>>>0)/4294967296;
}

function noise(x,y){
  const i=Math.floor(x),j=Math.floor(y);
  const u=smoothstep(x-i,0,1),v=smoothstep(y-j,0,1);
  return lerp(lerp(grain(i,j),grain(i+1,j),u),lerp(grain(i,j+1),grain(i+1,j+1),u),v);
}

export function meadowFootpath(canvas,ctx,material,texture,gridSize){
  const unit=canvas.width/84,center=(gridSize-1)/2;
  const side=Math.ceil((gridSize+2)*unit);
  const left=Math.floor((canvas.width-side)/2),top=Math.floor((canvas.height-side)/2);
  const image=ctx.getImageData(left,top,side,side),natural=image.data.slice();
  // RGB retains the grass painting. Its spare alpha channel carries the amount
  // of exposed earth, allowing dirt to keep its own colour over green vertices.
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      float exposedEarth = 1.0 - sampledDiffuseColor.a;
      vec3 earth = vec3(0.252, 0.165, 0.082) * sampledDiffuseColor.rgb;
      diffuseColor.rgb = mix(diffuseColor.rgb, earth, exposedEarth);
      diffuseColor.a = opacity;
    `);
  };
  let previous;
  return route=>{
    const signature=(route??[]).map(p=>p.x+','+p.z).join('|');
    if(signature===previous)return;
    previous=signature;
    image.data.set(natural);
    if(route?.length>1){
      const first=route[0],last=route.at(-1);
      const cells=[{x:first.x===0?-.5:first.x,z:first.z},...route,
        {x:last.x===gridSize-1?last.x+.5:last.x,z:last.z}];
      const points=cells.map(({x,z})=>({
        x:x-center+.24*(noise(x*1.32,z*.82)-.5),
        z:z-center+.24*(noise(x*.94+8,z*1.22)-.5)
      }));
      // Cut a gentle corner at each bend. Visible wear remains inside the tiles.
      let a=points[0];
      for(let i=1;i<points.length-1;i++){
        const b=points[i],c=points[i+1];
        const near={x:lerp(b.x,a.x,.19),z:lerp(b.z,a.z,.19)};
        const far={x:lerp(b.x,c.x,.19),z:lerp(b.z,c.z,.19)};
        const bend={x:(near.x+2*b.x+far.x)/4,z:(near.z+2*b.z+far.z)/4};
        stampSegment(a,near);stampSegment(near,bend);stampSegment(bend,far);
        a=far;
      }
      stampSegment(a,points.at(-1));
    }
    ctx.putImageData(image,left,top);
    texture.needsUpdate=true;
  };

  function stampSegment(a,b){
    const ax=(a.x+42)*unit-left,ay=(28-a.z)*unit-top;
    const dx=(b.x-a.x)*unit,dy=(a.z-b.z)*unit,lengthSq=dx*dx+dy*dy;
    if(lengthSq<.001)return;
    const pad=.52*unit;
    const minX=Math.max(0,Math.floor(ax+Math.min(0,dx)-pad));
    const maxX=Math.min(side-1,Math.ceil(ax+Math.max(0,dx)+pad));
    const minY=Math.max(0,Math.floor(ay+Math.min(0,dy)-pad));
    const maxY=Math.min(side-1,Math.ceil(ay+Math.max(0,dy)+pad));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const px=x+.5-ax,py=y+.5-ay,t=clamp((px*dx+py*dy)/lengthSq,0,1);
      const distance=Math.hypot(px-dx*t,py-dy*t)/unit;
      if(distance>.51)continue;
      const u=x/unit,v=y/unit,loam=noise(u*1.28,v*1.28);
      const roots=noise(3.8*u+13,4.2*v),grit=grain(x,y);
      const radius=.20+.22*loam+.15*(roots-.5);
      const shoulder=1-smoothstep(distance,radius*.38,radius+.04);
      const wear=shoulder*(.29+.48*loam+.23*roots)*
        (1-.53*smoothstep(roots,.58,.88))*(.88+.12*grit);
      const index=(y*side+x)*4,alpha=255-Math.round(255*wear);
      if(alpha>=image.data[index+3])continue;
      // Small gravel flecks and damp pockets interrupt the compacted centre.
      const tone=wear*((grit>.976?23:0)+12*(grit-.60)+30*(roots-.53));
      for(let k=0;k<3;k++)image.data[index+k]=natural[index+k]+tone;
      image.data[index+3]=alpha;
    }
  }
}

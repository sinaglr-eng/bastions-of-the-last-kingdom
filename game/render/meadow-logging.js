import * as THREE from 'three';

const floor=-.035;
const ringAngle=Math.PI*2;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const point=(x,y,z)=>V(x,floor+y,z);
const cutWood=['#b68148','#dda76c','#b48651','#e0b57d'];
const bark=['#654831','#78583c','#5a4637','#856447','#624a37'];
const logYard=[[-19.8,4.95],[-19.03,6.1],[-19.15,8.1],[-19.00,10.15],[-19.46,13.31],
  [-20.62,14.43],[-22.55,15.52],[-23.44,14.75],[-23.18,12.43],[-22.48,10.54],
  [-21.53,8.56],[-20.74,6.83]];
const rockCenter={x:-20.27,z:-.22};

function insideYard(x,z){
  let inside=false;
  for(let i=0,j=logYard.length-1;i<logYard.length;j=i++){
    const [ax,az]=logYard[i],[bx,bz]=logYard[j];
    if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
  }
  return inside;
}

export function reservedClearing(x,z,r=0){
  if(Math.hypot((x-rockCenter.x)*1.10,z-rockCenter.z)<1.06+r)return true;
  return insideYard(x,z)||insideYard(x-r,z)||insideYard(x+r,z)||insideYard(x,z+r)||insideYard(x,z-r);
}

// Earth, faded grass and sawdust are baked into the turf, including the
// transition under the log pile. Nothing floats above or flickers with the ground.
export function paintLoggingGround(ctx,unit){
  const cx=-20.86,cz=10.14;
  for(const [scale,tint] of [[1.06,'rgba(220,185,150,.30)'],[.95,'rgba(217,166,125,.43)'],[.74,'rgba(225,169,124,.45)']]){
    ctx.beginPath();
    logYard.forEach(([x,z],i)=>{
      const px=(42+cx+(x-cx)*scale)*unit,py=(28-cz-(z-cz)*scale)*unit;
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    });
    ctx.closePath();ctx.fillStyle=tint;ctx.fill();
  }
}

function surfaces(name){
  const vertices=[],colors=[],shade=new THREE.Color();
  function face(a,b,c,tint){
    vertices.push(...a.toArray(),...b.toArray(),...c.toArray());
    shade.set(tint);for(let i=0;i<3;i++)colors.push(shade.r,shade.g,shade.b);
  }
  function finish(){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,side:THREE.DoubleSide}));
    mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};
    return mesh;
  }
  return {face,finish};
}

function clearing(){
  const art=surfaces('Sawyers’ clearing / timber and stump wood');
  function shaft(a,b,r,s,cut=true,twist=0){
    const axis=b.clone().sub(a).normalize(),helper=Math.abs(axis.y)>.86?V(1,0,0):V(0,1,0);
    const u=axis.clone().cross(helper).normalize(),v=axis.clone().cross(u);
    const sides=9;
    function rim(center,size){
      return Array.from({length:sides},(_,i)=>{
        const angle=i*ringAngle/sides+twist,radius=size*(1+.07*Math.sin(3*angle+.8));
        return center.clone().addScaledVector(u,Math.cos(angle)*radius).addScaledVector(v,Math.sin(angle)*radius);
      });
    }
    const start=rim(a,r),end=rim(b,s);
    for(let i=0;i<sides;i++){
      const j=(i+1)%sides;
      art.face(start[i],start[j],end[j],bark[i%bark.length]);
      art.face(start[i],end[j],end[i],bark[i%bark.length]);
      art.face(a,start[j],start[i],cutWood[0]);
    }
    if(!cut)return;
    const heart=b.clone().addScaledVector(u,.05*s).addScaledVector(v,-.04*s);
    const rings=[end,rim(heart,s*.86),rim(heart,s*.53),rim(heart,s*.44)];
    for(let k=0;k<rings.length-1;k++)for(let i=0;i<sides;i++){
      const j=(i+1)%sides,A=rings[k],B=rings[k+1];
      art.face(A[i],A[j],B[j],cutWood[k]);art.face(A[i],B[j],B[i],cutWood[k]);
    }
    for(let i=0;i<sides;i++)art.face(heart,rings[3][i],rings[3][(i+1)%sides],cutWood[3]);
  }
  function stump(x,z,r,h,angle){
    shaft(point(x,-.07,z),point(x+.035,h,z-.018),r*1.13,r*.90,true,angle);
    const count=3+(Math.round(angle*10)%2);
    for(let i=0;i<count;i++){
      const a=angle+i*ringAngle/count+.17*Math.sin(i*4.9+angle);
      const reach=r*(1.37+.35*Math.cos(i*2.73+angle));
      shaft(point(x+Math.cos(a)*r*.77,.083,z+Math.sin(a)*r*.77),
        point(x+Math.cos(a+.15)*reach,-.030,z+Math.sin(a+.15)*reach),r*.36,r*.17,false,a);
    }
  }
  for(const args of [[-19.54,6.1,.26,.36,.42],[-20.53,8.13,.32,.43,.72],[-21.55,9.72,.29,.28,1.3],
    [-19.80,12.41,.24,.37,.81],[-22.23,14.61,.33,.43,.42]])stump(...args);

  // Bucked lengths are banked in a real three-log stack. Ends open towards the saw.
  for(const [x,y,z] of [[-20.1,.175,9.94],[-20.48,.175,10.02],[-20.29,.463,10.09]]){
    shaft(point(x,y,z-1.10),point(x-.20,y+.016,z+1.13),.185,.17);
  }
  // A fresh windrow retains its snapped crown and a few spruce boughs.
  const base=point(-21.23,.249,11.25),tip=point(-22.60,.078,13.68);
  shaft(base,tip,.265,.075);
  for(let i=0;i<8;i++){
    const t=.30+i*.084,join=base.clone().lerp(tip,t),side=i%2===0?1:-1;
    const branchTip=join.clone().add(V(side*(.56-.30*t),.19+.12*Math.sin(i),.10+.32*t));
    shaft(join,branchTip,.07-.035*t,.017);
    if(i>=3){
      const behind=branchTip.clone().lerp(join,.65),dx=side*.12;
      const left=behind.clone().add(V(dx,-.09,-.17)),right=behind.clone().add(V(-dx,.02,.17));
      const ridge=behind.clone().add(V(0,.15,0));
      art.face(branchTip,left,ridge,'#496344');art.face(branchTip,ridge,right,'#65794b');
    }
  }
  // Split rounds and scattered hewing chips gather near two of the stumps.
  shaft(point(-19.84,.18,7.36),point(-20.22,.19,7.62),.19,.17);
  shaft(point(-21.6,.16,10.64),point(-21.97,.158,10.43),.16,.14);
  const snag=point(-20.12,-.04,13.65),split=point(-20.24,.94,13.53);
  shaft(snag,split,.19,.106);
  shaft(split.clone().add(V(-.055,-.13,-.035)),point(-20.29,1.19,13.45),.072,.016);
  shaft(snag.clone().lerp(split,.57),point(-20.45,.71,13.77),.066,.034);
  for(let i=0;i<46;i++){
    const x0=i%2?-20.53:-21.23,z0=i%2?8.13:11.25,a=i*2.4;
    const d=.28+(.5+.5*Math.sin(i*18.71))*.53;
    const x=x0+Math.cos(a)*d,z=z0+Math.sin(a)*d;
    art.face(point(x,.01,z),point(x+.047,.024,z+.05),point(x-.066,.015,z+.033),cutWood[i%4]);
  }
  return art.finish();
}

function erratic(){
  const art=surfaces('Checkpoint I verge / glacial boulder');
  const outline=[[-.73,-.52],[-.90,.06],[-.69,.63],[-.09,.91],[.53,.72],[.87,.35],[.78,-.35],[.27,-.76],[-.31,-.75]];
  const rings=[[-.15,-.03,.00,.89],[.35,0,0,1],[.77,-.05,-.07,.83],[1.09,-.17,-.06,.47]].map(([y,ox,oz,s],j)=>
    outline.map(([x,z],i)=>point(rockCenter.x+ox+x*s,y+(j?.09*Math.sin(i*1.57+j*.9):0),rockCenter.z+oz+z*s)));
  const stone=['#73776b','#929384','#818376','#717869','#959988','#747c72','#878879','#787f74','#979586'];
  for(let k=0;k<rings.length-1;k++)for(let i=0;i<outline.length;i++){
    const j=(i+1)%outline.length,A=rings[k],B=rings[k+1];
    const c=stone[(i+k)%stone.length],d=k===2&&(i===3||i===4)?'#858b61':stone[(i+k+2)%stone.length];
    art.face(A[i],A[j],B[j],c);art.face(A[i],B[j],B[i],d);
  }
  const top=point(rockCenter.x-.16,1.15,rockCenter.z-.08),rim=rings.at(-1);
  for(let i=0;i<rim.length;i++)art.face(top,rim[i],rim[(i+1)%rim.length],i<3?'#a6a88b':'#9a9b87');
  return art.finish();
}

export function campWoodcutting(){
  return [clearing(),erratic()];
}

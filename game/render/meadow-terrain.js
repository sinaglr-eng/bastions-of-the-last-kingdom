import * as THREE from 'three';

const V=THREE.Vector3, cutDepth=-3.8;
const mix=THREE.MathUtils.lerp;

function seedRandom(seed){
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}

// A single mipmapped painting over the authored turf. Five-tile brush facets
// stay broad at the overview zoom; shared edges and mipmaps avoid screen-door grain.
function tintTurf(mesh){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=512;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const random=seedRandom(4671),cols=17,rows=12,w=canvas.width/cols,h=canvas.height/rows;
  const nodes=Array.from({length:rows+1},(_,z)=>Array.from({length:cols+1},(_,x)=>({
    x:(x+(x&&x<cols?(random()-.5)*.60:0))*w,
    y:(z+(z&&z<rows?(random()-.5)*.60:0))*h,
    tone:.56*Math.sin(x*.93+z*.45)+.31*Math.cos(z*1.5-x*.28)+.13*(random()*2-1)
  })));
  ctx.fillStyle='#f6f5ee';ctx.fillRect(0,0,canvas.width,canvas.height);
  function paint(a,b,c){
    const t=(a.tone+b.tone+c.tone)/3+(random()-.5)*.64;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();
    ctx.fillStyle='rgb('+[239+15*t,242+10*t,232-15*t].map(Math.round).join(',')+')';
    ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=1.5;ctx.stroke();ctx.fill();
  }
  for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){
    const a=nodes[z][x],b=nodes[z][x+1],c=nodes[z+1][x+1],d=nodes[z+1][x];
    if(random()<.5){paint(a,b,c);paint(a,c,d);}else{paint(a,b,d);paint(b,c,d);}
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.name='Borderland Meadow / grass and clover facets';texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  const pos=mesh.geometry.getAttribute('position'),uv=new Float32Array(pos.count*2),p=new V();
  for(let i=0;i<pos.count;i++){
    p.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
    uv[i*2]=(p.x+42)/84;uv[i*2+1]=(p.z+28)/56;
  }
  mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  mesh.material.map=texture;mesh.material.needsUpdate=true;mesh.castShadow=false;
}

function points(mesh){
  const pos=mesh.geometry.getAttribute('position');
  return Array.from({length:pos.count},(_,i)=>new V().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld));
}
const snap=n=>Math.round(n*10000)/10000;
const xz=p=>snap(p.x)+','+snap(p.z);

// Project the actual authored western woodland border, removing interior
// triangle edges. Only this ground surface protrudes past the valley floor.
function westernBorder(mesh,limit){
  if(!mesh)return [];
  const verts=points(mesh),index=mesh.geometry.index,open=new Map();
  for(let i=0;i<(index?.count??verts.length);i+=3){
    const tri=[0,1,2].map(j=>verts[index?index.getX(i+j):i+j]);
    if(tri.every(p=>p.x>limit+.01))continue;
    for(let j=0;j<3;j++){
      const a=tri[j],b=tri[(j+1)%3],A=xz(a),B=xz(b);
      const key=A<B?A+'|'+B:B+'|'+A;
      if(open.has(key))open.delete(key);else open.set(key,[a,b]);
    }
  }
  return [...open.values()].filter(([a,b])=>Math.min(a.x,b.x)<limit&&Math.abs(a.z-b.z)>.00001);
}

function crossAt(a,b,value,axis){
  const t=(value-a[axis])/(b[axis]-a[axis]);
  return t>=-.00001&&t<=1.00001?a.clone().lerp(b,THREE.MathUtils.clamp(t,0,1)):null;
}

// At each end use real, projected triangle edges across turf, graded shore,
// water and far bank. Select the top visible skin wherever layers overlap.
function endSection(surfaces,z){
  const segments=[];
  for(const s of surfaces){
    const ix=s.mesh.geometry.index,vs=s.vertices;
    for(let i=0;i<(ix?.count??vs.length);i+=3){
      const v=[0,1,2].map(j=>vs[ix?ix.getX(i+j):i+j]).filter(p=>Math.abs(p.z-z)<.0002);
      if(v.length===2&&Math.abs(v[0].x-v[1].x)>.00001)segments.push({a:v[0],b:v[1],water:s.water});
    }
  }
  const xs=[...new Set(segments.flatMap(s=>[snap(s.a.x),snap(s.b.x)]))].sort((a,b)=>a-b);
  return xs.map(x=>{
    let top=null,wet=false;
    for(const s of segments){
      const p=crossAt(s.a,s.b,x,'x');
      if(p&&(!top||p.y>top.y-.00001)){top=p;wet=s.water;}
    }
    return top&&{x,y:top.y,z,wet};
  }).filter(Boolean);
}

export function valleyOutline(surfaces,woodland){
  const land=surfaces.filter(s=>!s.water);
  if(!land.length)return [];
  const box=new THREE.Box3();
  for(const s of land)for(const v of s.vertices)box.expandByPoint(v);
  const {min,max}=box,west=westernBorder(woodland,min.x);
  const north=endSection(surfaces,min.z),south=endSection(surfaces,max.z).reverse();
  if(north.length<2||south.length<2)return [];
  const boundaryZ=new Set([min.z,max.z]);
  for(let z=Math.ceil(min.z);z<max.z;z+=1)boundaryZ.add(z);
  for(const [a,b] of west){
    boundaryZ.add(snap(a.z));boundaryZ.add(snap(b.z));
    if((a.x-min.x)*(b.x-min.x)<0)boundaryZ.add(snap(crossAt(a,b,min.x,'x').z));
  }
  const zs=[...boundaryZ].filter(z=>z>min.z+.0001&&z<max.z-.0001).sort((a,b)=>a-b);
  const left=zs.map(z=>{
    let x=min.x,y=north[0].y;
    for(const [a,b] of west){
      const p=crossAt(a,b,z,'z');if(p&&p.x<x){x=p.x;y=p.y;}
    }
    return {x,y,z,wet:false};
  });
  const east=zs.filter(z=>Number.isInteger(z)).map(z=>({x:max.x,y:north.at(-1).y,z,wet:false}));
  return [...north,...east,...south,...left.reverse()];
}

export function cutaway(outline){
  if(outline.length<3)return null;
  const verts=[],colors=[],soil=['#95845c','#807051','#6c6859','#64665d','#565951'];
  const color=new THREE.Color();
  function face(a,b,c,tint,value){
    verts.push(...a,...b,...c);color.set(tint).multiplyScalar(value);
    for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);
  }
  const levels=outline.map(({x,y,z,wet})=>{
    const joint=.14*Math.sin(x*.27+z*.19)+.074*Math.cos(z*.54-x*.15);
    return [y,y-(wet?.26:.19),-1.69+joint,-2.38+joint*.72,-3.06+joint*.33,cutDepth].map(h=>[x,h,z]);
  });
  const rand=seedRandom(481);
  for(let i=0;i<outline.length;i++){
    const j=(i+1)%outline.length;
    for(let k=0;k<levels[i].length-1;k++){
      const tint=k===0&&outline[i].wet&&outline[j].wet?'#4b9994':soil[k];
      const shade=1+((rand()-.5)*.078);
      face(levels[i][k],levels[j][k],levels[i][k+1],tint,shade);
      face(levels[j][k],levels[j][k+1],levels[i][k+1],tint,shade+.014);
    }
  }
  const triangles=THREE.ShapeUtils.triangulateShape(outline.map(p=>new THREE.Vector2(p.x,p.z)),[]);
  for(const tri of triangles)face(...tri.map(i=>levels[i].at(-1)),'#575a50',.91);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,side:THREE.DoubleSide}));
  m.name='Earth and bedrock / continuous valley cutaway';m.receiveShadow=true;return m;
}

function fallenTrunk(){
  const pos=[],col=[],pigment=new THREE.Color();
  function face(a,b,c,color){pos.push(...a,...b,...c);pigment.set(color);for(let i=0;i<3;i++)col.push(pigment.r,pigment.g,pigment.b);}
  function branch(a,b,r,R){
    const av=new V(...a),bv=new V(...b),dir=bv.clone().sub(av).normalize();
    const u=dir.clone().cross(new V(0,1,0)).normalize(),v=dir.clone().cross(u);
    const ring=(p,radius)=>Array.from({length:8},(_,i)=>p.clone().addScaledVector(u,radius*Math.cos(i*Math.PI/4)).addScaledVector(v,radius*Math.sin(i*Math.PI/4)).toArray());
    const A=ring(av,r),B=ring(bv,R),cap=ring(bv,R*.69);
    for(let i=0;i<8;i++){
      const j=(i+1)%8,tint=['#6e5841','#7f6847','#67533b','#87724c'][i%4];
      face(A[i],A[j],B[j],tint);face(A[i],B[j],B[i],tint);
      face(a,A[j],A[i],'#a8895e');face(B[i],B[j],cap[j],'#b99a69');
      face(B[i],cap[j],cap[i],'#b99a69');face(b,cap[i],cap[j],'#917653');
    }
  }
  branch([-.10,.15,-.76],[.11,.12,.76],.145,.121);
  branch([.01,.16,-.06],[-.23,.31,.24],.066,.038);
  branch([.06,.19,.22],[.27,.36,.46],.056,.026);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
}

// Keep planting within the two unbuildable strips. An analytical clearance
// against each curved palisade bay leaves space for previews and enemy entry.
function plantMargins(model,terrain,grid){
  const carrier=[];model.traverse(n=>{if(n.isInstancedMesh)carrier.push(n);});
  const find=name=>carrier.find(n=>(n.userData.name||n.parent?.userData.name||n.name).startsWith(name));
  const stockade=find('Sharpened palisade'),shrub=find('Riverbank Shrub'),fir=find('Silver fir');
  const stone=find('River Boulder Cluster'),oak=find('Meadow Oak');
  if(!stockade||!shrub||!fir||!stone||!oak)return;
  const points=[],matrix=new THREE.Matrix4(),p=new V();
  for(let i=0;i<stockade.count;i++){
    stockade.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix).applyMatrix4(stockade.matrixWorld);points.push(p.clone());
  }
  const types=[shrub,stone,fir,oak,{geometry:fallenTrunk(),material:shrub.material}];
  const radius=[.58,.88,.96,1.26,.82],spec=types.map(()=>[]),rand=seedRandom(621),half=grid.size/2;
  const ray=new THREE.Raycaster(new V(),new V(0,-1,0));ray.far=9;
  const planted=[],dummy=new THREE.Object3D();
  function plant(side,z,x,kind,s){
    const r=radius[kind]*s;
    if(side*x-r<half+.08||Math.abs(z-side*14)<1.62+r||Math.abs(z)+r>19.6)return;
    if(points.some(p=>Math.hypot(p.x-x,p.z-z)<r+1.05))return;
    if(side<0){
      const nearby=points.filter(p=>Math.abs(p.z-z)<1.65);
      if(!nearby.length||x-r<Math.max(...nearby.map(p=>p.x))+.45)return;
    }
    if(planted.some(a=>Math.hypot(a.x-x,a.z-z)<(a.r+r)*.85))return;
    ray.ray.origin.set(x,4,z);
    const hit=ray.intersectObject(terrain,false)[0];if(!hit||Math.abs(hit.point.y)>.065)return;
    planted.push({x,z,r});dummy.position.set(x,hit.point.y-.014,z);dummy.rotation.y=rand()*Math.PI*2;
    dummy.scale.setScalar(s);dummy.updateMatrix();spec[kind].push(dummy.matrix.clone());
    return true;
  }
  for(const side of [-1,1]){
    for(const center of [-7.9,.1,6.9]){
      for(let j=0;j<5;j++){
        if(plant(side,center+(rand()-.5)*1.4,side*(half+.88+rand()*1.8),4,.76+rand()*.23))break;
      }
    }
    for(const center of [-16.4,-10.1,-6.5,-1.2,3.2,8.4,12.4,16.9]){
      // Place the largest crown first so low scrub does not use up every opening.
      const tree=rand()<.52?2:3;
      for(let j=0;j<7;j++){
        const x=side*(half+.70+rand()*2.82),z=center+(rand()-.5)*2.3;
        if(plant(side,z,x,tree,.54+rand()*.22))break;
      }
      for(let j=0;j<16;j++){
        const z=center+(rand()-.5)*3.75,x=side*(half+.32+rand()*3.70);
        const kind=j===0?4:j%9===1?2:j%11===3?3:j%3===0?1:0;
        plant(side,z,x,kind,(kind===2||kind===3?.47:.62)+rand()*.35);
      }
    }
  }
  types.forEach((type,i)=>{
    if(!spec[i].length){if(i===4)type.geometry.dispose();return;}
    const m=new THREE.InstancedMesh(type.geometry,type.material,spec[i].length);
    m.name='Woodland margin / '+['shrubs','boulders','fir saplings','young oaks','fallen trunks'][i];
    spec[i].forEach((M,j)=>m.setMatrixAt(j,M));m.castShadow=true;m.receiveShadow=true;
    m.computeBoundingSphere();model.add(m);
  });
}

export function finishMeadowTerrain(model,grid){
  const surfaces=[];let turf,woodland;
  model.updateMatrixWorld(true);
  model.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isInstancedMesh)return;
    const label=mesh.parent?.userData.name||mesh.userData.name||'';
    const water=label.startsWith('River current and wakes');
    if(label.startsWith('Meadow, banks and river')||water){
      surfaces.push({mesh,vertices:points(mesh),water});
      if(water)mesh.castShadow=false;
      if(mesh.material.name==='Meadow turf')turf=mesh;
    }
    if(label.startsWith('Western orc camp')&&mesh.material.name==='Yard soil and turf')woodland=mesh;
  });
  if(!turf)return;
  tintTurf(turf);
  const sides=cutaway(valleyOutline(surfaces,woodland));if(sides)model.add(sides);
  plantMargins(model,turf,grid);
}

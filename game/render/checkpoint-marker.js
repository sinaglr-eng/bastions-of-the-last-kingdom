import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {checkpointVignetteGeometries} from './checkpoint-vignettes.js';

export const CHECKPOINT_ROMAN_LABELS=Object.freeze(['I','II','III','IV','V']);
const colors={spawn:'#923e34',checkpoint:'#366c87',keep:'#b99b4c'};
const materials=new Map();
const noPick=()=>{};
function material(color,metalness=0,roughness=.9){
  const key=`${color}:${metalness}:${roughness}`;
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,metalness,roughness,flatShading:true}));
  return materials.get(key);
}
const clothX=[.2,.295,.39,.485,.58],clothZ=[.15,.167,.143,.172,.157],clothBottom=[.9,.9,.94,.9,.9];
const clothTop=1.42,clothThickness=.012,labelX=.39,labelY=1.17;
function sample(values,x){
  const i=Math.min(clothX.length-2,Math.max(0,clothX.findIndex((edge,j)=>j<clothX.length-1&&x<=clothX[j+1])));
  const t=(x-clothX[i])/(clothX[i+1]-clothX[i]);return values[i]+(values[i+1]-values[i])*t;
}
function clothGeometry(){
  const positions=[],uvs=[],indices=[],rows=[0,.27,.73,1],cols=clothX.length,front=cols*rows.length;
  for(const side of [1,-1])for(const fraction of rows)for(let i=0;i<cols;i++){
    positions.push(clothX[i],clothBottom[i]+fraction*(clothTop-clothBottom[i]),clothZ[i]+side*clothThickness/2);uvs.push(i/(cols-1),fraction);
  }
  for(let row=0;row<rows.length-1;row++)for(let i=0;i<cols-1;i++){
    const a=row*cols+i,b=a+1,c=a+cols,d=c+1;
    indices.push(a,b,c,b,d,c,a+front,c+front,b+front,b+front,c+front,d+front);
  }
  const rim=[...Array.from({length:cols},(_,i)=>i),...Array.from({length:rows.length-1},(_,i)=>(i+1)*cols+cols-1),...Array.from({length:cols-1},(_,i)=>(rows.length-1)*cols+cols-2-i),...Array.from({length:rows.length-2},(_,i)=>(rows.length-2-i)*cols)];
  for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length];indices.push(a,a+front,b,b,a+front,b+front);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
function clipX(points,limit,keepGreater){
  const result=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=keepGreater?limit-a[0]:a[0]-limit,db=keepGreater?limit-b[0]:b[0]-limit;
    if(da<=1e-10)result.push(a);
    if((da<=0)!==(db<=0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  const distinct=result.filter((point,i)=>i===0||Math.hypot(point[0]-result[i-1][0],point[1]-result[i-1][1])>1e-10);
  if(distinct.length>1&&Math.hypot(distinct[0][0]-distinct.at(-1)[0],distinct[0][1]-distinct.at(-1)[1])<1e-10)distinct.pop();
  return distinct;
}
// Split embroidery at every real cloth crease, so both faces follow its facets
// instead of floating as a flat sign over the banner.
function surfacePatches(outlines,side){
  const positions=[],uvs=[];
  for(const source of outlines){
    let outline=source.map(([x,y])=>[side===1?x:2*labelX-x,y]);
    const area=outline.reduce((sum,p,i)=>{const q=outline[(i+1)%outline.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    if(Math.sign(area)!==side)outline=outline.reverse();
    for(let i=0;i<clothX.length-1;i++){
      const part=clipX(clipX(outline,clothX[i],true),clothX[i+1],false);if(part.length<3)continue;
      for(let j=1;j<part.length-1;j++){
        const a=part[0],b=part[j],c=part[j+1];if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-12)continue;
        for(const [x,y] of [a,b,c]){positions.push(x,y,sample(clothZ,x)+side*(clothThickness/2+.0015));uvs.push(x,y);}
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();return geometry;
}
const rectangle=(x,y,w,h)=>[[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]];
function stroke(a,b,width){
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/length*width/2,ny=(b[0]-a[0])/length*width/2;
  return [[a[0]+nx,a[1]+ny],[a[0]-nx,a[1]-ny],[b[0]-nx,b[1]-ny],[b[0]+nx,b[1]+ny]];
}
function numeralOutlines(label){
  const widths={I:.068,V:.14},gap=.021,total=[...label].reduce((sum,c)=>sum+widths[c],0)+Math.max(0,label.length-1)*gap,outlines=[];
  let cursor=labelX-total/2;
  for(const c of label){
    const x=cursor+widths[c]/2;
    if(c==='I')outlines.push(rectangle(x,labelY,.027,.24),rectangle(x,labelY+.115,.068,.027),rectangle(x,labelY-.115,.068,.027));
    else outlines.push(stroke([x-.06,labelY+.12],[x,labelY-.12],.028),stroke([x,labelY-.12],[x+.06,labelY+.12],.028));
    cursor+=widths[c]+gap;
  }
  return outlines;
}

// Local origin remains the logical checkpoint centre. The world supplies its
// existing position and CHECKPOINT_MARKER_SCALE; this is decorative geometry.
export function createCheckpointMarker({label='',kind='checkpoint'}={}){
  if(!Object.hasOwn(colors,kind))throw new RangeError(`Unknown checkpoint kind: ${kind}`);
  if(label!==''&&!CHECKPOINT_ROMAN_LABELS.includes(label))throw new RangeError(`Unsupported checkpoint numeral: ${label}`);
  const root=new THREE.Group();root.name=`${kind} checkpoint ${label}`.trim();root.userData={kind,label};
  const batches=new Map();
  const add=(geometry,mat,position=[0,0,0],rotation=[0,0,0])=>{
    const prepared=geometry.index?geometry.toNonIndexed():geometry;if(prepared!==geometry)geometry.dispose();
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(1,1,1));prepared.applyMatrix4(matrix);
    if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(prepared);
  };
  const stone=material('#899181'),light=material('#abb39d'),dark=material('#4d594d'),wood=material('#66543d'),metal=material('#b8a36e',.65,.38),ink=material('#f1e6c7',.05,.85);
  add(new THREE.CylinderGeometry(.51,.53,.038,8),stone,[0,.054,0]);
  add(new THREE.CylinderGeometry(.445,.455,.067,8),dark,[0,.1065,0]);
  // Eight fitted stone faces have real chisel notches, with the recessed core
  // visible inside them. The octagonal foot stays inside the old marker plate.
  const width=.345,height=.067;
  for(let i=0;i<8;i++){
    const shape=new THREE.Shape();shape.moveTo(-width/2,-height/2);shape.lineTo(width/2,-height/2);shape.lineTo(width/2,height/2);shape.lineTo(.022,height/2);shape.lineTo(0,height/2-.016);shape.lineTo(-.022,height/2);shape.lineTo(-width/2,height/2);shape.closePath();
    const angle=i*Math.PI/4;
    add(new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:1,steps:1}),i%3===0?light:stone,[Math.sin(angle)*.435,.1065,Math.cos(angle)*.435],[0,angle,0]);
  }
  add(new THREE.CylinderGeometry(.478,.466,.024,8),light,[0,.152,0]);
  add(new THREE.TorusGeometry(.475,.007,4,8),metal,[0,.161,0],[Math.PI/2,0,0]);
  if(kind==='checkpoint')for(const part of checkpointVignetteGeometries(label))add(part.geometry,material(part.color,part.metalness,part.roughness));
  add(new THREE.CylinderGeometry(.047,.056,.054,8),metal,[.18,.18,.15]);
  add(new THREE.CylinderGeometry(.019,.024,1.43,6),wood,[.18,.865,.15]);
  for(const y of [.25,1.395,1.535])add(new THREE.CylinderGeometry(.026,.026,.035,6),metal,[.18,y,.15]);
  const header=[{x:.18,z:.15},...clothX.map((x,i)=>({x,z:clothZ[i]}))];
  for(let i=1;i<header.length;i++){const a=header[i-1],b=header[i],dx=b.x-a.x,dz=b.z-a.z;add(new THREE.BoxGeometry(Math.hypot(dx,dz),.023,.023),metal,[(a.x+b.x)/2,1.429,(a.z+b.z)/2],[0,-Math.atan2(dz,dx),0]);}
  add(new THREE.ConeGeometry(.049,.10,4),metal,[.18,1.625,.15]);
  const cloth=new THREE.Mesh(clothGeometry(),material(colors[kind]));cloth.name='Faceted checkpoint cloth';cloth.userData.checkpointPart='cloth';root.add(cloth);
  const hem=[rectangle(labelX,clothTop-.017,.374,.012)];
  for(let i=0;i<clothX.length-1;i++)hem.push(stroke([clothX[i],clothBottom[i]+.017],[clothX[i+1],clothBottom[i+1]+.017],.012));
  for(const side of [1,-1]){
    add(surfacePatches(hem,side),metal);
    const outlines=label?numeralOutlines(label):[stroke([labelX-.062,labelY+.085],[labelX,labelY-.065],.022),stroke([labelX,labelY-.065],[labelX+.062,labelY+.085],.022)];
    const glyph=new THREE.Mesh(surfacePatches(outlines,side),ink);glyph.name=`Checkpoint ${label||kind} ${side===1?'front':'back'} embroidery`;glyph.userData.checkpointPart=side===1?'frontNumeral':'backNumeral';root.add(glyph);
  }
  for(const [mat,geometries] of batches){const mesh=new THREE.Mesh(mergeGeometries(geometries),mat);mesh.name='Checkpoint stone and fittings';root.add(mesh);for(const geometry of geometries)geometry.dispose();}
  root.traverse(node=>{node.raycast=noPick;if(node.isMesh){node.castShadow=node.receiveShadow=true;}});
  return root;
}

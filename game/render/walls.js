import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BATTLEFIELD_UNIT_SCALE} from './battlefield-scale.js';

// Goblin Thornstriders (wave 2), terrain to highest point of the actual head
// and ears in the native host_02 GLB. The spear is taller than the creature.
export const WALL_REFERENCE_ENEMY_NATIVE_HEIGHT=1.294288992881775;
export const WALL_DECK_HEIGHT=WALL_REFERENCE_ENEMY_NATIVE_HEIGHT*BATTLEFIELD_UNIT_SCALE;
export const hasWallFoundation=t=>t.state==='ruin'||t.state==='active';
// Cardinal and diagonal connections. Kept defenders occupy a masonry platform.
export function wallConnections(t,towers){
  let mask=0;
  for(const [dx,dz,bit]of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8],[1,-1,16],[1,1,32],[-1,1,64],[-1,-1,128]])if(towers.some(n=>hasWallFoundation(n)&&n.x===t.x+dx&&n.z===t.z+dz))mask|=bit;
  return mask;
}
const colors=['#58665e','#969e8b','#abb09b','#bac0a8','#657953'];
const mats=colors.map(color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}));
function clipStone(points,nx,nz,limit){
  const result=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],da=nx*a[0]+nz*a[1]-limit,db=nx*b[0]+nz*b[1]-limit;
    if(da<=0)result.push(a);
    if((da<=0)!==(db<=0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return result;
}
function pavingStone(points){
  // The upper face is level with the defender's soles. Only the narrow bevel
  // and mortar joints descend, with no raised decoration beneath the model.
  const edges=points.map((a,i)=>{const b=points[(i+1)%points.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);return[(b[1]-a[1])/length,-(b[0]-a[0])/length];});
  const inset=points.map((p,i)=>{
    const a=edges[(i+points.length-1)%points.length],b=edges[i],ca=a[0]*p[0]+a[1]*p[1]-.003,cb=b[0]*p[0]+b[1]*p[1]-.003,det=a[0]*b[1]-b[0]*a[1];
    return[(ca*b[1]-cb*a[1])/det,(a[0]*cb-b[0]*ca)/det];
  });
  const positions=[],uvs=[],indices=[],count=points.length;
  for(const [outline,y]of [[points,WALL_DECK_HEIGHT-.026],[points,WALL_DECK_HEIGHT-.004],[inset,WALL_DECK_HEIGHT]])for(const [x,z]of outline){positions.push(x,y,z);uvs.push(x+.5,z+.5);}
  for(let row=0;row<2;row++)for(let i=0;i<count;i++){
    const a=row*count+i,b=row*count+(i+1)%count,c=a+count,d=b+count;
    indices.push(a,c,b,b,c,d);
  }
  for(let i=1;i<count-1;i++)indices.push(0,i,i+1,count*2,count*2+i+1,count*2+i);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
export function castleWallModel(mask=0,platform=false){
  const batches=mats.map(()=>[]);
  function block(x,y,z,w,h,d,m=1){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);batches[m].push(g);}
  // Keep the first course broad, then step back the upper masonry by 20%.
  const capTop=WALL_DECK_HEIGHT-.095,coreTop=capTop-.045;
  const courseCount=Math.ceil((coreTop-.1)/.16),coursePitch=(coreTop-.1)/courseCount;
  const courseHeight=Math.min(.143,coursePitch-.014);
  const courses=Array.from({length:courseCount},(_,row)=>.1+(row+.5)*coursePitch);
  block(0,.05,0,.58,.1,.58,0);
  block(0,(.1+coreTop)/2,0,.344,coreTop-.1,.344,0);
  block(0,.1+coursePitch/2,0,.43,coursePitch,.43,0);
  for(let row=0;row<courseCount;row++){
    const y=courses[row];
    for(let side=0;side<4;side++)for(let j=0;j<2;j++){
      const inset=row===0?1:.8,offset=(j-.5)*.22*inset,front=.224*inset;
      if(side%2===0)block(offset,y,side===0?-front:front,.207*inset,courseHeight,.055*inset,1+(row+j+side)%3);
      else block(side===1?front:-front,y,offset,.055*inset,courseHeight,.207*inset,1+(row+j+side)%3);
    }
  }
  // Paired half-bridges meet at the shared tile corner, linking diagonal crenellations.
  for(const [dx,dz,bit,cardinals]of [[1,-1,16,3],[1,1,32,6],[-1,1,64,12],[-1,-1,128,9]])if((mask&bit)&&!(mask&cardinals)){
    const angled=(y,width,height,length,m)=>{const g=new THREE.BoxGeometry(width,height,length);g.rotateY(Math.atan2(dx,dz));g.translate(dx*.36,y,dz*.36);batches[m].push(g);};
    angled(.06,.39,.10,.55,0);angled((.1+coreTop)/2,.232,coreTop-.1,.53,0);
    for(let row=0;row<courseCount;row++)angled(courses[row],row===0?.32:.256,courseHeight,.50,1+row%3);
    angled(capTop-.045,.32,.09,.55,3);angled(WALL_DECK_HEIGHT-(platform?.075:.02),.16,.15,.22,2);
  }
  block(0,capTop-.045,0,.46,.09,.46,3);
  // Crenellated top reads as a castle wall, even when only one tile is built.
  if(platform){
    // Corbelled fighting deck, dressed foot course and recessed upper stonework.
    block(0,.06,0,.91,.12,.91,0);
    const platformCoreTop=WALL_DECK_HEIGHT-.12;
    block(0,(.12+platformCoreTop)/2,0,.624,platformCoreTop-.12,.624,0);
    const platformCourses=Math.ceil((platformCoreTop-.12)/.16),platformPitch=(platformCoreTop-.12)/platformCourses;
    block(0,.12+platformPitch/2,0,.78,platformPitch,.78,0);
    for(let row=0;row<platformCourses;row++)for(let side=0;side<4;side++)for(let j=0;j<3;j++){
      const inset=row===0?1:.8,offset=(j-1)*.26*inset,y=.12+(row+.5)*platformPitch,h=Math.min(.143,platformPitch-.014);
      if(side%2===0)block(offset,y,side===0?-.393*inset:.393*inset,.244*inset,h,.05*inset,1+(row+j+side)%3);
      else block(side===1?.393*inset:-.393*inset,y,offset,.05*inset,h,.244*inset,1+(row+j+side)%3);
    }
    for(const x of [-.265,.265])for(const z of [-.265,.265]){
      block(x,WALL_DECK_HEIGHT-.205,z,.17,.13,.17,2);
      block(x,WALL_DECK_HEIGHT-.145,z,.25,.05,.25,3);
    }
    block(0,WALL_DECK_HEIGHT-.115,0,.84,.035,.84,0);
    const deck=new THREE.Shape();
    for(const [i,[x,z]]of [[-.43,-.47],[.43,-.47],[.47,-.43],[.47,.43],[.43,.47],[-.43,.47],[-.47,.43],[-.47,-.43]].entries())i?deck.lineTo(x,z):deck.moveTo(x,z);
    deck.closePath();
    const cap=new THREE.ExtrudeGeometry(deck,{depth:.094,bevelEnabled:false,steps:1});cap.setIndex(Array.from({length:cap.attributes.position.count},(_,i)=>i));cap.rotateX(-Math.PI/2);cap.translate(0,WALL_DECK_HEIGHT-.1,0);batches[1].push(cap);
    // Staggered dressed slabs share the existing masonry batches. The cornice
    // remains continuous beneath the shallow joints and clipped corner stones.
    const rows=[[-.467,-.156],[-.149,.149],[.156,.467]];
    for(let row=0;row<rows.length;row++){
      const [z0,z1]=rows[row],cuts=row===1?[-.467,-.225,.115,.467]:[-.467,-.157,.157,.467];
      for(let column=0;column<3;column++){
        const x0=cuts[column]+(column? .0035:0),x1=cuts[column+1]-(column<2?.0035:0);
        let outline=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
        for(const [nx,nz]of [[1,1],[-1,1],[-1,-1],[1,-1]])outline=clipStone(outline,nx,nz,.9);
        batches[1+(row+column*2)%3].push(pavingStone(outline));
      }
    }
    // Recessed edge joints break up the cornice without protruding through feet.
    for(const side of [-1,1])for(const offset of [-.22,0,.22]){
      block(offset,WALL_DECK_HEIGHT-.056,side*.471,.009,.078,.004,0);
      block(side*.471,WALL_DECK_HEIGHT-.056,offset,.004,.078,.009,0);
    }
  }else for(const x of [-.14,.14])for(const z of [-.14,.14])block(x,WALL_DECK_HEIGHT-.015,z,.148,.17,.148,2);
  for(const [dx,dz,bit]of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]])if(mask&bit){
    const horizontal=dx!==0;
    block(dx*.365,.045,dz*.365,horizontal?.27:.46,.09,horizontal?.46:.27,0);
    block(dx*.365,(.1+coreTop)/2,dz*.365,horizontal?.27:.264,coreTop-.1,horizontal?.264:.27,0);
    for(let row=0;row<courseCount;row++){
      const inset=row===0?1:.8;
      for(const side of [-1,1])block(horizontal?dx*.374:side*.174*inset,courses[row],horizontal?side*.174*inset:dz*.374,horizontal?.248:.043*inset,courseHeight,horizontal?.043*inset:.248,1+(row+(side===1?1:0))%3);
    }
    block(dx*.375,capTop-.04,dz*.375,horizontal?.25:.352,.08,horizontal?.352:.25,3);
  }
  // A little lichen low on the stone, never tall scenery on the playable field.
  block(-.10,.095,.257,.09,.031,.016,4);block(.14,.235,-.205,.07,.023,.016,4);
  const root=new THREE.Group();root.name='Castle masonry';
  batches.forEach((parts,i)=>{if(!parts.length)return;const mesh=new THREE.Mesh(mergeGeometries(parts),mats[i]);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);parts.forEach(g=>g.dispose());});
  return root;
}

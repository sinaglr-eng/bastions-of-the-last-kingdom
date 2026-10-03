import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BATTLEFIELD_UNIT_SCALE} from './battlefield-scale.js';

// Goblin Thornstriders (wave 2), terrain to highest point of the actual head
// and ears in the native host_02 GLB. The spear is taller than the creature.
export const WALL_REFERENCE_ENEMY_NATIVE_HEIGHT=1.3236541152000427;
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
    const cap=new THREE.ExtrudeGeometry(deck,{depth:.1,bevelEnabled:false,steps:1});cap.setIndex(Array.from({length:cap.attributes.position.count},(_,i)=>i));cap.rotateX(-Math.PI/2);cap.translate(0,WALL_DECK_HEIGHT-.1,0);batches[3].push(cap);
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

import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BATTLEFIELD_UNIT_SCALE} from './battlefield-scale.js';

// Goblin Thornstriders (wave 2), terrain to highest point of the actual head
// and ears in the native host_02 GLB. The spear is taller than the creature.
export const WALL_REFERENCE_ENEMY_NATIVE_HEIGHT=1.4006540775299072;
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
  // Add dressed courses to reach the fighting deck; keep bricks, foundations
  // and tile widths at their existing size rather than stretching the masonry.
  const capTop=WALL_DECK_HEIGHT-.095,coreTop=capTop-.045;
  const courseCount=Math.ceil((coreTop-.1)/.16),coursePitch=(coreTop-.1)/courseCount;
  const courseHeight=Math.min(.143,coursePitch-.014);
  const courses=Array.from({length:courseCount},(_,row)=>.1+(row+.5)*coursePitch);
  block(0,.05,0,.58,.1,.58,0);
  block(0,(.1+coreTop)/2,0,.43,coreTop-.1,.43,0);
  for(let row=0;row<courseCount;row++){
    const y=courses[row];
    for(let side=0;side<4;side++)for(let j=0;j<2;j++){
      const offset=(j-.5)*.22,front=.224;
      if(side%2===0)block(offset,y,side===0?-front:front,.207,courseHeight,.055,1+(row+j+side)%3);
      else block(side===1?front:-front,y,offset,.055,courseHeight,.207,1+(row+j+side)%3);
    }
  }
  // Paired half-bridges meet at the shared tile corner, linking diagonal crenellations.
  for(const [dx,dz,bit,cardinals]of [[1,-1,16,3],[1,1,32,6],[-1,1,64,12],[-1,-1,128,9]])if((mask&bit)&&!(mask&cardinals)){
    const angled=(y,width,height,length,m)=>{const g=new THREE.BoxGeometry(width,height,length);g.rotateY(Math.atan2(dx,dz));g.translate(dx*.36,y,dz*.36);batches[m].push(g);};
    angled(.06,.39,.10,.55,0);angled((.1+coreTop)/2,.29,coreTop-.1,.53,0);
    for(let row=0;row<courseCount;row++)angled(courses[row],.32,courseHeight,.50,1+row%3);
    angled(capTop-.045,.40,.09,.55,3);angled(WALL_DECK_HEIGHT-(platform?.075:.02),.20,.15,.22,2);
  }
  block(0,capTop-.045,0,.55,.09,.55,3);
  // Crenellated top reads as a castle wall, even when only one tile is built.
  if(platform){
    // Broad stone fighting platform supports the miniature's entire round plinth.
    block(0,.06,0,.91,.12,.91,0);
    const platformCoreTop=WALL_DECK_HEIGHT-.12;
    block(0,(.12+platformCoreTop)/2,0,.78,platformCoreTop-.12,.78,0);
    const platformCourses=Math.ceil((platformCoreTop-.12)/.16),platformPitch=(platformCoreTop-.12)/platformCourses;
    for(let row=0;row<platformCourses;row++)for(let side=0;side<4;side++)for(let j=0;j<3;j++){
      const offset=(j-1)*.26,y=.12+(row+.5)*platformPitch,h=Math.min(.143,platformPitch-.014);
      if(side%2===0)block(offset,y,side===0?-.393:.393,.244,h,.05,1+(row+j)%3);
      else block(side===1?.393:-.393,y,offset,.05,h,.244,1+(row+j)%3);
    }
    block(0,WALL_DECK_HEIGHT-.06,0,.94,.12,.94,3);
  }else for(const x of [-.175,.175])for(const z of [-.175,.175])block(x,WALL_DECK_HEIGHT-.015,z,.185,.17,.185,2);
  for(const [dx,dz,bit]of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]])if(mask&bit){
    const horizontal=dx!==0;
    block(dx*.365,.045,dz*.365,horizontal?.27:.46,.09,horizontal?.46:.27,0);
    block(dx*.365,(.1+coreTop)/2,dz*.365,horizontal?.27:.33,coreTop-.1,horizontal?.33:.27,0);
    for(let row=0;row<courseCount;row++){
      for(const side of [-1,1])block(horizontal?dx*.374:side*.174,courses[row],horizontal?side*.174:dz*.374,horizontal?.248:.043,courseHeight,horizontal?.043:.248,1+(row+(side===1?1:0))%3);
    }
    block(dx*.375,capTop-.04,dz*.375,horizontal?.25:.44,.08,horizontal?.44:.25,3);
  }
  // A little lichen low on the stone, never tall scenery on the playable field.
  block(-.10,.095,.257,.09,.031,.016,4);block(.19,.235,-.254,.07,.023,.016,4);
  const root=new THREE.Group();root.name='Castle masonry';
  batches.forEach((parts,i)=>{if(!parts.length)return;const mesh=new THREE.Mesh(mergeGeometries(parts),mats[i]);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);parts.forEach(g=>g.dispose());});
  return root;
}

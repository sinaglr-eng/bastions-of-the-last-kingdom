import * as THREE from 'three';

export const RANK_COLORS=['#3989ed','#3eac63','#9555d8','#eee9db','#e7b43f','#ffd969'];
export const rankColor=tier=>RANK_COLORS[Math.max(0,Math.min(5,tier-1))];
const oldCloth={soldier:'#4187a2',archer:'#54945b',druid:'#528b68',mage:'#8a62bd',cleric:'#eee3bd',runebreaker:'#805787',frostwarden:'#66b3c4',stormcaller:'#d2a645'};

// Recolor existing cloth only; the other seven character designs await archer approval.
export function applyRankCloth(root,family,tier){
  const original=new THREE.Color(oldCloth[family]);
  const cape=new THREE.Color('#bd4857');
  root.traverse(o=>{if(o.isMesh&&o.material.color&&[original,cape].some(color=>o.material.color.toArray().every((v,i)=>Math.abs(v-color.toArray()[i])<.002))){
    o.material=o.material.clone();o.material.color.set(rankColor(tier));
  }});
}

let glowTexture;
function radialGlow(){
  if(glowTexture)return glowTexture;
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,3,64,64,64);
  g.addColorStop(0,'rgba(255,237,173,.7)');g.addColorStop(.4,'rgba(255,206,88,.22)');g.addColorStop(1,'rgba(255,192,60,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);glowTexture=new THREE.CanvasTexture(c);return glowTexture;
}
export function rankAdornment(tier){
  const root=new THREE.Group();root.name='Rank signal';
  const ring=new THREE.Mesh(new THREE.RingGeometry(.40,.46,32),new THREE.MeshBasicMaterial({color:rankColor(tier),side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.172;root.add(ring);
  if(tier!==6)return root;
  root.name='Mythic aura';
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:radialGlow(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.8}));halo.position.y=.75;halo.scale.set(1.65,2.05,1);root.add(halo);
  const stars=new THREE.Group();stars.name='Orbiting radiance';root.add(stars);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;const star=new THREE.Mesh(new THREE.OctahedronGeometry(.027),new THREE.MeshBasicMaterial({color:'#fff1b7'}));star.position.set(Math.cos(a)*.51,.3+(i%3)*.28,Math.sin(a)*.51);stars.add(star);}
  return root;
}
export function animateRank(root,time){const stars=root.getObjectByName('Orbiting radiance');if(stars){stars.rotation.y=time*.65;stars.position.y=Math.sin(time*2)*.04;}}

import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {seededRandom} from '../core/math.js';
import {championModel} from './champions.js';
import {castleWallModel} from './walls.js';
import {rankColor} from './ranks.js';
import {kushekFallback} from './kushek.js';

const materials=new Map();
export function material(color,emissive=false) {
  const key=`${color}:${emissive}`;
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:0.88,metalness:0.05,flatShading:true,...(emissive?{emissive:color,emissiveIntensity:0.8}:{})}));
  return materials.get(key);
}
const palette={stone:'#9b9e95',light:'#c4c6b6',dark:'#616b68',wood:'#755234',edge:'#b58b53',roof:'#36576b',iron:'#3d484a',gold:'#c6a366',blue:'#3d80a0',white:'#ece0b9',skin:'#d8ab82'};
export function mesh(parent,geometry,color,pos=[0,0,0],rot=[0,0,0],emissive=false) {
  const m=new THREE.Mesh(geometry,material(color,emissive));m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
export const box=(p,size,color,pos=[0,0,0],rot=[0,0,0])=>mesh(p,new THREE.BoxGeometry(...size),color,pos,rot);
export const cylinder=(p,r1,r2,h,color,pos=[0,0,0],sides=8)=>mesh(p,new THREE.CylinderGeometry(r1,r2,h,sides),color,pos);
export const cone=(p,r,h,color,pos=[0,0,0],sides=6)=>mesh(p,new THREE.ConeGeometry(r,h,sides),color,pos);
export const sphere=(p,r,color,pos=[0,0,0])=>mesh(p,new THREE.IcosahedronGeometry(r,0),color,pos);
export function beam(p,a,b,width,color) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),mid=start.clone().add(end).multiplyScalar(0.5);
  const m=box(p,[width,start.distanceTo(end),width],color,mid.toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return m;
}
export function banner(p,x,y,z,color=palette.blue,scale=1) {
  cylinder(p,0.025*scale,0.025*scale,1.7*scale,palette.wood,[x,y+0.85*scale,z],5);
  const flag=box(p,[0.42*scale,0.6*scale,0.035],color,[x+0.2*scale,y+1.25*scale,z]);
  box(p,[0.06*scale,0.37*scale,0.044],palette.gold,[x+0.2*scale,y+1.28*scale,z]);
  cone(p,0.065*scale,0.16*scale,palette.gold,[x,y+1.78*scale,z],4);return flag;
}
export function battlement(p,y,width=0.9) {
  box(p,[width,0.14,width],palette.light,[0,y,0]);
  for(const x of [-1,1])for(const z of [-1,1])box(p,[0.2,0.24,0.2],palette.stone,[x*(width/2-0.08),y+0.15,z*(width/2-0.08)]);
}
export function optimize(root) {
  root.updateMatrixWorld(true);const byMaterial=new Map();
  root.traverse(o=>{if(o.isMesh){const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);const key=o.material.uuid;if(!byMaterial.has(key))byMaterial.set(key,{mat:o.material,list:[]});byMaterial.get(key).list.push(g);}});
  const result=new THREE.Group();
  for(const {mat,list} of byMaterial.values()){const geometry=mergeGeometries(list);const m=new THREE.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;result.add(m);list.forEach(g=>g.dispose());}
  root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});return result;
}
function archer(p,y=1.1) {
  cylinder(p,0.08,0.12,0.23,palette.blue,[0,y+0.17,0],5);
  sphere(p,0.09,palette.skin,[0,y+0.37,0]);cone(p,0.11,0.12,palette.iron,[0,y+0.46,0],6);
  beam(p,[-0.12,y+0.26,0],[0.14,y+0.27,0.1],0.055,palette.skin);
  beam(p,[0.18,y+0.07,0.05],[0.26,y+0.45,0.05],0.025,palette.edge);
}
function crossbow(p,y=1.05,large=false) {
  const w=large?0.8:0.6;
  box(p,[0.13,0.14,0.85],palette.wood,[0,y,0]);
  beam(p,[-w/2,y,-0.3],[0,y,-0.48],0.085,palette.edge);beam(p,[w/2,y,-0.3],[0,y,-0.48],0.085,palette.edge);
  beam(p,[-w/2,y,-0.3],[0,y,0.32],0.015,palette.white);beam(p,[w/2,y,-0.3],[0,y,0.32],0.015,palette.white);
  box(p,[0.035,0.04,1],palette.iron,[0,y+0.1,-0.1]);cylinder(p,0.14,0.2,0.22,palette.iron,[0,y-0.15,0]);
}
export const DEFENDER_FAMILIES=['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller'];
export function towerModel(family,tier=1,advanced=false,appearance=null) {
  if(advanced&&family!=='ruin')return championModel(family,{box,beam,sphere,cylinder,cone,mesh,optimize});
  if(!advanced&&DEFENDER_FAMILIES.includes(family))return defenderModel(family,tier);
  const p=new THREE.Group();
  if(family==='ruin') {
    return castleWallModel();
  }
  box(p,[0.88,0.17,0.88],palette.dark,[0,0.1,0]);box(p,[0.77,0.13,0.77],palette.stone,[0,0.25,0]);
  const actual=appearance||(advanced?({rimewatch:'archer',starfall:'mage',embercrown:'fire',sunward:'temple',thornwarden:'alchemist',winterhold:'frost',kingsreach:'ballista',dawnspire:'temple'}[family]||'mage'):family);
  if(actual==='archer') {
    for(const x of [-0.29,0.29])for(const z of [-0.29,0.29])box(p,[0.105,0.85,0.105],palette.wood,[x,0.72,z]);
    beam(p,[-0.3,0.35,0.3],[0.3,1.1,0.3],0.065,palette.edge);box(p,[0.8,0.13,0.8],palette.edge,[0,1.08,0]);
    for(const z of [-0.36,0.36])box(p,[0.8,0.2,0.06],palette.wood,[0,1.25,z]);archer(p);
  }else if(actual==='ballista'||actual==='crossbow') {
    box(p,[0.62,0.5,0.62],palette.stone,[0,0.52,0]);battlement(p,0.8);crossbow(p,1.09,actual==='ballista');
    if(actual==='ballista')for(const x of [-0.3,0.3])cylinder(p,0.12,0.12,0.2,palette.wood,[x,0.5,-0.1]);
  }else if(actual==='mage') {
    cylinder(p,0.28,0.36,1.23,palette.stone,[0,0.94,0],6);cylinder(p,0.4,0.3,0.18,palette.light,[0,1.51,0],6);
    for(let i=0;i<4;i++){const a=i*Math.PI/2;box(p,[0.06,0.38,0.06],'#8e80ad',[Math.cos(a)*0.31,1.05,Math.sin(a)*0.31]);}
    mesh(p,new THREE.OctahedronGeometry(0.25),'#bda0f1',[0,1.94,0],[0,0.4,0],true);
    cylinder(p,0.045,0.12,0.25,palette.gold,[0,1.72,0],6);
  }else if(actual==='frost') {
    box(p,[0.63,0.69,0.68],palette.light,[0,0.66,0]);cone(p,0.55,0.57,'#668e9d',[0,1.25,0],4).rotation.y=Math.PI/4;
    box(p,[0.16,0.27,0.04],'#9be4e8',[0,0.78,0.35]);cylinder(p,0.075,0.12,0.4,palette.light,[0,1.5,0]);mesh(p,new THREE.OctahedronGeometry(0.17),'#a8f3f5',[0,1.8,0],[0,0,0],true);
  }else if(actual==='fire') {
    cylinder(p,0.31,0.39,0.99,palette.stone,[0,0.8,0]);battlement(p,1.32);cylinder(p,0.3,0.15,0.22,palette.iron,[0,1.49,0]);cone(p,0.24,0.63,'#f99a38',[0,1.82,0],5);cone(p,0.13,0.52,'#ffe49d',[0,1.78,0],5);
  }else if(actual==='alchemist') {
    box(p,[0.64,0.6,0.7],palette.wood,[0,0.63,0]);cone(p,0.57,0.48,'#587665',[0,1.13,0],4).rotation.y=Math.PI/4;
    box(p,[0.14,0.67,0.16],palette.stone,[0.2,1.13,0.2]);sphere(p,0.15,'#a5c768',[-0.28,0.55,0.43]);cylinder(p,0.07,0.09,0.2,'#b3cb7a',[-0.28,0.72,0.43]);
    cylinder(p,0.16,0.21,0.35,'#a07e54',[0.32,0.43,-0.18]);
  }else {
    box(p,[0.66,0.7,0.64],palette.light,[0,0.65,0]);cone(p,0.53,0.5,palette.roof,[0,1.25,0],4).rotation.y=Math.PI/4;
    for(const x of [-0.27,0.27])cylinder(p,0.07,0.09,0.7,palette.stone,[x,0.69,0.33],6);
    cylinder(p,0.1,0.18,0.6,palette.gold,[0,1.58,0],6);sphere(p,0.19,'#ffe6a4',[0,1.95,0]);box(p,[0.18,0.3,0.04],palette.gold,[0,0.72,0.34]);
  }
  if(tier>=2||advanced)for(const x of [-0.36,0.36])box(p,[0.1,0.55,0.12],palette.iron,[x,0.6,0.34]);
  if(tier>=3||advanced){box(p,[0.88,0.25,0.86],palette.stone,[0,0.4,0]);box(p,[0.19,0.27,0.055],palette.blue,[0,0.57,0.44]);}
  if(tier>=4||advanced)banner(p,-0.35,0.45,-0.3,advanced?'#9980b7':palette.blue,0.6);
  if(tier>=5||advanced) {for(const x of [-0.36,0.36]){cone(p,0.09,0.3,palette.gold,[x,1.14,0.34],4);box(p,[0.07,0.75,0.08],palette.gold,[x,0.75,0.34]);}}
  if(advanced){for(const x of [-0.44,0.44]){cylinder(p,0.13,0.18,0.84,palette.light,[x,0.72,-0.28],6);cone(p,0.18,0.42,palette.roof,[x,1.35,-0.28],6);}box(p,[0.93,0.1,0.96],palette.gold,[0,0.21,0]);}
  return optimize(p);
}
// Original tabletop-sized adventurers. All face -Z and stay inside one placement tile.
export function defenderModel(family,tier=1) {
  if(family==='runebreaker')return kushekFallback(rankColor(tier),{box,beam,sphere,cylinder,cone,mesh,optimize});
  const p=new THREE.Group(),skin='#efbc90',ink='#233a3e',gold='#efc15d';
  const cloth=rankColor(tier);
  cylinder(p,.43,.46,.12,tier>=3?gold:'#8c9b91',[0,.07,0],10);
  cylinder(p,.39,.41,.07,'#a4b887',[0,.15,0],10);
  for(const x of [-.13,.13]){box(p,[.17,.23,.19],'#604638',[x,.31,.015]);box(p,[.2,.12,.3],'#384750',[x,.235,-.06]);}
  cylinder(p,.23,.3,.48,cloth,[0,.61,0],7);
  box(p,[.5,.08,.34],'#6c503b',[0,.48,0]);box(p,[.1,.1,.045],gold,[0,.48,-.18]);
  // Cape, sleeves and oversized hands keep the silhouette legible at map scale.
  box(p,[.45,.5,.08],cloth,[0,.64,.21],[.15,0,0]);
  for(const x of [-.29,.29]){sphere(p,.14,cloth,[x,.79,0]);beam(p,[x,.75,0],[x*1.08,.57,-.12],.12,cloth);sphere(p,.092,skin,[x*1.08,.55,-.14]);}
  const head=sphere(p,.29,skin,[0,1.06,-.025]);head.scale.set(1,1.04,.91);
  for(const x of [-.102,.102]){box(p,[.066,.082,.035],'#fff3d9',[x,1.085,-.261]);box(p,[.031,.05,.026],ink,[x+.008,1.079,-.287]);box(p,[.078,.025,.025],'#72513e',[x,1.15,-.26],[0,0,x>0?-.12:.12]);}
  sphere(p,.056,skin,[0,1.015,-.286]);box(p,[.075,.021,.028],'#935c4e',[0,.956,-.259]);
  if(family==='soldier') {
    cylinder(p,.265,.31,.21,'#8097a3',[0,1.26,0],8);sphere(p,.26,'#9bb3bd',[0,1.32,0]);
    for(const x of [-.26,.26])box(p,[.07,.23,.2],'#8097a3',[x,1.12,0]);
    box(p,[.095,.19,.36],'#d45454',[0,1.55,.035]);
    box(p,[.34,.42,.11],'#c8d6d3',[-.3,.61,-.25]);box(p,[.27,.34,.125],cloth,[-.3,.62,-.26]);box(p,[.045,.26,.14],gold,[-.3,.62,-.27]);
    beam(p,[.31,.52,-.16],[.35,1.29,-.17],.075,'#dbe8e9');box(p,[.24,.055,.1],gold,[.32,.7,-.17]);
    cone(p,.069,.2,'#eef5ef',[.35,1.36,-.17],4);
  } else if(family==='archer') {
    sphere(p,.3,'#365b42',[0,1.19,.065]);cone(p,.33,.26,cloth,[0,1.36,.02],7);
    beam(p,[.1,1.43,0],[.3,1.65,.02],.06,'#f0c570');
    box(p,[.2,.28,.17],'#795039',[.16,.76,.28]);for(let i=0;i<3;i++)beam(p,[.1+i*.06,.82,.29],[.1+i*.06,1.18,.29],.023,'#e5d6aa');
    for(const [a,b] of [[[.35,.29,-.2],[.44,.53,-.29]],[[.44,.53,-.29],[.44,.83,-.29]],[[.44,.83,-.29],[.35,1.06,-.2]]])beam(p,a,b,.045,'#d9a45e');
    beam(p,[.35,.29,-.2],[.35,1.06,-.2],.012,'#f6ecd1');beam(p,[.12,.61,-.24],[.4,.61,-.52],.026,'#ead5a0');
    box(p,[.4,.065,.39],'#bb6155',[0,.85,0]);
  } else if(family==='druid') {
    for(const side of [-1,1]){beam(p,[side*.19,1.26,0],[side*.28,1.55,0],.057,'#c8ae77');beam(p,[side*.28,1.49,0],[side*.41,1.57,0],.047,'#c8ae77');beam(p,[side*.28,1.49,0],[side*.26,1.69,0],.04,'#c8ae77');sphere(p,.105,'#86bc66',[side*.23,1.28,-.05]);}
    const beard=cone(p,.16,.31,'#ddd7b8',[0,.9,-.22],5);beard.rotation.z=Math.PI;
    beam(p,[.35,.18,-.04],[.36,1.37,-.04],.063,'#735338');sphere(p,.16,'#a9e581',[.36,1.44,-.04]);
    for(const x of [-.23,0,.23]){const leaf=cone(p,.13,.26,'#72a55e',[x,.72,-.16],4);leaf.rotation.z=Math.PI;}
    // A tiny mushroom familiar at the druid's feet.
    cylinder(p,.035,.045,.14,'#f2deb5',[-.31,.26,-.24],5);sphere(p,.11,'#cc7954',[-.31,.36,-.24]).scale.y=.55;
  } else if(family==='mage') {
    cylinder(p,.34,.36,.065,'#514575',[0,1.29,.01],9);
    cone(p,.285,.53,cloth,[0,1.56,.02],7);cone(p,.12,.22,cloth,[.1,1.83,.02],6).rotation.z=-.8;
    box(p,[.055,.12,.025],gold,[0,1.51,-.245]);box(p,[.11,.038,.025],gold,[0,1.51,-.25]);
    beam(p,[.34,.22,0],[.34,1.2,0],.058,'#67503f');sphere(p,.17,'#ceb1ff',[.34,1.37,0]);
    sphere(p,.1,'#d8b8ff',[-.35,.67,-.23]);box(p,[.08,.16,.04],gold,[0,.66,-.256]);
  } else if(family==='cleric') {
    cylinder(p,.245,.28,.09,'#f4e9cc',[0,1.27,.015],8);
    const halo=mesh(p,new THREE.TorusGeometry(.24,.024,4,16),gold,[0,1.56,0]);halo.rotation.x=Math.PI/2;
    for(const x of [-.13,.13])box(p,[.085,.45,.047],gold,[x,.64,-.246]);
    box(p,[.26,.23,.1],'#875856',[-.28,.66,-.26],[-.25,0,0]);box(p,[.22,.18,.045],'#fff0cd',[-.28,.66,-.32],[-.25,0,0]);
    beam(p,[.34,.19,0],[.34,1.29,0],.055,gold);sphere(p,.12,'#ffe9ab',[.34,1.35,0]);box(p,[.26,.045,.055],gold,[.34,1.35,0]);
  } else if(family==='frostwarden') {
    sphere(p,.31,'#d3ece9',[0,1.18,.08]);cone(p,.28,.32,cloth,[0,1.43,.045],6);
    box(p,[.47,.1,.38],'#ecf2e4',[0,.84,0]);
    beam(p,[.34,.18,0],[.34,1.3,0],.054,'#709baf');mesh(p,new THREE.OctahedronGeometry(.16),'#b8f1fc',[.34,1.42,0]);
    for(const x of [-.16,0,.16])mesh(p,new THREE.OctahedronGeometry(.075),'#d4f5ed',[x,.57,-.25]);
  } else if(family==='stormcaller') {
    sphere(p,.29,'#506e94',[0,1.24,.025]);box(p,[.5,.09,.43],gold,[0,1.25,.015]);sphere(p,.09,'#d7e8ed',[0,1.32,-.255]);
    for(const x of [-.34,.34]){sphere(p,.12,'#fae59a',[x,.7,-.22]);beam(p,[x,.78,-.22],[x+.035,.98,-.22],.034,'#faf2d3');beam(p,[x+.035,.98,-.22],[x-.015,1.07,-.22],.034,'#faf2d3');}
    box(p,[.2,.22,.045],'#456d95',[0,.67,-.255]);
  }
  if(tier>=2)for(const x of [-.28,.28])box(p,[.17,.085,.22],tier>=4?gold:'#b6c7c6',[x,.85,.01]);
  if(tier>=3){sphere(p,.072,gold,[0,.8,-.25]);box(p,[.055,.25,.045],gold,[0,.63,-.27]);}
  if(tier>=4)for(const x of [-.23,.23])box(p,[.05,.48,.03],gold,[x,.65,.258]);
  if(tier>=5)for(const x of [-.14,0,.14])cone(p,.047,.15,gold,[x,1.4,-.2],4);
  if(tier>=6){
    const ring=mesh(p,new THREE.TorusGeometry(.38,.022,4,20),gold,[0,.25,0]);ring.rotation.x=Math.PI/2;
    for(const x of [-.25,.25]){mesh(p,new THREE.OctahedronGeometry(.08),'#fff0b5',[x,1.65,.03]);beam(p,[x,.93,.15],[x,1.4,.15],.033,gold);}
    box(p,[.17,.34,.04],'#f3d071',[0,.61,.27]);
  }
  return optimize(p);
}
export function treeModel(deciduous=false) {
  const p=new THREE.Group();cylinder(p,0.075,0.16,1.2,palette.wood,[0,0.6,0],5);
  if(deciduous){sphere(p,0.78,'#7d9060',[0,1.65,0]);sphere(p,0.55,'#94a76c',[0.38,1.82,0]);}
  else {cone(p,0.8,1.6,'#294e46',[0,1.5,0],7);cone(p,0.62,1.4,'#386453',[0,2.15,0],7);cone(p,0.43,1.15,'#4e7c61',[0,2.75,0],7);}
  return p;
}
export function rockModel(seed=1,large=false) {
  const r=seededRandom(seed),p=new THREE.Group();
  for(let i=0;i<(large?4:2);i++){const m=sphere(p,0.5+r()*0.5,i%2?'#7d8b82':'#64746f',[(r()-0.5)*1.1,0.3,(r()-0.5)*0.8]);m.scale.set(1,0.6+r(),0.8);m.rotation.set(r(),r(),r());}
  return p;
}
export function keepModel() {
  const p=new THREE.Group();box(p,[4.7,0.3,4.6],palette.dark,[0,0.1,0]);
  box(p,[2.1,2.7,2.1],palette.stone,[0,1.5,0]);cone(p,1.8,1.65,palette.roof,[0,3.7,0],4).rotation.y=Math.PI/4;
  for(const x of [-1.8,1.8])for(const z of [-1.5,1.5]){cylinder(p,0.51,0.63,2.4,palette.stone,[x,1.4,z],8);cone(p,0.75,1.3,palette.roof,[x,3.05,z],8);cylinder(p,0.63,0.55,0.3,palette.light,[x,2.5,z],8);}
  box(p,[4,1.25,0.32],palette.stone,[0,0.8,-1.5]);box(p,[4,1.25,0.32],palette.stone,[0,0.8,1.5]);
  box(p,[0.32,1.25,3],palette.stone,[1.8,0.8,0]);
  for(const z of [-1.16,1.16])box(p,[0.32,1.25,0.7],palette.stone,[-1.8,0.8,z]);
  for(let x=-1.4;x<=1.4;x+=0.45)for(const z of [-1.5,1.5])box(p,[0.24,0.35,0.35],palette.light,[x,1.57,z]);
  for(const z of [-0.48,0.48])box(p,[0.06,0.62,0.28],palette.gold,[-1.08,1.7,z]);
  banner(p,0,4.25,0,palette.blue,0.85);banner(p,-1.84,1.6,-0.73,palette.blue,0.65);return p;
}
export function houseModel(ruined=false) {
  const p=new THREE.Group();box(p,[1.4,0.9,1.1],ruined?palette.dark:'#c0b49a',[0,0.5,0]);
  if(!ruined)cone(p,1.08,0.9,'#785c47',[0,1.35,0],4).rotation.y=Math.PI/4;
  for(const x of [-0.61,0.61])box(p,[0.1,0.95,1.12],palette.wood,[x,0.5,0]);
  box(p,[0.25,0.58,0.03],palette.wood,[0.15,0.38,0.57]);box(p,[0.18,0.24,0.03],palette.gold,[-0.35,0.62,0.57]);return p;
}
export function campModel() {
  const p=new THREE.Group();
  for(const [x,z] of [[-1.4,0],[1.3,-0.5],[0,1.8]]){cone(p,1,1.6,'#725044',[x,0.8,z],4).rotation.y=Math.PI/4;beam(p,[x-0.8,0,z],[x,1.9,z],0.1,'#463c2e');beam(p,[x+0.8,0,z],[x,1.9,z],0.1,'#463c2e');}
  for(let z=-2;z<3;z+=0.5){cylinder(p,0.08,0.12,1.3,palette.wood,[2.5,0.65,z],5);cone(p,0.09,0.22,'#dfd2af',[2.5,1.4,z],5);}
  banner(p,0,0,-1.6,'#863f38',1.25);return p;
}
export function enemyModel(type,stats) {
  type=stats.model||type;
  const p=new THREE.Group();const skin=stats.color,heavy=['ogre','warlord','troll'].includes(type);
  const body=new THREE.Group();p.add(body);p.userData.body=body;
  const limbs=[];
  for(const x of [-0.13,0.13]){const leg=new THREE.Group();leg.position.set(x,0.38,0);box(leg,[0.14,0.32,0.18],'#554b3e',[0,-0.16,0]);box(leg,[0.16,0.09,0.25],'#343b34',[0,-0.32,-0.05]);body.add(leg);limbs.push(leg);}
  cylinder(body,0.19,0.15,0.38,skin,[0,0.53,0],6);box(body,[0.37,0.18,0.22],'#5b5040',[0,0.42,0]);
  sphere(body,0.185,skin,[0,0.85,-0.03]);sphere(body,0.12,skin,[0,0.78,-0.15]);
  for(const x of [-0.09,0.09]){box(body,[0.032,0.025,0.027],'#edd19a',[x,0.88,-0.181]);cone(body,0.026,0.12,'#dbd3b0',[x,0.79,-0.23],4);}
  for(const x of [-0.28,0.28]){const arm=new THREE.Group();arm.position.set(x,0.66,0);box(arm,[0.13,0.36,0.16],skin,[0,-0.12,0]);body.add(arm);limbs.push(arm);}
  if(type==='shield'||type==='ogre'||type==='warlord'){box(body,[0.3,0.36,0.1],'#535e62',[-0.34,0.46,-0.17]);box(body,[0.07,0.25,0.11],'#a5956a',[-0.34,0.46,-0.18]);cone(body,0.21,0.18,'#4b5657',[0,1.01,0],6);}
  if(type==='shaman'||type==='warlock'){cone(body,0.31,0.5,type==='shaman'?'#774d4b':'#514663',[0,0.44,0],6);beam(body,[0.38,0.15,0],[0.38,1.25,0],0.045,palette.wood);sphere(body,0.12,type==='shaman'?'#bbdd8b':'#b58aca',[0.38,1.28,0]);}
  else {beam(body,[0.3,0.2,0],[0.3,0.78,-0.1],0.06,palette.wood);box(body,[0.2,0.18,0.09],palette.iron,[0.3,0.8,-0.1]);}
  if(type==='wolf'){const wolf=box(body,[0.42,0.32,0.9],'#71796e',[0,0.26,-0.15]);sphere(body,0.24,'#848c7c',[0,0.41,-0.62]);wolf.rotation.x=0.07;}
  if(type==='wyvern'){for(const side of [-1,1]){const wing=cone(body,0.57,0.06,'#826c64',[side*0.65,0.56,0.1],3);wing.rotation.z=side*0.3;}box(body,[0.2,0.13,1.1],'#657664',[0,0.4,0.2]);}
  if(type==='sapper')sphere(body,0.28,'#77533a',[0,0.62,0.27]);
  const clan=['#98483c','#596b86','#777141','#695583','#ba8c46'][stats.clan||0];
  box(body,[.38,.07,.27],clan,[0,.59,0]);
  if(type==='assassin'){
    sphere(body,.24,'#384951',[0,.87,.035]);cone(body,.25,.31,clan,[0,1.05,.02],5);
    box(body,[.27,.09,.09],'#242e37',[0,.82,-.21]);
    cone(body,.32,.47,'#384951',[0,.56,.17],5);
    for(const x of [-.31,.31]){beam(body,[x,.44,-.1],[x,.79,-.36],.038,'#d6e8d6');cone(body,.047,.18,'#d6e8d6',[x,.85,-.39],3);}
  }
  if(type==='bat'||type==='dragon'){
    const dragon=type==='dragon',hide=dragon?'#675270':'#705065',span=dragon?1.8:1.25;
    sphere(body,.26,hide,[0,.35,-.26]).scale.set(1,1,2);
    for(const side of [-1,1]){
      const shape=new THREE.Shape();shape.moveTo(.15,.04);shape.lineTo(span,.4);shape.lineTo(span*.9,-.4);shape.lineTo(span*.6,-.16);shape.lineTo(span*.32,-.38);shape.closePath();
      const wing=mesh(body,new THREE.ShapeGeometry(shape),hide,[0,.4,0]);wing.rotation.x=-Math.PI/2;wing.userData.restRotation=-Math.PI/2;wing.scale.x=side;wing.material=wing.material.clone();wing.material.side=THREE.DoubleSide;limbs.push(wing);
      beam(body,[side*.13,.43,0],[side*span,.43,-.4],.035,'#c2aa83');
      cone(body,.075,.32,'#b8b094',[side*.15,.51,-.57],3);
    }
    if(dragon){
      beam(body,[0,.24,.2],[0,.14,1.2],.16,hide);cone(body,.24,.42,clan,[0,.24,1.32],3).rotation.x=Math.PI/2;
      sphere(body,.25,hide,[0,.39,-.72]);box(body,[.27,.18,.35],hide,[0,.33,-.96]);
      for(const x of [-.16,.16])cone(body,.07,.36,'#ddc292',[x,.59,-.72],4);
      for(let z=.3;z<1.2;z+=.2)cone(body,.07,.19,clan,[0,.4-z*.13,z],4);
      cylinder(body,.26,.2,.12,'#c4a360',[0,1,0],6);for(const x of [-.15,0,.15])cone(body,.045,.19,'#e7c371',[x,1.13,0],4);
    }
  }
  if(type==='balloon'){
    cylinder(body,.33,.28,.3,'#755335',[0,.31,0],8);box(body,[.7,.07,.52],clan,[0,.46,0]);
    for(const x of [-.29,.29])for(const z of [-.22,.22])beam(body,[x,.42,z],[x,1.56,z],.018,'#d3bb85');
    const balloon=sphere(body,.57,clan,[0,1.75,0]);balloon.scale.set(1,1.25,1);
    for(const x of [-.18,.18])box(body,[.08,.61,.91],'#cfb98b',[x,1.73,0]);
    cone(body,.29,.38,'#685343',[0,1.25,0],8).rotation.z=Math.PI;
    sphere(body,.07,'#ffcb6d',[0,1.13,0]);p.userData.barHeight=2.65;
  }
  if(stats.refraction){const shards=new THREE.Group();for(let i=0;i<3;i++){const a=i*Math.PI*2/3;mesh(shards,new THREE.OctahedronGeometry(.08),'#a5dfdf',[Math.sin(a)*.4,1.06,Math.cos(a)*.4]);}body.add(shards);p.userData.shards=shards;}
  if(stats.magicImmune)for(const x of [-.26,.26])mesh(body,new THREE.OctahedronGeometry(.12),'#e7b767',[x,.75,0]);
  if(stats.physicalImmune){const halo=mesh(body,new THREE.TorusGeometry(.32,.026,4,18),'#8bbbc9',[0,.47,0]);halo.rotation.x=Math.PI/2;}
  if(heavy)for(const x of [-0.23,0.23])cone(body,0.11,0.28,'#d1c6a9',[x,0.86,0.1],4);
  const bounds=new THREE.Box3().setFromObject(body),height=bounds.getSize(new THREE.Vector3()).y;
  const visualHeight=stats.boss?3.30:stats.model==='goblin'?1.82:1.98;
  p.scale.setScalar(visualHeight/height);p.userData.barHeight=bounds.max.y+.18;
  p.userData.limbs=limbs;return p;
}

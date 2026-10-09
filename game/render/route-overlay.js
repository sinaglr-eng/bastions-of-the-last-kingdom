import * as THREE from 'three';
import {SIZE} from '../core/grid.js';

export const ROUTE_COLORS={current:'#9b783f',flying:'#66dbea'};
export const CHECKPOINT_MARKER_SCALE=1.15;
const half=(SIZE-1)/2;
const motion=new WeakMap(),arrowPitch=5.2,arrowSpeed=.64;
function placeArrows(state){
  const {arrows,segments,total,matrix}=state;
  for(let i=0;i<arrows.count;i++){
    const distance=(arrowPitch/2+i*arrowPitch+state.elapsed*arrowSpeed)%total;
    let low=0,high=segments.length-1;
    while(low<high){const middle=(low+high)>>1;if(distance<segments[middle].end)high=middle;else low=middle+1;}
    const segment=segments[low],along=distance-segment.start;
    matrix.makeRotationY(Math.atan2(-segment.uz,segment.ux));
    matrix.setPosition(segment.x+segment.ux*along-half,.18,segment.z+segment.uz*along-half);
    arrows.setMatrixAt(i,matrix);
  }
  arrows.instanceMatrix.needsUpdate=true;
}
// Preallocated instances travel by accumulated route distance, so every marker
// turns at a real checkpoint/corner rather than cutting across the maze.
export function animateRouteOverlay(group,dt,{reducedMotion=false,paused=false}={}){
  if(!group.visible||reducedMotion||paused||!Number.isFinite(dt)||dt<=0)return;
  const state=motion.get(group);
  if(state){state.elapsed+=Math.min(dt,.1);placeArrows(state);}
  for(const child of group.children)if(child.isGroup)animateRouteOverlay(child,dt,{reducedMotion,paused});
}
export function currentEnemyRoute(game){
  const active=game.phase==='combat'?game.combat.enemies.find(enemy=>!enemy.dead):null;
  const queued=game.phase==='combat'?game.combat.spawnQueue[0]:null;
  const type=queued?.type||game.wave?.groups?.[0]?.type;
  const definition={...game.data.enemies[type],...queued?.modifiers?.variant};
  const flying=active?.flying??!!definition.flying;
  return {flying,points:active?.route||(flying?game.grid.checkpoints:game.grid.route)};
}
export const routeDistance=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.z-points[i].z),0);
export const sameRoute=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((p,i)=>p.x===b[i].x&&p.z===b[i].z);
export function disposeRouteOverlay(group){
  group.traverse(node=>{motion.delete(node);node.geometry?.dispose();if(node.isInstancedMesh)node.dispose();if(node.material)for(const material of Array.isArray(node.material)?node.material:[node.material])material.dispose();});
  group.clear();
}
// World-space ribbons keep their visible width at every browser resolution.
export function createRouteOverlay(points,{flying=false}={}){
  const group=new THREE.Group();group.name='Current enemy route';
  if(!points?.length)return group;
  const stroke=[],border=[],segments=[],y=.136;
  const vertex=(target,x,z,height=y)=>target.push(x-half,height,z-half);
  const quad=(target,a,b,width,height=y)=>{
    const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<1e-9)return;
    const nx=-(b.z-a.z)/length*width/2,nz=(b.x-a.x)/length*width/2;
    for(const [x,z] of [[a.x+nx,a.z+nz],[a.x-nx,a.z-nz],[b.x+nx,b.z+nz],[b.x+nx,b.z+nz],[a.x-nx,a.z-nz],[b.x-nx,b.z-nz]])vertex(target,x,z,height);
  };
  let traveled=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(!length)continue;
    const ux=(b.x-a.x)/length,uz=(b.z-a.z)/length;
    segments.push({x:a.x,z:a.z,ux,uz,start:traveled,end:traveled+length});
    quad(border,a,b,.065,y-.002);quad(stroke,a,b,.034);
    traveled+=length;
  }
  const add=(values,color,opacity,name)=>{
    if(!values.length)return;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity,depthWrite:false,toneMapped:false}));
    mesh.name=name;mesh.raycast=()=>{};group.add(mesh);
  };
  const color=flying?ROUTE_COLORS.flying:ROUTE_COLORS.current;
  add(border,'#59604c',.14,'Current route edge');add(stroke,color,.4,'Current route continuous ribbon');
  if(traveled){
    // Opaque, bevelled miniature arrows float above the quiet route ribbon.
    // One shared solid mesh keeps even a long maze inexpensive to animate.
    const outline=new THREE.Shape();outline.moveTo(-.17,-.065);
    for(const [x,y]of [[.02,-.065],[.02,-.15],[.23,0],[.02,.15],[.02,.065],[-.17,.065]])outline.lineTo(x,y);
    outline.closePath();
    const geometry=new THREE.ExtrudeGeometry(outline,{depth:.04,bevelEnabled:true,bevelSize:.007,bevelThickness:.007,bevelSegments:1,steps:1});geometry.rotateX(-Math.PI/2);
    const arrows=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color:flying?'#a6ddd7':'#e6cd9c',roughness:.72,metalness:.08}),Math.max(1,Math.floor(traveled/arrowPitch)));
    arrows.name='Current route direction arrows';arrows.raycast=()=>{};arrows.frustumCulled=false;group.add(arrows);
    const state={arrows,segments,total:traveled,elapsed:0,matrix:new THREE.Matrix4()};motion.set(group,state);placeArrows(state);
  }
  group.userData={flying,distance:traveled,route:points.map(({x,z})=>({x,z}))};
  return group;
}

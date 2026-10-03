import * as THREE from 'three';
import {SIZE} from '../core/grid.js';

export const ROUTE_COLORS={current:'#f0bc59',flying:'#66dbea',planned:'#bb91ef'};
export const CHECKPOINT_MARKER_SCALE=1.15;
const half=(SIZE-1)/2;
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
  group.traverse(node=>{node.geometry?.dispose();if(node.isInstancedMesh)node.dispose();if(node.material)for(const material of Array.isArray(node.material)?node.material:[node.material])material.dispose();});
  group.clear();
}
// World-space ribbons keep their visible width at every browser resolution.
// Planned dashes share one accumulated distance across tile boundaries.
export function createRouteOverlay(points,{planned=false,flying=false}={}){
  const group=new THREE.Group();group.name=planned?'Route after completing blueprint':'Current enemy route';
  if(!points?.length)return group;
  const stroke=[],border=[],arrows=[],y=planned?.126:.136;
  const vertex=(target,x,z,height=y)=>target.push(x-half,height,z-half);
  const quad=(target,a,b,width,height=y)=>{
    const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<1e-9)return;
    const nx=-(b.z-a.z)/length*width/2,nz=(b.x-a.x)/length*width/2;
    for(const [x,z] of [[a.x+nx,a.z+nz],[a.x-nx,a.z-nz],[b.x+nx,b.z+nz],[b.x+nx,b.z+nz],[a.x-nx,a.z-nz],[b.x-nx,b.z-nz]])vertex(target,x,z,height);
  };
  let traveled=0,nextArrow=2;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(!length)continue;
    const ux=(b.x-a.x)/length,uz=(b.z-a.z)/length,at=d=>({x:a.x+ux*d,z:a.z+uz*d});
    if(planned){
      const pitch=.56,dash=.29;let offset=0;
      while(offset<length-1e-9){
        const phase=(traveled+offset)%pitch,step=Math.min(length-offset,(phase<dash?dash:pitch)-phase);
        if(step<1e-9){offset+=1e-8;continue;}
        if(phase<dash){quad(border,at(offset),at(offset+step),.115,y-.002);quad(stroke,at(offset),at(offset+step),.07);}
        offset+=step;
      }
    }else{
      quad(border,a,b,.15,y-.002);quad(stroke,a,b,.09);
      while(nextArrow<=traveled+length){
        const p=at(nextArrow-traveled),nx=-uz,nz=ux;
        vertex(arrows,p.x+ux*.19,p.z+uz*.19,y+.001);
        vertex(arrows,p.x-ux*.11+nx*.14,p.z-uz*.11+nz*.14,y+.001);
        vertex(arrows,p.x-ux*.11-nx*.14,p.z-uz*.11-nz*.14,y+.001);
        nextArrow+=4;
      }
    }
    traveled+=length;
  }
  const add=(values,color,opacity,name)=>{
    if(!values.length)return;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity,depthWrite:false,toneMapped:false}));
    mesh.name=name;mesh.raycast=()=>{};group.add(mesh);
  };
  const color=planned?ROUTE_COLORS.planned:flying?ROUTE_COLORS.flying:ROUTE_COLORS.current;
  add(border,planned?'#342b53':'#5c4428',.55,planned?'Planned route dash edges':'Current route edge');add(stroke,color,planned?.9:.94,planned?'Planned route dashes':'Current route continuous ribbon');add(arrows,color,1,'Current route direction arrows');
  group.userData={planned,flying,distance:traveled,route:points.map(({x,z})=>({x,z}))};
  return group;
}

import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const paint=(geometry,color)=>{
  const c=new THREE.Color(color),values=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b;}
  geometry.setAttribute('color',new THREE.BufferAttribute(values,3));return geometry;
};
const merge=parts=>{
  const flat=parts.map(p=>p.index?p.toNonIndexed():p),attributes=new Set(flat.flatMap(p=>Object.keys(p.attributes)));
  for(const name of attributes)if(!flat.every(p=>p.attributes[name]))for(const p of flat)p.deleteAttribute(name);
  const result=mergeGeometries(flat);
  for(const p of new Set([...parts,...flat]))p.dispose();return result;
};
const tube=(points,radius=.018,segments=points.length*3)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,5,false);

// Curved, tapering open ribbons have a flame silhouette from every camera side
// without opaque cones or a single billboard cutting through the miniature.
function flameRibbons(low=false){
  const parts=[],layers=[{width:.21,height:1,color:'#f25a18'},{width:.13,height:.77,color:'#ffb735'},{width:.065,height:.51,color:'#fff2bb'}];
  for(const [layer,l]of layers.entries())for(let face=0;face<3;face++){
    const positions=[],colors=[],color=new THREE.Color(l.color),angle=face*Math.PI/3+layer*.28;
    for(let step=0;step<8;step++){
      const t=step/7,y=t*l.height,w=l.width*Math.pow(1-t,.72),bend=Math.sin(t*Math.PI)*.055+Math.pow(t,3)*.065;
      for(const sign of [-1,1]){
        const x=sign*w+bend,z=Math.sin(t*5+layer)*.018;
        positions.push(Math.cos(angle)*x-Math.sin(angle)*z,y,Math.sin(angle)*x+Math.cos(angle)*z);
        const shade=1-t*.12;colors.push(color.r*shade,color.g*shade,color.b*shade);
      }
    }
    const indices=[];for(let row=0;row<7;row++){const a=row*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();parts.push(g);
  }
  for(let i=0;i<(low?2:3);i++)parts.push(paint(new THREE.IcosahedronGeometry(.018+i*.004,0).translate(Math.sin(i*3)*.14,1.04+i*.13,Math.cos(i*3)*.10),'#ffd16a'));
  return merge(parts);
}

function cross(barred){
  const shape=new THREE.Shape(),points=[[-.045,-.16],[.045,-.16],[.045,-.045],[.16,-.045],[.16,.045],[.045,.045],[.045,.16],[-.045,.16],[-.045,.045],[-.16,.045],[-.16,-.045],[-.045,-.045]];
  shape.moveTo(...points[0]);for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();
  const backing=paint(new THREE.ExtrudeGeometry(shape,{depth:.026,bevelEnabled:false}),barred?'#53274e':'#641f38');
  const face=paint(new THREE.ExtrudeGeometry(shape,{depth:.016,bevelEnabled:false}).scale(.83,.83,1).translate(0,0,.029),barred?'#e8a0e5':'#ff7596');
  const parts=[backing,face];
  if(barred){parts.push(paint(new THREE.BoxGeometry(.47,.055,.025).rotateZ(-Math.PI/4).translate(0,0,.054),'#65305e'));parts.push(paint(new THREE.BoxGeometry(.45,.023,.02).rotateZ(-Math.PI/4).translate(0,0,.071),'#fbd3f4'));}
  return merge(parts);
}

export function statusGeometry(shape){
  if(shape==='flame'||shape==='heatFlame')return flameRibbons(shape==='heatFlame');
  if(shape==='cloud')return merge([
    paint(new THREE.IcosahedronGeometry(.18,2),'#80c93f'),paint(new THREE.IcosahedronGeometry(.13,2).translate(.12,.04,.05),'#9cdd51'),
    paint(new THREE.SphereGeometry(.055,10,8).translate(-.075,.25,0),'#c3ef77'),paint(new THREE.SphereGeometry(.034,8,6).translate(.1,.34,.04),'#b2e564'),
  ]);
  if(shape==='wind'){
    const points=Array.from({length:65},(_,i)=>{const t=i/64,a=t*Math.PI*4;return[Math.cos(a),t*1.1,Math.sin(a)];});
    return merge([paint(tube(points,.045,64),'#67e7f3'),paint(tube(points.map(([x,y,z])=>[x*.98,y+.025,z*.98]),.014,64),'#d7ffff')]);
  }
  if(shape==='ice'){
    const parts=[paint(new THREE.SphereGeometry(1,12,8,.18,Math.PI*1.42,.38,Math.PI*.76),'#82cce6')];
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2;parts.push(paint(new THREE.OctahedronGeometry(.22,0).scale(.7,1.6,.65).rotateZ(Math.sin(a)*.35).translate(Math.cos(a)*.88,Math.sin(a*2)*.24,Math.sin(a)*.88),i%2?'#c4f4ff':'#85cee8'));}
    return merge(parts);
  }
  if(shape==='stone'){
    const parts=[];for(let i=0;i<6;i++){const a=i/6*Math.PI*2;parts.push(paint(new THREE.IcosahedronGeometry(.48,0).scale(.6,1.5,.75).rotateY(a).translate(Math.cos(a)*.7,Math.sin(a*2)*.18,Math.sin(a)*.7),i%2?'#a7ad97':'#777e72'));}return merge(parts);
  }
  if(shape==='star'){
    const points=Array.from({length:10},(_,i)=>{const angle=i*Math.PI/5+Math.PI/2,r=i%2?.045:.105;return new THREE.Vector2(Math.cos(angle)*r,Math.sin(angle)*r);});
    return new THREE.ExtrudeGeometry(new THREE.Shape(points),{depth:.025,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:1});
  }
  if(shape==='roots'){
    const parts=[];for(let branch=0;branch<3;branch++){
      const points=Array.from({length:25},(_,i)=>{const t=i/24,a=t*Math.PI*2.3+branch*2.1;return[Math.cos(a)*(.26-t*.025),(t-.5)*.30,Math.sin(a)*(.26-t*.025)];});
      parts.push(paint(tube(points,.027+branch*.003,32),branch%2?'#936334':'#c18f4c'));
      const a=branch*2.1;parts.push(paint(tube([[Math.cos(a)*.25,-.09,Math.sin(a)*.25],[Math.cos(a+.3)*.34,-.11,Math.sin(a+.3)*.34],[Math.cos(a+.45)*.39,-.05,Math.sin(a+.45)*.39]],.018,8),'#8d622e'));
      parts.push(paint(new THREE.OctahedronGeometry(.045,0).scale(1.2,.35,.5).rotateY(-a).translate(Math.cos(a+.2)*.3,.11,Math.sin(a+.2)*.3),'#8eab51'));
    }return merge(parts);
  }
  if(shape==='flake'){
    const shape=new THREE.Shape([new THREE.Vector2(-.07,-.09),new THREE.Vector2(.04,-.10),new THREE.Vector2(.075,.015),new THREE.Vector2(.025,.09),new THREE.Vector2(-.06,.06),new THREE.Vector2(-.035,-.015)]);
    return new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:1});
  }
  if(shape==='drop')return new THREE.LatheGeometry([new THREE.Vector2(0,-.09),new THREE.Vector2(.04,-.06),new THREE.Vector2(.052,-.015),new THREE.Vector2(.035,.035),new THREE.Vector2(0,.10)],8);
  if(shape==='cross'||shape==='barredCross')return cross(shape==='barredCross');
  if(shape==='brokenShell')return merge([
    paint(new THREE.TorusGeometry(.34,.036,5,16,Math.PI*.68),'#f6bd67'),paint(new THREE.TorusGeometry(.34,.036,5,16,Math.PI*.68).rotateZ(Math.PI),'#cf8a42'),
    paint(tube([[.10,.15,0],[.065,.07,0],[.115,.035,0],[.07,-.045,0]],.018,10),'#fff0ba'),
  ]);
  if(shape==='rune'){
    const parts=[];for(let ring=0;ring<2;ring++){
      const pts=Array.from({length:7},(_,i)=>{const a=i/6*Math.PI*2;return[Math.cos(a)*.3,Math.sin(a)*.24,Math.sin(a+ring*Math.PI/2)*.10];});
      parts.push(paint(tube(pts,.013,24).rotateY(ring*Math.PI/2),'#be9aff'));
    }
    for(let i=0;i<4;i++){const a=i/4*Math.PI*2;parts.push(paint(tube([[-.045,-.025,0],[0,.025,0],[.045,-.025,0]],.008,6).translate(Math.cos(a)*.32,Math.sin(a)*.26,.02),'#eee0ff'));}return merge(parts);
  }
  if(shape==='flash'){
    const parts=[];for(let i=0;i<4;i++){const a=i*Math.PI/2+.3,pts=[[0,0,0],[.16,.055,0],[.22,-.045,0],[.43,.08,0]].map(([x,y,z])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a),z]);parts.push(tube(pts,i%2?.018:.025,6));}return merge(parts);
  }
  return new THREE.IcosahedronGeometry(.045,1);
}

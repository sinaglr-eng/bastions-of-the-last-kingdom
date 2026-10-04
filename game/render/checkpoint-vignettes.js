import * as THREE from 'three';

const deck=.164;
const palette={stone:'#899181',light:'#abb39d',dark:'#4d594d',wood:'#66543d',timber:'#9b774b',metal:'#b8a36e',ivory:'#f1e6c7',cloth:'#526a70',fire:'#d97532'};
// Parts own only transient geometry. The marker transfers them to its existing
// shared material batches; no prop mesh survives the world scenery merge.
export function checkpointVignetteGeometries(label){
  const parts=[];
  const add=(name,geometry,color,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1])=>{
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));geometry.applyMatrix4(matrix);
    parts.push({name,geometry,color:palette[color],metalness:color==='metal'?.65:color==='ivory'?.05:0,roughness:color==='metal'?.38:color==='ivory'?.85:.9});return geometry;
  };
  const box=(name,size,color,position,rotation)=>add(name,new THREE.BoxGeometry(...size),color,position,rotation);
  const cylinder=(name,radius,height,color,position,rotation,sides=8)=>add(name,new THREE.CylinderGeometry(radius,radius,height,sides),color,position,rotation);
  const beam=(name,a,b,width,color,depth=width)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),geometry=new THREE.BoxGeometry(width,start.distanceTo(end),depth);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize()));return add(name,geometry,color,start.add(end).multiplyScalar(.5).toArray());
  };
  const rock=(name,x,z,width,height,depth,color='stone',bottom=deck)=>{
    const geometry=new THREE.IcosahedronGeometry(1,0);geometry.scale(width,height,depth);
    const positions=geometry.attributes.position;for(let i=0;i<positions.count;i++)positions.setY(i,Math.max(-height*.45,positions.getY(i)));
    geometry.computeVertexNormals();geometry.computeBoundingBox();return add(name,geometry,color,[x,bottom-geometry.boundingBox.min.y,z]);
  };
  const barrel=(name,x,z,bottom,height=.24,radius=.10)=>{
    const profile=[new THREE.Vector2(radius*.79,-height/2),new THREE.Vector2(radius*.92,-height*.36),new THREE.Vector2(radius,height*.02),new THREE.Vector2(radius*.91,height*.37),new THREE.Vector2(radius*.79,height/2)];
    add(name+' staves',new THREE.LatheGeometry(profile,10),'timber',[x,bottom+height/2,z]);
    for(const sign of [-1,1])cylinder(name+' end '+sign,radius*.79,.014,'wood',[x,bottom+height/2+sign*(height/2-.005),z]);
    for(const t of [.16,.78]){
      const r=radius*(t<.5?.92:.91);add(name+' iron hoop '+t,new THREE.CylinderGeometry(r+.006,r+.006,.023,10,1,true),'dark',[x,bottom+height*t,z]);
    }
    cylinder(name+' powder bung',.018,.022,'metal',[x,bottom+height+.005,z],undefined,6);
    beam(name+' short fuse',[x,bottom+height+.013,z],[x+.023,bottom+height+.05,z+.007],.009,'dark');
  };
  if(label==='I'){
    rock('Soldier supporting rock',-.27,-.135,.18,.235,.18);
    box('Slumped blue torso',[.145,.205,.105],'cloth',[-.275,deck+.20,.014],[-.23,0,-.08]);
    box('Seated pelvis',[.135,.085,.105],'wood',[-.27,deck+.065,.08]);
    const facePosition=new THREE.Vector3(-.287,deck+.334,.034),faceRotation=new THREE.Euler(-.13,0,-.14);
    box('Quiet closed face',[.086,.085,.062],'ivory',facePosition.toArray(),faceRotation.toArray().slice(0,3));
    add('Lowered iron helmet',new THREE.SphereGeometry(.065,6,3,0,Math.PI*2,0,Math.PI/2),'dark',[-.285,deck+.357,-.007],[-.13,0,-.14],[1,1,.92]);
    cylinder('Iron helmet rim',.065,.017,'dark',[-.285,deck+.357,-.007],[-.13,0,-.14],6);
    for(const side of [-1,1])box('Closed eyelid '+side,[.018,.005,.004],'dark',new THREE.Vector3(side*.022,.003,.032).applyEuler(faceRotation).add(facePosition).toArray(),faceRotation.toArray().slice(0,3));
    for(const side of [-1,1]){
      const x=-.27+side*.045;
      beam('Resting thigh '+side,[x,deck+.083,.093],[x,deck+.060,.17],.063,'cloth');
      beam('Resting shin '+side,[x,deck+.060,.17],[x,deck+.032,.23],.047,'cloth');
      box('Grounded boot '+side,[.068,.05,.08],'wood',[x,deck+.025,.238]);
      beam('Relaxed upper arm '+side,[-.275+side*.085,deck+.265,.009],[-.27+side*.09,deck+.148,.08],.047,'cloth');
      beam('Relaxed forearm '+side,[-.27+side*.09,deck+.148,.08],[x+side*.017,deck+.100,.13],.043,'cloth');
      box('Resting hand '+side,[.04,.04,.046],'ivory',[x+side*.017,deck+.095,.133]);
    }
    // No wounds or blood: the lowered head, supported posture and relaxed arms
    // tell the story. A discarded shield is seated against the same stone.
    add('Discarded round shield',new THREE.CylinderGeometry(.07,.07,.018,8),'metal',[-.382,deck+.072,.075],[Math.PI/2,.16,-.35]);
  }else if(label==='II'){
    barrel('Left powder barrel',-.30,-.19,deck);
    barrel('Right powder barrel',-.10,-.19,deck);
    barrel('Stacked powder barrel',-.20,-.19,deck+.24,.215,.094);
  }else if(label==='III'){
    for(let i=0;i<5;i++){
      const angle=Math.PI+.18+i*(Math.PI-.36)/4,x=Math.cos(angle)*.30,z=Math.sin(angle)*.30,rotation=Math.PI/2-angle,height=i%2?.142:.16;
      const local=(dx,dy,dz)=>[x+Math.cos(rotation)*dx+Math.sin(rotation)*dz,deck+dy,z-Math.sin(rotation)*dx+Math.cos(rotation)*dz];
      box('Crate '+i+' dark core',[.144,height,.13],'wood',local(0,height/2,0),[0,rotation,0]);
      for(const side of [-1,1]){
        for(let plank=0;plank<3;plank++)box('Crate '+i+' plank '+side+' '+plank,[.043,height-.014,.012],'timber',local((plank-1)*.046,height/2,side*.069),[0,rotation,0]);
        for(const diagonal of [-1,1]){
          const a=local(-.060,.018,side*.077),b=local(.060,height-.018,side*.077);if(diagonal===-1){a[1]=deck+height-.018;b[1]=deck+.018;}
          beam('Crate '+i+' brace '+side+' '+diagonal,a,b,.013,'timber',.013);
        }
      }
      box('Crate '+i+' plank lid',[.144,.013,.13],'timber',local(0,height+.005,0),[0,rotation,0]);
    }
  }else if(label==='IV'){
    const x=-.27,z=-.12;
    for(let i=0;i<8;i++){const angle=i*Math.PI/4;rock('Firepit stone '+i,x+Math.cos(angle)*.10,z+Math.sin(angle)*.10,.039,.027,.039,i%2?'light':'stone');}
    cylinder('Crossed firewood A',.017,.155,'wood',[x,deck+.023,z],[Math.PI/2,0,.18],6);
    cylinder('Crossed firewood B',.017,.155,'wood',[x,deck+.046,z],[0,0,Math.PI/2],6);
    add('Low ember bed',new THREE.IcosahedronGeometry(1,0),'fire',[x,deck+.035,z],undefined,[.066,.015,.058]);
    add('Outer fire tongue',new THREE.ConeGeometry(.064,.24,5),'fire',[x,deck+.166,z],[.07,0,-.14]);
    add('Pale fire core',new THREE.ConeGeometry(.032,.17,5),'ivory',[x-.013,deck+.134,z+.020],[-.10,0,.10]);
    for(let i=0;i<3;i++){const angle=i*Math.PI*2/3;beam('Cooking tripod leg '+i,[x+Math.cos(angle)*.14,deck+.012,z+Math.sin(angle)*.14],[x,deck+.35,z],.017,'wood');}
    cylinder('Cooking pot',.05,.060,'dark',[x,deck+.255,z]);
    add('Pot handle',new THREE.TorusGeometry(.047,.006,3,8,Math.PI),'metal',[x,deck+.285,z],[0,0,0]);
    beam('Pot suspension',[x,deck+.337,z],[x,deck+.319,z],.009,'metal');
    cylinder('Rolled campsite blanket',.036,.16,'cloth',[-.27,deck+.036,.205],[Math.PI/2,0,0],8);
    for(const offset of [-.052,.052])cylinder('Blanket binding '+offset,.039,.014,'wood',[-.27,deck+.036,.205+offset],[Math.PI/2,0,0],8);
  }else if(label==='V'){
    for(let i=0;i<3;i++)box('Broken wall foundation '+i,[.137,.10,.13],i===1?'light':'stone',[-.34+i*.145,deck+.05,-.19]);
    for(let i=0;i<2;i++)box('Remaining wall course '+i,[.139,.10,.125],i?'stone':'light',[-.315+i*.145,deck+.151,-.188],[0,.02*(i?1:-1),0]);
    rock('Jagged wall crown',-.315,-.188,.075,.055,.062,'light',deck+.201);
    const start=new THREE.Vector3(-.22,deck+.292,-.183),end=new THREE.Vector3(-.22,deck+.029,.221),length=start.distanceTo(end);
    const tilt=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),start.clone().sub(end).normalize()),centre=start.clone().add(end).multiplyScalar(.5).toArray();
    const fallenStone=(name,outline,color)=>{
      const shape=new THREE.Shape();shape.moveTo(...outline[0]);for(const point of outline.slice(1))shape.lineTo(...point);shape.closePath();
      const geometry=new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:1,steps:1});geometry.translate(0,0,-.035);geometry.applyQuaternion(tilt);add(name,geometry,color,centre);
    };
    // Separate bevelled courses leave real recessed mortar joints in the fallen
    // fragment, rather than presenting another unbroken stone sheet.
    for(let row=0;row<2;row++)for(const side of [-1,1]){
      const low=-length/2+row*length/3+.003,high=low+length/3-.006,left=side===-1?-.083:.003,right=side===-1?-.003:.083;
      fallenStone('Forward fallen masonry '+row+' '+side,[[left,low],[right,low],[right,high],[left,high]],row===0&&side===1?'stone':'light');
    }
    fallenStone('Forward broken masonry crown',[[-.083,length/6+.003],[.083,length/6+.003],[.083,length/2-.032],[.028,length/2-.032],[.007,length/2],[-.055,length/2],[-.083,length/2-.017]],'light');
    rock('Scattered rubble left',-.382,.092,.039,.035,.042);
    rock('Scattered rubble rear',.038,-.285,.052,.035,.037,'light');
  }
  return parts;
}

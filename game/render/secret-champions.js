import * as THREE from 'three';

// Temporary miniatures while the authored Blender files load. Native imports
// replace these figures using the same stable families and orb pivot names.
export function secretChampionModel(family,k){
  const {box,beam,sphere,cylinder,cone,mesh,optimize}=k,body=new THREE.Group(),root=new THREE.Group();
  const gold='#efc65f',steel='#e5eef0',skin='#edc5a4',hair='#ddc07b',ivory='#f3e4c8',champagne='#dfca9f';
  const ellipse=(parent,radius,color,position,scale=[1,1,1])=>{
    const part=mesh(parent,new THREE.SphereGeometry(radius,16,10),color,position);part.scale.set(...scale);return part;
  };
  cylinder(body,.43,.47,.13,'#717e76',[0,.07,0],12);cylinder(body,.42,.43,.05,gold,[0,.16,0],12);
  if(family==='ladyclaire'){
    // A narrow fitted bodice and a continuous ivory skirt read as an adult gown.
    cylinder(body,.145,.36,.76,ivory,[0,.61,0],16);cylinder(body,.16,.145,.27,champagne,[0,1.08,0],14);
    cylinder(body,.157,.173,.040,gold,[0,.96,0],16);cylinder(body,.351,.355,.026,gold,[0,.245,0],16);
    for(const x of [-.15,.15])beam(body,[x*.48,.99,-.12],[x,.30,-.27],.012,gold);
    cylinder(body,.053,.061,.115,skin,[0,1.275,-.012],10);
    ellipse(body,.149,skin,[0,1.445,-.025],[.80,1.04,.78]);
    for(const x of [-.047,.047]){
      ellipse(body,.022,'#fbf6e4',[x,1.457,-.143],[1,.53,.26]);
      ellipse(body,.012,'#527b59',[x,1.457,-.150],[.71,.80,.26]);
      ellipse(body,.005,'#243c2b',[x,1.457,-.154],[.71,.89,.27]);
      beam(body,[x-.021,1.480,-.139],[x+.020,1.483,-.139],.006,'#ad8f51');
    }
    ellipse(body,.020,skin,[0,1.420,-.145],[.48,1.03,.72]);
    ellipse(body,.026,'#aa7267',[0,1.385,-.143],[1.02,.25,.19]);
    // Joined low hair volumes cover the back and temples without a floating cap.
    ellipse(body,.165,hair,[0,1.550,.018],[1.02,.58,.95]);
    ellipse(body,.164,hair,[0,1.315,.084],[.96,1.56,.54]);
    for(const x of [-.137,.137])ellipse(body,.079,hair,[x,1.331,.011],[.58,2.67,.80]);
    cylinder(body,.169,.173,.046,gold,[0,1.591,.017],14);
    for(let i=0;i<7;i++){const angle=i*Math.PI*2/7;cone(body,.021,.086,gold,[Math.cos(angle)*.161,1.648,Math.sin(angle)*.161+.017],6);}
    ellipse(body,.027,'#c1d5ae',[0,1.600,-.160],[.77,1.13,.32]);
    for(const x of [-.205,.205]){
      ellipse(body,.077,ivory,[x,1.145,0],[1,.89,1]);beam(body,[x,1.11,0],[x*1.37,.97,-.11],.050,skin);
      ellipse(body,.043,skin,[x*1.37,.97,-.11],[.80,1,.85]);
    }
    beam(body,[.29,.25,-.12],[.29,1.79,-.12],.031,gold);
    mesh(body,new THREE.TorusGeometry(.057,.012,6,16),gold,[.29,1.820,-.12]);
    cone(body,.025,.068,gold,[.29,1.898,-.12],6);
    root.add(optimize(body));
    for(let i=0;i<3;i++){const orb=new THREE.Group();orb.name=`secret_orb_${i}`;orb.userData.orbitRadius=.47;orb.position.set(Math.cos(i*2*Math.PI/3)*.47,1.2+i*.14,Math.sin(i*2*Math.PI/3)*.47);sphere(orb,.073,['#82c9fa','#b697f0','#f4d986'][i]);root.add(orb);}
  }else{
    const white='#f2f0e6',mane='#ddd7bf',hoof='#686861';
    ellipse(body,.32,white,[0,.82,.018],[.86,.84,1.72]);
    ellipse(body,.20,white,[0,.855,-.25],[1.03,1.21,1.10]);
    beam(body,[0,.88,-.29],[0,1.29,-.48],.205,white);
    ellipse(body,.17,white,[0,1.29,-.53],[.69,.85,1.08]);
    ellipse(body,.108,white,[0,1.218,-.71],[.77,.74,1.33]);
    for(const x of [-.070,.070])cone(body,.032,.145,white,[x,1.477,-.457],8);
    for(const x of [-.108,.108])ellipse(body,.015,'#3f4138',[x,1.31,-.583],[.28,1,.90]);
    for(let i=0;i<5;i++)ellipse(body,.046,mane,[0,1.34-i*.065,-.376+i*.018],[.60,1.12,1.04]);
    for(const x of [-.13,.13])beam(body,[x,1.25,-.72],[x*.74,1.40,-.47],.014,gold);
    beam(body,[-.10,1.22,-.746],[.10,1.22,-.746],.021,gold);
    box(body,[.47,.06,.040],gold,[0,.87,-.399]);
    box(body,[.48,.072,.46],champagne,[0,1.062,.052]);box(body,[.31,.070,.34],gold,[0,1.110,.052]);
    for(const side of [-1,1]){
      box(body,[.039,.245,.36],gold,[side*.256,.932,.056]);
      beam(body,[side*.137,1.175,.080],[side*.288,.969,-.144],.078,steel);
      ellipse(body,.079,gold,[side*.288,.969,-.144],[.84,1.06,.82]);
      beam(body,[side*.288,.944,-.141],[side*.278,.716,-.097],.066,steel);
      box(body,[.099,.082,.166],steel,[side*.278,.688,-.139]);
      beam(body,[side*.34,.644,-.24],[side*.34,.644,-.038],.016,gold);
      beam(body,[side*.252,1.075,-.08],[side*.34,.644,-.038],.012,gold);
    }
    ellipse(body,.16,steel,[0,1.185,.079],[1.09,.71,.87]);
    cylinder(body,.165,.187,.31,steel,[0,1.356,.063],12);
    box(body,[.052,.237,.024],gold,[0,1.368,-.112]);box(body,[.251,.033,.025],gold,[0,1.402,-.112]);
    cylinder(body,.069,.077,.083,gold,[0,1.551,.034],12);
    ellipse(body,.161,steel,[0,1.731,.030],[.93,1.04,.91]);
    // A closed ornate visor, rather than a human face behind an open eye band.
    box(body,[.247,.197,.042],steel,[0,1.712,-.100]);box(body,[.258,.026,.047],gold,[0,1.790,-.113]);
    box(body,[.026,.225,.024],gold,[0,1.715,-.130]);
    for(const x of [-.080,-.040,.040,.080])box(body,[.018,.025,.010],'#5d6156',[x,1.711,-.124]);
    beam(body,[0,1.881,.095],[0,1.898,-.049],.040,gold);
    for(const side of [-1,1])ellipse(body,.103,gold,[side*.207,1.456,.049],[1,.84,1.06]);
    beam(body,[.217,1.441,.046],[.304,1.712,-.112],.067,steel);ellipse(body,.053,steel,[.307,1.764,-.114]);
    beam(body,[.307,1.734,-.114],[.307,1.886,-.114],.032,gold);
    box(body,[.062,.52,.026],steel,[.307,2.13,-.114]);box(body,[.216,.031,.055],gold,[.307,1.877,-.114]);cone(body,.036,.127,steel,[.307,2.453,-.114],4);
    beam(body,[-.213,1.44,.042],[-.245,1.231,-.128],.069,steel);
    box(body,[.227,.319,.055],gold,[-.275,1.270,-.162]);box(body,[.031,.243,.016],ivory,[-.275,1.27,-.20]);box(body,[.155,.031,.017],ivory,[-.275,1.317,-.20]);
    beam(body,[-.245,1.24,-.144],[-.095,1.33,-.60],.011,gold);
    beam(body,[0,.89,.49],[.084,.565,.76],.048,mane);
    root.add(optimize(body));
    // Four local leg pivots use the same existing, restrained weight-shift rig.
    for(let i=0;i<4;i++){
      const x=i%2?.205:-.205,z=i<2?-.273:.302,leg=new THREE.Group(),pivot=new THREE.Group();
      beam(leg,[0,0,0],[0,-.225,.021],.067,white);ellipse(leg,.052,white,[0,-.225,.021]);
      beam(leg,[0,-.225,.021],[0,-.481,-.016],.048,white);box(leg,[.095,.067,.123],hoof,[0,-.516,-.034]);
      pivot.name=`leg_horse_${i}`;pivot.userData.gaitPhase=[0,Math.PI,Math.PI,0][i];pivot.position.set(x,.742,z);pivot.add(optimize(leg));root.add(pivot);
    }
  }
  root.userData.unitKind='champion';return root;
}

export function animateSecretChampion(actor,time,{reducedMotion=false,melancholy=false}={}){
  const clock=Number.isFinite(time)?time:0;
  if(!actor.userData.secretMotion){
    const orbs=[0,1,2].map(i=>actor.getObjectByName(`secret_orb_${i}`)).filter(Boolean);
    const legs=[];actor.traverse(node=>{if(node.name.startsWith('leg_horse_'))legs.push({node,rest:node.rotation.clone()});});
    actor.userData.secretMotion={clock,last:clock,orbs:orbs.map((node,i)=>({node,rest:node.position.clone(),rotation:node.rotation.clone(),scale:node.scale.clone(),phase:i*Math.PI*2/3,radius:node.userData.orbitRadius||.46})),legs};
  }
  const rig=actor.userData.secretMotion;
  rig.clock+=Math.max(0,Math.min(.25,clock-rig.last))*(melancholy?.22:1);rig.last=clock;
  const t=reducedMotion?0:rig.clock;
  for(const {node,rest,rotation,scale,phase,radius}of rig.orbs){
    if(reducedMotion){node.position.copy(rest);node.rotation.copy(rotation);node.scale.copy(scale);continue;}
    const angle=phase+t*.92;node.position.set(Math.cos(angle)*radius,rest.y+(reducedMotion?0:Math.sin(t*1.8+phase)*.045),Math.sin(angle)*radius);
    node.rotation.copy(rotation);node.rotation.y+=t*.4;node.scale.copy(scale).multiplyScalar(melancholy?.88:1);
  }
  rig.legs.forEach(({node,rest},i)=>{node.rotation.copy(rest);node.rotation.x+=(reducedMotion?0:Math.sin(t*1.4+(node.userData.gaitPhase??i))*.018);});
}

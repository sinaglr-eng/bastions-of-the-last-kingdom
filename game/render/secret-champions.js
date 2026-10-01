import * as THREE from 'three';

// Temporary miniatures while the authored Blender files load. Native imports
// replace these figures using the same stable families and orb pivot names.
export function secretChampionModel(family,k){
  const {box,beam,sphere,cylinder,cone,optimize}=k,body=new THREE.Group(),root=new THREE.Group();
  const gold='#efc65f',steel='#e5eef0',skin='#edbd94',hair='#ecd084';
  cylinder(body,.43,.47,.13,'#717e76',[0,.07,0],12);cylinder(body,.42,.43,.05,gold,[0,.16,0],12);
  function head(p,y){
    sphere(p,.18,skin,[0,y,-.045]);
    for(const x of [-.061,.061]){sphere(p,.031,'#faf5de',[x,y+.025,-.206]);sphere(p,.017,'#42865b',[x,y+.025,-.231]);}
    beam(p,[-.053,y-.063,-.212],[0,y-.078,-.224],.013,'#a85858');beam(p,[0,y-.078,-.224],[.053,y-.063,-.212],.013,'#a85858');
  }
  if(family==='ladyclaire'){
    cylinder(body,.16,.35,.76,'#dbe8f0',[0,.61,0],12);cylinder(body,.17,.16,.27,'#5b81b7',[0,1.10,0],10);
    cylinder(body,.165,.18,.055,gold,[0,.96,0],12);head(body,1.44);
    sphere(body,.19,hair,[0,1.56,.025]);
    for(const x of [-.155,.155]){const lock=sphere(body,.105,hair,[x,1.28,.065]);lock.scale.set(.75,2.5,.8);}
    const back=sphere(body,.175,hair,[0,1.32,.13]);back.scale.set(.9,2,.45);
    for(const x of [-.23,.23]){sphere(body,.09,'#dbe8f0',[x,1.14,0]);beam(body,[x,1.11,0],[x*1.38,.92,-.12],.07,skin);sphere(body,.056,skin,[x*1.38,.92,-.12]);}
    beam(body,[.32,.24,-.13],[.32,1.72,-.13],.041,gold);sphere(body,.1,'#a4d7f4',[.32,1.80,-.13]);
    root.add(optimize(body));
    for(let i=0;i<3;i++){const orb=new THREE.Group();orb.name=`secret_orb_${i}`;orb.userData.orbitRadius=.47;orb.position.set(Math.cos(i*2*Math.PI/3)*.47,1.2+i*.14,Math.sin(i*2*Math.PI/3)*.47);sphere(orb,.073,['#82c9fa','#b697f0','#f4d986'][i]);root.add(orb);}
  }else{
    const horse=sphere(body,.31,'#f2f0e6',[0,.76,0]);horse.scale.set(.7,.84,1.5);
    beam(body,[0,.78,-.23],[0,1.12,-.47],.16,'#f2f0e6');const face=sphere(body,.17,'#f2f0e6',[0,1.14,-.50]);face.scale.set(.8,1,1.55);
    for(const x of [-.11,.11]){cone(body,.044,.18,'#f2f0e6',[x,1.37,-.44],6);sphere(body,.022,'#253b43',[x,1.17,-.63]);}
    for(const x of [-.18,.18])for(const z of [-.26,.29]){beam(body,[x,.73,z],[x,.26,z-.01],.08,'#f2f0e6');box(body,[.115,.08,.13],'#495358',[x,.23,z-.04]);}
    box(body,[.32,.095,.39],'#8c724e',[0,1.01,.025]);cylinder(body,.17,.20,.30,steel,[0,1.25,.02],10);head(body,1.59);
    sphere(body,.195,steel,[0,1.69,.045]);box(body,[.27,.04,.015],'#263b46',[0,1.64,-.158]);
    for(const side of [-1,1]){sphere(body,.10,gold,[side*.21,1.40,.025]);beam(body,[side*.18,1.06,.10],[side*.23,.77,.12],.10,steel);}
    beam(body,[.22,1.4,0],[.31,1.69,-.06],.09,steel);sphere(body,.06,steel,[.31,1.7,-.06]);
    beam(body,[.31,1.67,-.06],[.31,2.19,-.06],.07,steel);box(body,[.22,.043,.055],gold,[.31,1.79,-.06]);cone(body,.051,.15,steel,[.31,2.26,-.06],4);
    box(body,[.23,.26,.07],gold,[-.25,1.26,-.12]);beam(body,[0,.87,.43],[.09,.58,.66],.07,'#dfdfd3');root.add(optimize(body));
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

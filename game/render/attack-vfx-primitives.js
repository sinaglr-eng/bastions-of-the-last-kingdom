import * as THREE from 'three';

// Procedural, texture-free presentation. Nothing in this module reads/writes combat state.
const noRaycast=()=>{};
const basic=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
const metal=(color,roughness=.38)=>new THREE.MeshStandardMaterial({color,metalness:.72,roughness,transparent:true,depthWrite:false});
const solid=(color,roughness=.9)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0,transparent:true,depthWrite:false});
const mesh=(geometry,material,name)=>{const o=new THREE.Mesh(geometry,material);o.name=name;o.raycast=noRaycast;return o;};
const group=name=>{const o=new THREE.Group();o.name=name;return o;};
const rod=(r,length,color,name)=>{const o=mesh(new THREE.CylinderGeometry(r,r,length,7),metal(color),name);o.rotation.x=Math.PI/2;return o;};
const cone=(r,length,color,name)=>{const o=mesh(new THREE.ConeGeometry(r,length,5),metal(color),name);o.rotation.x=Math.PI/2;return o;};
const ring=(radius,width,color,name,arc=Math.PI*2)=>mesh(new THREE.TorusGeometry(radius,width,5,32,arc),basic(color,.76),name);

function arrow(color,toxic=false,siege=false){
  const o=group(siege?'Heavy ballista bolt':toxic?'Venom-coated royal arrow':'Crafted arrow'),s=siege?1.7:1;
  o.add(rod(.011*s,.57*s,'#a58c62','Arrow shaft'));
  const head=cone(.038*s,.15*s,'#c7ced0','Steel arrowhead');head.position.z=.32*s;o.add(head);
  for(let i=0;i<3;i++){const f=mesh(new THREE.PlaneGeometry(.09*s,.15*s),solid(toxic?'#809968':'#d9d8c7'),'Arrow fletching');f.rotation.set(Math.PI/2,0,i*Math.PI*2/3);f.position.z=-.23*s;o.add(f);}
  const wake=mesh(new THREE.CylinderGeometry(.007,.002,.38*s,5),basic(color,.30),'Short ammunition wake');wake.rotation.x=Math.PI/2;wake.position.z=-.40*s;o.add(wake);
  if(toxic){const coating=mesh(new THREE.SphereGeometry(.04,7,5),basic(color,.83),'Green venom arrow coating');coating.scale.set(1,1,1.9);coating.position.z=.29;o.add(coating);}
  return o;
}
function stone(){const o=group('Sling-released catapult stone'),b=mesh(new THREE.DodecahedronGeometry(.17,0),solid('#929286'),'Rough unfused catapult stone');b.scale.set(1,.83,1.13);o.add(b);return o;}
function ammunition(kind,color){
  if(kind==='cannon'){const o=group('Solid iron cannonball');o.add(mesh(new THREE.SphereGeometry(.145,12,8),metal('#424c53',.30),'Solid round iron shot'));return o;}
  if(kind==='grenade'){const o=group('Lobbed forged grenade');o.add(mesh(new THREE.SphereGeometry(.13,10,7),metal('#384044',.52),'Forged grenade body'),ring(.13,.011,'#697074','Grenade iron seam'));const cap=rod(.028,.07,'#777466','Grenade cap');cap.rotation.x=0;cap.position.y=.14;o.add(cap);const fuse=rod(.009,.09,'#bba177','Visible bomb fuse');fuse.rotation.x=.2;fuse.position.y=.20;o.add(fuse);const spark=mesh(new THREE.OctahedronGeometry(.025),basic('#ffd16f'),'Bomb fuse spark');spark.position.y=.25;o.add(spark);return o;}
  if(kind==='shell'){const o=group('Arcing mortar shell');o.add(rod(.06,.24,'#59636a','Mortar shell body'));const nose=cone(.06,.12,'#c3a572','Mortar shell nose');nose.position.z=.17;o.add(nose);return o;}
  const o=group(kind==='bulletRapid'?'Gatling tracer':'Rifle bullet and tracer');o.add(rod(.016,.13,'#c1a37b','Metal bullet'));const nose=cone(.016,.045,'#d7bc8e','Bullet nose');nose.position.z=.08;o.add(nose);
  const tracer=mesh(new THREE.CylinderGeometry(.009,.001,kind==='bulletRapid'?.30:.43,5),basic(color,.72),'Short shot tracer');tracer.rotation.x=Math.PI/2;tracer.position.z=-.23;o.add(tracer);return o;
}
function ribbon(radius,width,color,name,arc=Math.PI*.85){
  const vertices=[],uv=[],indices=[],steps=28;
  for(let i=0;i<=steps;i++){const t=i/steps,a=-arc*.5+t*arc,w=width*Math.sin(Math.PI*t)**.6;for(const r of [radius-w*.5,radius+w*.5]){vertices.push(Math.cos(a)*r,Math.sin(a)*r,0);uv.push(t,r<radius?0:1);}if(i<steps){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return mesh(g,basic(color,.85),name);
}
function contact(kind,color){
  const o=group({melee:'Sweeping melee blade',axe:'Heavy axe cleave',pick:'Pickaxe contact sparks',claw:'Claw contact streaks',treeSlam:'Branch fist and bark contact',hammer:'Concussive weapon contact',thrust:'Physical lance thrust'}[kind]);
  if(kind==='melee'||kind==='axe'){const a=ribbon(.32,kind==='axe'?.16:.065,color,kind==='axe'?'Weighted axe contact wedge':'Blade cut arc');a.rotation.y=.3;o.add(a);const edge=ribbon(.36,.014,'#f4f1db','Cutting edge highlight');edge.position.z=.008;o.add(edge);}
  else if(kind==='thrust'){const shaft=mesh(new THREE.CylinderGeometry(.017,.008,.40,6),basic(color,.85),'Forward spear impact streak');shaft.rotation.x=Math.PI/2;o.add(shaft);const tip=cone(.035,.14,'#eff1e0','Pointed spear impact');tip.position.z=.22;o.add(tip);}
  else if(kind==='claw'){for(let i=0;i<3;i++){const c=ribbon(.17,.025,color,'Tapered claw contact');c.position.set((i-1)*.085,0,(i-1)*.018);c.rotation.z=-.7;o.add(c);}}
  else if(kind==='hammer'){const r=ring(.18,.022,color,'Blunt compression rim',Math.PI*1.65);r.scale.y=.55;o.add(r);for(let i=0;i<3;i++){const b=mesh(new THREE.BoxGeometry(.06,.035,.035),metal('#a4a8a6'),'Blunt contact chip');b.position.set((i-1)*.10,.04*i,0);o.add(b);}}
  else if(kind==='pick'){const p=cone(.025,.23,'#d6e4e7','Concentrated pick puncture');p.rotation.x=0;p.rotation.z=-.7;o.add(p);for(let i=0;i<3;i++){const s=mesh(new THREE.BoxGeometry(.014,.13,.012),basic(color,.9),'Pick contact spark');s.rotation.z=(i-1)*.8;s.position.set((i-1)*.07,.06,0);o.add(s);}}
  else{for(let i=0;i<4;i++){const b=mesh(new THREE.BoxGeometry(.05,.13,.035),solid(i%2?'#8d794f':'#5f723e'),'Ent bark contact chip');b.rotation.z=i*.8;b.position.set(Math.sin(i*2)*.16,Math.cos(i*2)*.12,0);o.add(b);}o.add(ribbon(.19,.05,color,'Branch-contact thorn edge',Math.PI*.7));}
  o.userData.contact=true;return o;
}
function rune(color,magical){
  const o=group(magical?'Weapon-released magical rune bolt':'Physical armor-breaking rune bolt');const core=mesh(new THREE.OctahedronGeometry(.08),magical?basic(color,.80):metal('#a2abad'),'Forged rune focus');core.scale.z=1.7;o.add(core);
  const frame=ring(.105,.012,color,'Hammer-released square rune',Math.PI*1.85);frame.rotation.z=Math.PI/4;frame.geometry.dispose();frame.geometry=new THREE.TorusGeometry(.105,.012,4,4,Math.PI*1.86);o.add(frame);
  for(const x of [-1,1]){const a=mesh(new THREE.BoxGeometry(.10,.013,.016),basic(color,.9),'Engraved angular rune');a.rotation.z=x*.65;a.position.set(x*.035,0,.02);o.add(a);}return o;
}
function spell(kind,color,style){
  const o=group(`${kind} shaped spell`),frost=kind==='frost';o.add(mesh(frost?new THREE.OctahedronGeometry(.13):new THREE.IcosahedronGeometry(.10,1),basic(color,.9),`${kind} spell core`));
  if(kind==='poison'){o.name='poison shaped spell';o.children[0].scale.set(.72,1.15,1);for(let i=0;i<2;i++){const leaf=mesh(new THREE.SphereGeometry(.09,7,5),basic(i?'#698e37':color,.65),'Nature seed leaf envelope');leaf.scale.set(.38,1.3,.75);leaf.rotation.z=i?-.65:.65;leaf.position.x=i?-.07:.07;o.add(leaf);}}
  else if(frost){o.children[0].scale.z=1.6;for(let i=0;i<4;i++){const shard=cone(.025,.16,color,'Trailing frost shard');shard.material.dispose();shard.material=basic(color,.65);shard.position.set(Math.sin(i*1.7)*.09,Math.cos(i*1.7)*.09,-.16);o.add(shard);}}
  else{for(let i=0;i<2;i++){const r=ring(.15+i*.018,.009,color,kind==='holy'?'Open radiant halo':'Incomplete spell orbit',Math.PI*(kind==='holy'?1.75:1.3));r.rotation.set(i*.9,.4+i*.7,i*Math.PI);o.add(r);}if(kind==='holy')for(let i=0;i<4;i++){const ray=mesh(new THREE.BoxGeometry(.013,.08,.012),basic(color,.88),'Short holy ray');ray.position.set(Math.cos(i*Math.PI/2)*.19,Math.sin(i*Math.PI/2)*.19,0);ray.rotation.z=i*Math.PI/2-Math.PI/2;o.add(ray);}}
  if(style.element==='fire'){o.userData.emberSpell=true;const wisps=createFlameStream();wisps.name='Discrete ember-spell flame wisps';wisps.rotation.x=-Math.PI/2;wisps.position.z=-.15;wisps.scale.set(.28,.30,.28);o.add(wisps);}return o;
}
function crescent(color){const o=group('Lunar crescent spell');o.add(ring(.13,.021,color,'Open lunar crescent',Math.PI*1.4));const edge=ring(.145,.006,'#e0daff','Silver crescent rim',Math.PI*1.4);edge.position.z=.006;o.add(edge);return o;}
function drum(color){const o=group('Drum percussion wave');for(let i=0;i<3;i++){const r=ring(.16+i*.07,.009,color,'Open drum compression arc',Math.PI*1.65);r.rotation.z=i*.4;r.position.z=-i*.11;o.add(r);}return o;}
export function createSilk(color){const o=group('Fang-released silken venom thread');o.userData.silk=true;for(const [width,tint,opacity]of [[.014,'#67557a',.70],[.005,color,.95]]){const b=new THREE.InstancedMesh(new THREE.CylinderGeometry(width,width,1,5),basic(tint,opacity),12);b.name='Continuous silken strand';b.raycast=noRaycast;b.frustumCulled=false;o.add(b);}return o;}
const pose=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
export function animateSilk(o,start,end,clock,motion){const d=end.clone().sub(start),side=new THREE.Vector3(d.z,0,-d.x).normalize();const point=t=>start.clone().addScaledVector(d,t).addScaledVector(side,Math.sin(t*Math.PI)*.055*(motion?Math.sin(clock*2):.3)).add(new THREE.Vector3(0,-Math.sin(t*Math.PI)*Math.min(.12,d.length()*.015),0));for(const b of o.children){for(let i=0;i<12;i++){const a=point(i/12),z=point((i+1)/12),v=z.clone().sub(a);pose.position.copy(a).add(z).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(up,v.lengthSq()>1e-9?v.clone().normalize():up);pose.scale.set(1,Math.max(.001,v.length()),1);pose.updateMatrix();b.setMatrixAt(i,pose.matrix);}b.instanceMatrix.needsUpdate=true;}}

const flameVertex=`varying vec3 vLocal; varying vec2 vUv; uniform float uTime; uniform float uMotion; void main(){vLocal=position;vUv=uv;vec3 p=position;float t=clamp(position.y+.5,0.,1.);float bend=sin(t*11.-uTime*8.)*.035+sin(t*23.-uTime*13.)*.018;p.x+=bend*t*uMotion;p.z+=cos(t*15.-uTime*9.)*.035*t*uMotion;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
const flameFragment=`varying vec3 vLocal;varying vec2 vUv;uniform float uTime;uniform float opacity;uniform float uLayer;uniform float uMotion;float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}void main(){float t=vLocal.y+.5;vec3 q=vec3(vUv.x*10.,t*7.-uTime*6.*uMotion,vLocal.z*8.);float n=noise(q)*.65+noise(q*2.1)*.35;float tongue=smoothstep(.20,.70,n+.17*(1.-t));float tip=1.-smoothstep(.66,1.04,t+(n-.5)*.25);float base=smoothstep(0.,.07,t);vec3 warm=mix(vec3(.83,.09,.008),vec3(1.,.42,.025),n);vec3 hot=mix(vec3(1.,.64,.08),vec3(1.,.96,.65),pow(1.-t,1.8));vec3 color=mix(warm,hot,uLayer);float alpha=opacity*base*tip*mix(tongue,.65+.35*tongue,uLayer);if(alpha<.015)discard;gl_FragColor=vec4(color,alpha);}`;
export function createFlameStream(){
  const o=group('Layered turbulent flame stream');o.userData.flame=true;
  for(let i=0;i<2;i++){const mat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uMotion:{value:1},uLayer:{value:i},opacity:{value:i?.76:.58}},vertexShader:flameVertex,fragmentShader:flameFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});mat.opacity=i?.76:.58;const shell=mesh(new THREE.CylinderGeometry(i?.19:.41,i?.025:.065,1,14,16,true),mat,i?'Hot turbulent flame core':'Broken turbulent flame envelope');o.add(shell);}
  const embers=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.035),basic('#ffc66a',.86),12);embers.name='Breath flying embers';embers.raycast=noRaycast;embers.frustumCulled=false;o.add(embers);return o;
}
export function animateFlameStream(o,clock,motion){for(let i=0;i<2;i++){const m=o.children[i].material;m.uniforms.uTime.value=clock;m.uniforms.uMotion.value=motion?1:0;}
  const embers=o.children[2];for(let i=0;i<12;i++){const t=motion?((clock*.85+i/12)%1+1)%1:(i+.5)/12;pose.position.set(Math.sin(i*4.17)*(t*.30+.025),t-.5,Math.cos(i*3.13)*(t*.30+.025));pose.quaternion.identity();const s=(.5+t*.6)*(1-t*.55);pose.scale.set(s,s/Math.max(.001,o.scale.y),s);pose.updateMatrix();embers.setMatrixAt(i,pose.matrix);}embers.instanceMatrix.needsUpdate=true;
}
export function animateProjectileDecoration(o,clock,motion){if(o.userData.emberSpell)for(const child of o.children)if(child.userData.flame)animateFlameStream(child,clock,motion);}
export function createAttackProjectile(kind,color,{style={},family,lobbed=false}={}){
  if(kind==='arrow'||kind==='venomArrow')return arrow(color,kind==='venomArrow');
  if(kind==='siege')return lobbed?stone():arrow(color,false,true);
  if(['bullet','bulletRapid','cannon','shell','grenade'].includes(kind))return ammunition(kind,color);
  if(['melee','axe','pick','claw','treeSlam','hammer','thrust'].includes(kind))return contact(kind,color);
  if(kind==='runic')return rune(color,style.damageType!=='physical');
  if(kind==='roots')return spell('poison',color,style);
  if(kind==='arcane'||kind==='holy'||kind==='frost')return spell(kind,color,style);
  if(kind==='moon')return crescent(color);
  if(kind==='web')return createSilk(color);
  if(kind==='drum')return drum(color);
  if(kind==='flame')return createFlameStream();
  if(kind==='forge'){const o=group('Forge-released hot metal fragment');const b=mesh(new THREE.DodecahedronGeometry(.10),metal('#6a7478'),'Solid hot iron fragment');b.scale.z=1.4;o.add(b);const seam=mesh(new THREE.BoxGeometry(.014,.14,.16),basic('#ffad52'),'Glowing iron seam');seam.rotation.z=.4;o.add(seam);return o;}
  if(kind==='stone')return stone();return spell(kind,color,style);
}

export function createAttackImpact(kind,color,{blocked=false,radius=.25,element='physical',heavy=false}={}){
  const o=group(blocked?'Resolved blocked contact':`${kind} attack impact`);o.userData.impact={kind,radius,blocked};
  const physical=['bullet','bulletRapid','cannon','shell','grenade','siege','axe','pick','hammer','thrust','melee','claw','treeSlam','forge'].includes(kind),ice=kind==='frost'||element==='frost';
  const edge=blocked?ring(.11,.012,'#9da6a6','Muted deflection',Math.PI*1.2):kind==='moon'?ring(.14,.018,color,'Broken lunar contact',Math.PI*1.3):kind==='runic'?ring(.13,.014,color,'Rune contact seal',Math.PI*1.8):physical?ribbon(.15,.025,color,'Physical contact glint',Math.PI*.8):ring(.13,.010,color,'Open elemental contact',Math.PI*1.6);
  if(kind==='runic')edge.rotation.z=Math.PI/4;o.add(edge);
  const count=blocked?3:kind==='bulletRapid'?4:heavy?12:8,geometry=ice?new THREE.ConeGeometry(.025,.14,4):physical?new THREE.BoxGeometry(.015,.075,.012):new THREE.OctahedronGeometry(.035),sparks=new THREE.InstancedMesh(geometry,basic(blocked?'#9ba4a3':color,blocked?.5:.9),count);sparks.name=blocked?'Blocked contact flecks':`${kind} material impact fragments`;sparks.raycast=noRaycast;sparks.frustumCulled=false;o.add(sparks);
  if(['cannon','siege','grenade','shell','treeSlam'].includes(kind)&&!blocked){const dust=mesh(new THREE.SphereGeometry(.14,8,6),basic(kind==='grenade'?'#e99653':'#99958a',.20),'Sparse impact dust');dust.scale.set(1,.55,1);o.add(dust);}return o;
}
export function animateAttackImpact(o,p,motion){const {radius,kind,blocked}=o.userData.impact,edge=o.children[0],sparks=o.children[1];edge.scale.setScalar(motion?.65+p*.8:1);for(let i=0;i<sparks.count;i++){const a=i*2.39996,travel=motion?p:.45,r=radius*(.12+travel*.75);pose.position.set(Math.cos(a)*r,Math.sin(a)*r*.55+(motion?Math.sin(p*Math.PI)*.15-p*p*.15:.06),Math.sin(i*4.7)*r*.7);pose.rotation.set(i*.8,i*1.7,p*(motion?2:0));pose.scale.setScalar(blocked?.65:1-p*.4);pose.updateMatrix();sparks.setMatrixAt(i,pose.matrix);}sparks.instanceMatrix.needsUpdate=true;if(o.children[2])o.children[2].scale.setScalar(1+(motion?p:0)*1.4);}

export function createFireSplash(radius){const o=group('Confirmed Fire Splash eruption');o.userData.fireSplashRadius=radius;for(let i=0;i<6;i++){const flame=createFlameStream();flame.name='Fire Splash radial flame lobe';o.add(flame);}return o;}
export function animateFireSplash(o,p,motion,orient){const radius=o.userData.fireSplashRadius,reach=motion?radius*(.24+.76*Math.sin(Math.min(1,p*1.8)*Math.PI*.5)):radius*.75;for(let i=0;i<6;i++){const a=i*Math.PI/3,from=new THREE.Vector3(0,0,0),to=new THREE.Vector3(Math.cos(a)*reach,.10+Math.sin(p*Math.PI)*.18,Math.sin(a)*reach),f=o.children[i];orient(f,from,to);f.scale.x=f.scale.z=Math.min(.65,Math.max(.18,radius*.28));animateFlameStream(f,p*1.6+i*.17,motion);}}

import * as THREE from 'three';

// Approved files are immutable authoring deliveries. This adapter changes only
// a decoded instance's hierarchy. Every original position/PBR buffer is shared.
const prepared=new WeakSet();
const semantic=node=>{for(let p=node;p;p=p.parent)if(p.userData.semanticPart)return p.userData.semanticPart;return node.name;};
// Do not duplicate full Blender validation reports on every material primitive.
// The original extras remain available in the immutable imported GLB.
const inherited=node=>{const data={};for(let p=node;p;p=p.parent){for(const key of ['semanticPart','rigBone','partName','category','bowRestPose'])if(data[key]===undefined&&p.userData?.[key]!==undefined)data[key]=p.userData[key];}return data;};
const side=name=>/\bleft\b/i.test(name)?'L':/\bright\b/i.test(name)?'R':null;
const point=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const centre=records=>{const box=new THREE.Box3();for(const r of records)box.union(r.bounds);return box.isEmpty()?null:box.getCenter(new THREE.Vector3());};
const selected=(records,pattern)=>records.filter(r=>pattern.test(r.semantic));
const isBowString=name=>/bowstring|bow.*string|actual drawn string tip to nock/i.test(name);
const isWeapon=name=>/staff|stave|spear|lance|sword|blade|bowstring|\bbow\b|actual drawn string tip to nock|crossbow|hammer|mallet|ruler|\bbook\b|shield|lightning|held.*(?:focus|orb)|palm.supported.*focus|hand.*bomb|raised.*bomb|cannon|barrel|ballista|catapult|cross.*shaft/i.test(name)&&!/sleeve|arm.*(?:shoulder|forearm)|gauntlet|hand.*(?:palm|wrist|thumb)|helm.*blade|shoulder collar|skirt|crest|horn|claw|scabbard|sheath|quiver|cloak|tunic|boot/i.test(name);

function rigidSkin(mesh){
  const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  if(!indices||!weights)throw new Error('Approved basic mesh is missing its rigid skin');
  let joint=null;
  for(let i=0;i<weights.count;i++)for(let k=0;k<4;k++)if(weights.getComponent(i,k)>1e-6){
    const index=indices.getComponent(i,k);
    if(joint!==null&&joint!==index)throw new Error('A multi-bone surface needs a deforming adapter, not rigid unwrapping');
    if(Math.abs(weights.getComponent(i,k)-1)>1e-5)throw new Error('Non-rigid approved skin weight');
    joint=index;
  }
  if(joint===null)throw new Error('Approved basic mesh has no weighted joint');
  const bone=mesh.skeleton.bones[joint];
  const transform=mesh.bindMatrixInverse.clone().multiply(bone.matrixWorld).multiply(mesh.skeleton.boneInverses[joint]).multiply(mesh.bindMatrix);
  return {bone:bone.name,world:mesh.matrixWorld.clone().multiply(transform)};
}

function capture(scene,champion){
  scene.updateMatrixWorld(true);
  const skeletons=new Set();scene.traverse(n=>{if(n.isSkinnedMesh)skeletons.add(n.skeleton);});
  for(const skeleton of skeletons)skeleton.update();
  const flip=new THREE.Matrix4().makeRotationY(champion?Math.PI:0),records=[],bones=new Map();
  scene.traverse(node=>{
    if(node.isBone)bones.set(node.name,node.getWorldPosition(new THREE.Vector3()));
    if(!node.isMesh)return;
    const skin=node.isSkinnedMesh?rigidSkin(node):null,world=flip.clone().multiply(skin?.world||node.matrixWorld);
    const bounds=new THREE.Box3(),v=new THREE.Vector3(),positions=node.geometry.attributes.position;
    for(let i=0;i<positions.count;i++)bounds.expandByPoint(v.fromBufferAttribute(positions,i).applyMatrix4(world));
    records.push({node,semantic:semantic(node),data:inherited(node),bone:skin?.bone,world,bounds});
  });
  return {records,bones,skeletons};
}

function joint(root,name,position,parent=root){
  const group=new THREE.Group();group.name=name;parent.add(group);
  root.updateMatrixWorld(true);group.position.copy(parent.worldToLocal(position.clone()));
  return group;
}
function moveMesh(record,parent){
  const source=record.node,mesh=new THREE.Mesh(source.geometry,source.material);
  mesh.name=source.name;mesh.userData={...record.data,semanticPart:record.semantic,reconstructionSourceNode:source.name};
  if(isBowString(record.semantic))mesh.userData.reconstructionBowString=true;
  mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.renderOrder=source.renderOrder;
  // Keep the exact affine rest transform, including exporter roundoff/shear.
  parent.updateWorldMatrix(true,false);mesh.matrix.copy(parent.matrixWorld.clone().invert().multiply(record.world));
  mesh.matrixAutoUpdate=false;parent.add(mesh);return mesh;
}
function endpoint(root,name,parent,world){const node=joint(root,name,world,parent);node.userData.reconstructionEndpoint=true;return node;}

function humanJoints(root,records,bones,height){
  const bone=(name,fallback)=>bones.get(name)?.clone()||fallback;
  const torso=joint(root,'torso_pivot',bone('pelvis',point(0,height*.42,0)));
  const headRecords=selected(records,/^(?:head|hair|hood|hat|helmet|helm|crown|circlet|beard|eye|ear|mitre|miter)|\bhelm\b/i);
  const headCenter=centre(headRecords)||point(0,height*.79,0);
  const head=joint(root,'head_pivot',bone('head',point(headCenter.x,headCenter.y-height*.075,headCenter.z)),torso);
  const groups={root,torso,head};
  for(const s of ['R','L']){
    const full=s==='R'?'right':'left',sign=s==='R'?1:-1;
    const armRecords=records.filter(r=>side(r.semantic)===s&&/sleeve|arm|hand|palm|glove|gauntlet/i.test(r.semantic)&&!isWeapon(r.semantic));
    const hands=armRecords.filter(r=>/hand|palm|glove|gauntlet/i.test(r.semantic)&&!/shoulder|upper|forearm/i.test(r.semantic));
    const handCenter=centre(hands);
    const shoulder=bone(full+'_upper_arm',point(sign*height*.19,height*.60,0));
    const elbow=bone(full+'_forearm',centre(armRecords.filter(r=>/forearm/i.test(r.semantic)))||point(sign*height*.26,height*.46,-height*.06));
    const wrist=handCenter||bone(full+'_hand',point(sign*height*.30,height*.36,-height*.08));
    groups['upper_arm_'+s]=joint(root,'upper_arm_'+s,shoulder,torso);
    groups['forearm_'+s]=joint(root,'forearm_'+s,elbow,groups['upper_arm_'+s]);
    groups['hand_'+s]=joint(root,'hand_'+s,wrist,groups['forearm_'+s]);
    groups['weapon_'+s]=joint(root,'weapon_'+s,wrist,groups['hand_'+s]);
    const hip=bone(full+'_thigh',point(sign*height*.12,height*.33,0)),knee=bone(full+'_shin',point(sign*height*.12,height*.18,0)),ankle=bone(full+'_foot',point(sign*height*.12,height*.075,0));
    // Grounded legs are independent of the attacking torso.
    groups['upper_leg_'+s]=joint(root,'upper_leg_'+s,hip);
    groups['shin_'+s]=joint(root,'shin_'+s,knee,groups['upper_leg_'+s]);
    groups['foot_'+s]=joint(root,'foot_'+s,ankle,groups['shin_'+s]);
  }
  return groups;
}

function targetGroup(record,groups,basic){
  const name=record.semantic,s=side(name);
  if(basic){
    const map={pelvis:'torso',spine:'torso',chest:'torso',neck:'torso',head:'head',right_shoulder:'upper_arm_R',left_shoulder:'upper_arm_L',right_upper_arm:'upper_arm_R',left_upper_arm:'upper_arm_L',right_forearm:'forearm_R',left_forearm:'forearm_L',right_hand:'hand_R',left_hand:'hand_L',right_thigh:'upper_leg_R',left_thigh:'upper_leg_L',right_shin:'shin_R',left_shin:'shin_L',right_foot:'foot_R',left_foot:'foot_L'};
    const key=map[record.bone]||'torso';
    return isWeapon(name)&&/^hand_[RL]$/.test(key)?groups[key.replace('hand','weapon')]:groups[key];
  }
  if(/^wing\b|\bwing.*feather|\bflight.*feather/i.test(name))return groups['wing_'+(s||(record.bounds.getCenter(point()).x>0?'R':'L'))]||groups.torso;
  if(/boot|trouser|knee|thigh|calf|skirt/i.test(name))return groups.torso;
  if(isWeapon(name))return groups['weapon_'+(/staff|spear|lance|sword|blade|hammer|mallet|cannon|barrel|ballista|catapult/i.test(name)?'R':s||(/\bbow\b|bowstring|actual drawn string|book|shield/i.test(name)?'L':'R'))];
  if(s&&/hand|palm|glove|gauntlet|finger|thumb/i.test(name)&&!/forearm|sleeve|upper/i.test(name))return groups['hand_'+s];
  if(s&&/forearm|wrist|cuff|bracer/i.test(name))return groups['forearm_'+s];
  if(s&&/arm|sleeve|shoulder|pauldron/i.test(name)&&!/cloak|mantle|collar|body|thorax/i.test(name))return groups['upper_arm_'+s];
  if(/\b(?:head|hair|helmet|helm|hat|hood|crown|circlet|beard|eye|ear|mitre|miter|horn|mane|nostril)\b|\bforehead goggles\b/i.test(name)&&!/horse|mount|body|thorax|cloak/i.test(name))return groups.head;
  // A continuous hood/cape or head/neck/trunk cannot be split into articulated
  // pieces without editing approved geometry. Keep that complete volume rigid.
  return groups.torso;
}

function boundsOf(root){root.updateMatrixWorld(true);return new THREE.Box3().setFromObject(root,true);}
function setupEndpoints(root,records,groups,style){
  root.updateMatrixWorld(true);
  const weaponRecords=records.filter(r=>isWeapon(r.semantic)),focus=selected(weaponRecords,/crystal|focus|prism|lightning|spear.*point|sword.*blade|blade|scepter|cross.*top/i);
  const candidates=focus.length?focus:weaponRecords;
  const box=new THREE.Box3();for(const r of candidates)box.union(r.bounds);
  const whole=boundsOf(root),fallback=point(0,whole.max.y*.67,whole.min.z);
  let muzzle=box.isEmpty()?fallback:box.getCenter(point());
  if(style==='focus'){
    const core=centre(selected(records,/faceted green energy core/i))||fallback;
    endpoint(root,'attack_muzzle',groups.torso,core);endpoint(root,'staff_tip',groups.torso,core);
  }else if(style==='breath'){
    const face=selected(records,/^head\b|muzzle|beak/i),headBox=new THREE.Box3();for(const r of face)headBox.union(r.bounds);
    if(!headBox.isEmpty())muzzle=point(headBox.getCenter(point()).x,headBox.min.y+(headBox.max.y-headBox.min.y)*.32,headBox.min.z);
    endpoint(root,'attack_muzzle',groups.head,muzzle);
  }else{
    const held=groups.weapon_R;
    if(!box.isEmpty()&&['staff','sword','spear','lance','hammer'].includes(style))muzzle.y=box.max.y;
    endpoint(root,'attack_muzzle',style==='bow'?groups.weapon_L:held,muzzle);
    if(style==='staff')endpoint(root,'staff_tip',held,muzzle);
    if(style==='sword')endpoint(root,'sword_tip',held,muzzle);
  }
  if(style==='bow'){
    const strings=records.filter(r=>isBowString(r.semantic)),stringBox=new THREE.Box3();for(const r of strings)stringBox.union(r.bounds);
    if(!stringBox.isEmpty()){
      // Use the real extremal rope vertices: a champion's source V-string has
      // a rear nock, so its bounding-box centre is not the authored nock.
      const vertices=[];for(const record of strings){const attr=record.node.geometry.attributes.position;for(let i=0;i<attr.count;i++)vertices.push(point().fromBufferAttribute(attr,i).applyMatrix4(record.world));}
      const average=filter=>{const chosen=vertices.filter(filter);return chosen.reduce((sum,v)=>sum.add(v),point()).multiplyScalar(1/chosen.length);};
      const top=average(v=>v.y>=stringBox.max.y-.003),bottom=average(v=>v.y<=stringBox.min.y+.003),nock=average(v=>v.z>=stringBox.max.z-.003),parent=groups.weapon_L;
      endpoint(root,'bow_tip_upper',parent,top);endpoint(root,'bow_tip_lower',parent,bottom);endpoint(root,'bow_nock',parent,nock);
      const muzzleNode=root.getObjectByName('attack_muzzle');root.getObjectByName('bow_nock').add(muzzleNode);muzzleNode.position.set(0,0,0);
    }
  }
}

export function prepareReconstructedDefender(scene,entry){
  if(!entry?.reconstruction||prepared.has(scene))return scene;
  const basic=entry.reconstruction.revision==='basic-defenders-v7';
  const {records,bones,skeletons}=capture(scene,!basic);
  if(!records.length)throw new Error('The approved reconstruction contains no physical meshes');
  const total=new THREE.Box3();for(const r of records)total.union(r.bounds);
  const height=total.max.y-total.min.y,children=[...scene.children],root=new THREE.Group();root.name='Approved reconstruction '+entry.id;scene.add(root);
  const groups=humanJoints(root,records,bones,height);
  for(const s of ['L','R']){
    const wingRecords=records.filter(r=>/^wing\b|\bwing.*feather|\bflight.*feather/i.test(r.semantic)).filter(r=>(side(r.semantic)||(r.bounds.getCenter(point()).x>0?'R':'L'))===s);
    if(wingRecords.length){const wingBox=new THREE.Box3();for(const r of wingRecords)wingBox.union(r.bounds);const p=wingBox.getCenter(point());p.x=s==='R'?wingBox.min.x:wingBox.max.x;groups['wing_'+s]=joint(root,'wing_'+s,p,groups.torso);}
  }
  for(const record of records)moveMesh(record,targetGroup(record,groups,basic));
  for(const child of children)scene.remove(child);
  for(const skeleton of skeletons)skeleton.dispose();
  const style=entry.reconstruction.attackStyle||entry.attackStyle||'staff';
  const presentationScale=entry.reconstruction.presentationScale||1;
  root.userData={geometricRig:true,reconstructionRevision:entry.reconstruction.revision,id:entry.id,family:entry.family,tier:entry.tier,sourceSha256:entry.sourceSha256,sourceFile:entry.reconstruction.sourceGlbFile,sourceGlbSha256:entry.assetSha256,sourceNativeSha256:entry.reconstruction.sourceNativeSha256,sourceViews:entry.reconstruction.reviewedViews,bodyHeight:height,bodyHeightMeters:height,sourceBounds:entry.metrics,presentationScale,role:entry.reconstruction.role,locomotion:entry.locomotion||'biped',attackStyle:style,integratedHeadInTorso:!basic,bowPlane:'forward-vertical',reconstructedTwoHandGrip:entry.id==='rimewatch',reconstructionAnimation:'conservative-rigid-source-v1'};
  setupEndpoints(root,records,groups,style);root.scale.setScalar(presentationScale);prepared.add(scene);scene.updateMatrixWorld(true);
  return scene;
}

// Small motions keep complete source arm/sleeve/hand volumes together. These
// source masters contain no authored gameplay clips or deforming cloth rigs.
export function applyReconstructedAttack(rig,{draw=0,stroke=0,cast=0,reducedMotion=false}={}){
  const move=(name,x=0,y=0,z=0)=>{const p=rig.joints.get(name);if(p&&!reducedMotion)p.node.rotation.set(p.rotation.x+x,p.rotation.y+y,p.rotation.z+z,p.rotation.order);};
  const style=rig.attackStyle;
  if(style==='focus'){move('torso_pivot',.026*cast,.028*cast,0);if(!reducedMotion)rig.joints.get('torso_pivot').node.position.y+=.012*cast;return;}
  if(rig.geometric.reconstructedTwoHandGrip){move('torso_pivot',-.022*draw,0,-.015*stroke);return;}
  if(style==='hammer'){move('upper_arm_R',-.30*draw,.025*stroke,-.06*stroke);}
  else if(style==='sword'){move('upper_arm_R',-.18*draw,-.16*stroke,-.15*stroke);}
  else if(style==='spear'||style==='lance'){move('upper_arm_R',.17*stroke,0,-.035*stroke);}
  else if(style==='bow'){
    move('upper_arm_R',.055*draw,-.025*draw,0);move('upper_arm_L',.025*stroke,0,0);
    const nock=rig.joints.get('bow_nock');if(nock&&!reducedMotion)nock.node.position.z+=Math.min(.055,rig.geometric.bodyHeight*.035)*draw;
    if(rig.string)rig.string.draw=reducedMotion?0:draw;
  }
  else if(style==='siege'||style==='dartCannon'){move('weapon_R',.025*stroke,0,0);}
  else if(style==='breath'){move('head_pivot',-.025*cast,0,0);}
  else{move('upper_arm_R',.105*cast,0,-.04*cast);move('upper_arm_L',.045*cast,0,.025*cast);}
  move('wing_L',0,0,.045*stroke);move('wing_R',0,0,-.045*stroke);
}

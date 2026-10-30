import * as THREE from 'three';
// Cached template-local surface points. Bone transforms are read at playback;
// neither skin buffers, native animations nor gameplay coordinates are edited.
const safe=THREE.PropertyBinding.sanitizeNodeName;
const candidates={
 'aura-channel':['v2.fx.flame.1','cast.shared-bowl','cast.right.hand','cast.right.prop0'],
 'bow-shot':['archery.draw.hand','archery.string'],
 'ballista-shot':['cm_ballista_nock','cm_ballista_bolt'],
 'catapult-shot':['cm_catapult_stone'],
 'cannon-shot':['cm_cannon_barrel_recoil'],
 'rifle-shot':['cm_held_firearm_recoil'],
 'mortar-shot':['cm_held_firearm_recoil'],
 'gatling-shot':['cm_rotary_pack_1','cm_gatling_side_drive'],
 'flamethrower-channel':['cm_continuous_nozzle_pressure'],
 'forge-channel':['v2.fx.flame.1','cm_forge_tong_servicing','cm_forge_stock_stoking','cm_furnace_pressure_controls'],
 'dragon-breath':['cm_beast_jaw','cm_beast_hatchling_neck','cm_beast_neck'],
 'beak-strike':['v3.avian.head','cm_beast_neck'],
 'spider-strike':['cm_spider_fang_strike','queen_claw_1','queen_claw_-1'],
 'ent-slam':['v3.ent.right.hand','v3.ent.left.hand'],
 'mech-punch':['cm_construct_elbow','cm_construct_shoulder'],
 'grenade-throw':['throw.shared-grenade','throw.right.hand'],
 'staff-cast':['cast.right.prop0','cast.right.hand'],
 'hand-cast':['cast.right.hand','cast.left.hand','spirit.leaf-channel'],
 'drum-strike':['drum.right.hand','drum.left.hand'],
};
const melee=['humanoid.primary.hand','humanoid.secondary.hand'];
function weightedSurface(actor,bone,mode,side=0){
 const points=[],v=new THREE.Vector3();actor.updateMatrixWorld(true);
 actor.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const bi=mesh.skeleton.bones.indexOf(bone),p=mesh.geometry.attributes.position,w=mesh.geometry.attributes.skinWeight,i=mesh.geometry.attributes.skinIndex;
  if(bi<0||!w||!i)return;mesh.skeleton.update();
  for(let n=0;n<p.count;n++){
   let weight=0;for(let k=0;k<4;k++)if(i.getComponent(n,k)===bi)weight+=w.getComponent(n,k);
   if(weight<.5)continue;
   v.fromBufferAttribute(p,n);mesh.applyBoneTransform(n,v);mesh.localToWorld(v);actor.worldToLocal(v);points.push(v.clone());
  }
 });
 if(!points.length)return null;
 const centre=new THREE.Vector3();for(const p of points)centre.add(p);centre.divideScalar(points.length);
 const bounds=new THREE.Box3().setFromPoints(points),origin=actor.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
 if(mode==='centre')return centre;
 const axis=mode==='top'?'y':'z';
 // Native held weapons may face either sign in the exported bind pose. The
 // end farther from the gripping/recoil joint is the actual emitting end.
 const sign=axis==='y'||Math.abs(bounds.max[axis]-origin[axis])>=Math.abs(bounds.min[axis]-origin[axis])?1:-1;
 const end=sign>0?bounds.max[axis]:bounds.min[axis],band=Math.max(.008,(bounds.max[axis]-bounds.min[axis])*.025);
 let tip=points.filter(p=>Math.abs(p[axis]-end)<=band);if(side){const mid=(bounds.min.x+bounds.max.x)/2;const half=tip.filter(p=>side*(p.x-mid)>0);if(half.length)tip=half;}if(mode==='barrel'){const top=Math.max(...tip.map(p=>p.y));tip=tip.filter(p=>p.y>=top-.025);}
 const count=tip.length;centre.set(0,0,0);for(const p of tip)centre.add(p);return centre.divideScalar(count);
}
export function prepareFactionVfxAnchors(actor,entry){
 const motion=entry.attack?.motionKind;if(!motion)return;
 const names=candidates[motion]||melee;
 const bone=names.map(n=>actor.getObjectByName(safe(n))).find(Boolean);
 if(!bone)throw Error('Missing native weapon anchor: '+entry.family+'/'+motion);
 const pointOnly=['bow-shot','ballista-shot','hand-cast'].includes(motion)||bone.name.startsWith(safe('v2.fx.flame.'));
 const mode=['staff-cast','spear-thrust','sword-slash','dual-blade','axe-cleave','pick-strike','hammer-slam'].includes(motion)?'top':['catapult-shot','grenade-throw','drum-strike'].includes(motion)?'centre':motion==='gatling-shot'?'barrel':'front';
 const point=pointOnly?actor.worldToLocal(bone.getWorldPosition(new THREE.Vector3())):weightedSurface(actor,bone,mode);
 actor.updateMatrixWorld(true);
 const local=bone.worldToLocal(actor.localToWorld(point||new THREE.Vector3()));
 const lanes=entry.attack.weaponGroup==='paired-flame-nozzles'?[-1,1].map(side=>{const p=weightedSurface(actor,bone,mode,side);return bone.worldToLocal(actor.localToWorld(p)).toArray();}):[local.toArray()];
 actor.userData.factionVfxAnchor={bone:bone.name,offset:local.toArray(),lanes,motion,weapon:entry.attack.weaponGroup,method:pointOnly?'Native contact joint':'Native skin surface at weapon tip'};
}
export function factionVfxAnchor(actor,out=new THREE.Vector3(),{kind,lane=0}={}){
 const d=actor.userData.factionVfxAnchor;if(!d)return null;
 actor.updateMatrixWorld(true);
 // Human hand-lightning retains its approved palm release. Bows, muzzles,
 // beaks and continuous channels always use their own emitting equipment.
 if(kind==='hand'&&['hand-cast','staff-cast'].includes(d.motion)){
  const palm=actor.getObjectByName(safe('cast.right.hand'));if(palm)return palm.getWorldPosition(out);
 }
 const bone=actor.getObjectByName(d.bone);return bone?bone.localToWorld(out.fromArray(d.lanes?.[lane]||d.offset)):null;
}

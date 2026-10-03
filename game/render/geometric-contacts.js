import * as THREE from 'three';

// CPU-only inspection of the actual imported surfaces. No authored geometry,
// materials, matrices or cached peers are modified by these measurements.
const label=node=>(node.userData.semanticPart||node.name||'').replaceAll('_',' ');
const descendant=(node,parent)=>{for(let p=node;p;p=p.parent)if(p===parent)return true;return false;};
const isJoint=name=>/^(?:torso_pivot|head_pivot|mount_.*pivot|upper_|forearm_|hand_|weapon_|shin_|foot_|wing_|bow_)/.test(name);
const trianglesOf=nodes=>{
  const triangles=[];
  for(const node of nodes){
    const p=node.geometry?.attributes.position,index=node.geometry?.index;if(!p)continue;
    const count=index?index.count:p.count;
    for(let i=0;i<count;i+=3){
      const vertices=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(node.matrixWorld));
      const triangle=new THREE.Triangle(...vertices),bounds=new THREE.Box3().setFromPoints(vertices);
      triangles.push({triangle,bounds});
    }
  }
  return triangles;
};
function boundsDistanceSquared(a,b){
  const axis=key=>Math.max(0,a.min[key]-b.max[key],b.min[key]-a.max[key]);
  return axis('x')**2+axis('y')**2+axis('z')**2;
}
function intersects(a,b){
  const plane=b.getPlane(new THREE.Plane()),point=new THREE.Vector3();
  for(const [p,q] of [[a.a,a.b],[a.b,a.c],[a.c,a.a]]){
    const d0=plane.distanceToPoint(p),d1=plane.distanceToPoint(q);
    if(d0*d1>0||Math.abs(d0-d1)<1e-12)continue;
    point.copy(p).lerp(q,d0/(d0-d1));if(b.containsPoint(point))return true;
  }
  return false;
}
function inside(point,triangles){
  const ray=new THREE.Ray(point,new THREE.Vector3(.913,.271,.303).normalize()),hit=new THREE.Vector3(),distances=[];
  for(const {triangle:t} of triangles){if(intersectRayTriangleSeam(ray,t,hit)){const d=hit.distanceTo(point);if(d<1e-7)return true;distances.push(d);}}
  distances.sort((a,b)=>a-b);let unique=0,last=-Infinity;
  for(const d of distances)if(d-last>1e-6){unique++;last=d;}
  return unique%2===1;
}
function segmentGapSquared(a,b,c,d,nearA,nearB){
  const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),aa=u.dot(u),bb=u.dot(v),cc=v.dot(v),dd=u.dot(w),ee=v.dot(w),denom=aa*cc-bb*bb;
  let s=denom>1e-15?THREE.MathUtils.clamp((bb*ee-cc*dd)/denom,0,1):0;
  let t=cc>1e-15?(bb*s+ee)/cc:0;
  if(t<0){t=0;s=aa>1e-15?THREE.MathUtils.clamp(-dd/aa,0,1):0;}
  else if(t>1){t=1;s=aa>1e-15?THREE.MathUtils.clamp((bb-dd)/aa,0,1):0;}
  nearA.copy(a).addScaledVector(u,s);nearB.copy(c).addScaledVector(v,t);return nearA.distanceToSquared(nearB);
}
export function physicalSurfaceGap(nodesA,nodesB){
  const a=trianglesOf(nodesA),b=trianglesOf(nodesB);
  if(!a.length||!b.length)return {gap:Infinity,missingSurface:true};
  let best=Infinity;const point=new THREE.Vector3(),nearA=new THREE.Vector3(),nearB=new THREE.Vector3(),edgeA=new THREE.Vector3(),edgeB=new THREE.Vector3();
  for(const ta of a)for(const tb of b){
    if(boundsDistanceSquared(ta.bounds,tb.bounds)>best)continue;
    if(intersects(ta.triangle,tb.triangle)||intersects(tb.triangle,ta.triangle))return {gap:0,intersecting:true};
    for(const v of [ta.triangle.a,ta.triangle.b,ta.triangle.c]){
      tb.triangle.closestPointToPoint(v,point);const d=point.distanceToSquared(v);
      if(d<best){best=d;nearA.copy(v);nearB.copy(point);}
    }
    for(const v of [tb.triangle.a,tb.triangle.b,tb.triangle.c]){
      ta.triangle.closestPointToPoint(v,point);const d=point.distanceToSquared(v);
      if(d<best){best=d;nearA.copy(point);nearB.copy(v);}
    }
    for(const [p,q] of [[ta.triangle.a,ta.triangle.b],[ta.triangle.b,ta.triangle.c],[ta.triangle.c,ta.triangle.a]])for(const [r,s] of [[tb.triangle.a,tb.triangle.b],[tb.triangle.b,tb.triangle.c],[tb.triangle.c,tb.triangle.a]]){
      const d=segmentGapSquared(p,q,r,s,edgeA,edgeB);if(d<best){best=d;nearA.copy(edgeA);nearB.copy(edgeB);}
    }
    if(best<1e-14)return {gap:0,intersecting:true};
  }
  // Closed material-split GLB parts can be fully nested without a triangle
  // crossing. Containment is real volume contact, not a bounding-box guess.
  if(inside(a[0].triangle.a,b)||inside(b[0].triangle.a,a))return {gap:0,contained:true};
  return {gap:Math.sqrt(best),nearestA:nearA.toArray(),nearestB:nearB.toArray()};
}
export function measureHeadCoverCoverage(actor,{tolerance=.00002}={}){
  actor.updateWorldMatrix(true,true);const heads=[],results=[];actor.traverse(n=>{if(!n.isMesh&&/(?:^|_)head_pivot$/.test(n.name))heads.push(n);});
  for(const head of heads){
    const own=[];head.traverse(n=>{if(n.isMesh)own.push(n);});
    const faces=own.filter(n=>/observed face|^face\b/i.test(label(n))),covers=own.filter(n=>/hood|helmet|rounded metal cap/i.test(label(n))&&!/fringe|buckle|jewel|crystal|plume|feather|stud|neck/i.test(label(n)));
    if(!covers.length||!faces.length)continue;
    const inverse=head.matrixWorld.clone().invert(),local=nodes=>trianglesOf(nodes).map(({triangle:t})=>({triangle:new THREE.Triangle(t.a.applyMatrix4(inverse),t.b.applyMatrix4(inverse),t.c.applyMatrix4(inverse))})),skin=local(faces),cover=local(covers),bounds=new THREE.Box3().setFromPoints(skin.flatMap(({triangle:t})=>[t.a,t.b,t.c])),coverBounds=new THREE.Box3().setFromPoints(cover.flatMap(({triangle:t})=>[t.a,t.b,t.c])),size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3()),rays=[];
    for(const y of [-.3,0,.3])for(const x of [-.3,0,.3]){
      const origin=new THREE.Vector3(centre.x+x*size.x,centre.y+y*size.y,centre.z+.22*size.z);
      if(!inside(origin,skin))continue;
      for(const direction of [new THREE.Vector3(-1,0,0),new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0)]){
        // A source pot helmet covers the crown, not the exposed cheeks below
        // its rim. Side/rear coverage applies only inside that physical band.
        if(!direction.y&&(origin.y<coverBounds.min.y-tolerance||origin.y>coverBounds.max.y+tolerance))continue;
        const skinDistance=firstRayHit(origin,direction,skin),coverDistance=lastRayHit(origin,direction,cover);
        rays.push({originHeadLocal:origin.toArray(),direction:direction.toArray(),skinDistanceLocalM:Number.isFinite(skinDistance)?skinDistance:null,coverDistanceLocalM:Number.isFinite(coverDistance)?coverDistance:null,pass:Number.isFinite(coverDistance)&&coverDistance+tolerance>=skinDistance});
      }
    }
    results.push({head:head.name,faceParts:faces.map(n=>n.name),coverParts:covers.map(n=>n.name),criterion:'Outward actual triangle rays from protected rear half of face; legitimate front opening exempt',testedRays:rays.length,rays,pass:rays.length>0&&rays.every(r=>r.pass)});
  }
  return {results,failures:results.filter(r=>!r.pass)};
}
export function measureGeometricContacts(actor,{tolerance=.004}={}){
  actor.updateWorldMatrix(true,true);const meshes=[];let metadata=null;actor.traverse(node=>{if(!metadata&&node.userData.geometricRig)metadata=node.userData;if(node.isMesh&&!/Charging|Articulated taut/.test(node.name))meshes.push(node);});
  const scale=Math.max(1e-8,actor.getWorldScale(new THREE.Vector3()).y),interfaces=[];
  const contact=(kind,partA,partB,side=null)=>{
    const result=physicalSurfaceGap(partA,partB),gapNativeM=result.gap/scale;
    interfaces.push({kind,side,partsA:partA.map(n=>n.name),partsB:partB.map(n=>n.name),...result,
      gapWorldM:Number.isFinite(result.gap)?result.gap:null,gapNativeM:Number.isFinite(gapNativeM)?gapNativeM:null,
      toleranceNativeM:tolerance,pass:gapNativeM<=tolerance});
  };
  for(const side of ['R','L','FL','FR','BL','BR']){
    const hip=actor.getObjectByName('upper_leg_'+side),shin=actor.getObjectByName('shin_'+side),foot=actor.getObjectByName('foot_'+side);
    if(!shin||!foot)continue;
    const shoes=meshes.filter(n=>descendant(n,foot)),lower=meshes.filter(n=>descendant(n,shin)&&!descendant(n,foot));
    // Legacy Soldier has one trouser volume on the thigh spanning the shin.
    const spanning=hip?meshes.filter(n=>descendant(n,hip)&&!descendant(n,shin)&&/trouser|leg|limb/i.test(label(n))):[];
    const lowerAnatomy=lower.filter(n=>/leg|trouser|limb|shin|calf/i.test(label(n)));
    if(lowerAnatomy.length||spanning.length)contact('shoe-to-shin',shoes,lowerAnatomy.length?lower:spanning,side);
    else{
      // Approved gown assets may hide the entire leg; do not invent a shin
      // from a pivot name. Inspect the visible boot/garment interface instead.
      const garment=meshes.filter(n=>!descendant(n,foot)&&/gown|skirt|dress|coat.*panel/i.test(label(n)));
      contact('shoe-to-garment',shoes,garment,side);
    }
    if(hip&&lowerAnatomy.length){const upper=meshes.filter(n=>descendant(n,hip)&&!descendant(n,shin)&&/leg|trouser|limb|thigh/i.test(label(n)));if(upper.length)contact('knee-link',upper,lower,side);}
  }
  if(['lance','spear'].includes(metadata?.attackStyle)){
    const shoulder=actor.getObjectByName('upper_arm_R'),forearm=actor.getObjectByName('forearm_R'),hand=actor.getObjectByName('hand_R'),weapon=actor.getObjectByName('weapon_R'),torso=actor.getObjectByName('torso_pivot');
    if(forearm&&hand)contact('thrust-wrist',meshes.filter(n=>descendant(n,forearm)&&!descendant(n,hand)),meshes.filter(n=>descendant(n,hand)&&!descendant(n,weapon)),'R');
    if(shoulder&&torso){const upper=meshes.filter(n=>descendant(n,shoulder)&&!descendant(n,forearm)&&/arm|sleeve|deltoid|shoulder|pauldron/i.test(label(n))),body=meshes.filter(n=>descendant(n,torso)&&/bodice|chest|thorax|torso|cuirass/i.test(label(n))&&!/jewel|gem|brooch|rivet|buckle/i.test(label(n))&&!hasLimbAncestor(n,torso));if(upper.length&&body.length)contact('thrust-shoulder',upper,body,'R');}
  }
  const heads=[];actor.traverse(node=>{if(!node.isMesh&&/(?:^|_)head_pivot$/.test(node.name))heads.push(node);});
  for(const head of heads){
    const own=meshes.filter(n=>descendant(n,head)),flesh=own.filter(n=>/observed face|^face\b|scalp|hair/i.test(label(n))&&!/beard|moustache|fringe/i.test(label(n)));
    const caps=own.filter(n=>/\b(?:hat|cap|mitre|mitra|brim)\b/i.test(label(n))&&!/hair|scalp|buckle|jewel|crystal|plume|feather|stud/i.test(label(n)));
    if(caps.length&&flesh.length){
      contact('cap-to-head',caps,flesh,head.name);
      // A thin front brim touching the forehead cannot certify that the cap
      // crown is seated. Inspect five real skin/hair upper-surface rays under
      // its centre, catching the visible Engineer cap gap from side/back.
      // Double-leaf mitres have an intentionally open upper centre. Their
      // physical base contact above is the relevant support constraint; they
      // cannot be evaluated as though they had a continuous cap/hat roof.
      if(caps.some(n=>/\b(?:hat|cap|brim)\b/i.test(label(n))&&!/mitre|mitra/i.test(label(n)))){
        const crownSkin=flesh.filter(n=>/observed face|^face\b|scalp|hair.*(?:closed|cap)/i.test(label(n)));
        const seat=capSeatGap(crownSkin.length?crownSkin:flesh,caps,head),gapNativeM=seat.gap/scale;
        interfaces.push({kind:'cap-crown-seat',side:head.name,...seat,gapWorldM:Number.isFinite(seat.gap)?seat.gap:null,
          gapNativeM:Number.isFinite(gapNativeM)?gapNativeM:null,toleranceNativeM:tolerance,pass:gapNativeM<=tolerance});
      }
    }
    const neck=own.filter(n=>/neck|gorget|cervical/i.test(label(n))),headVolume=own.filter(n=>/observed face|^face\b|helmet|\bhead\b|skull|cranium|visor/i.test(label(n))&&!/eyes|trophy|jewel|crystal|gem|rivet|crest|neck|gorget|cervical/i.test(label(n))),base=neck.length?neck:headVolume;
    if(neck.length&&headVolume.length)contact('head-to-neck',headVolume,neck,head.name);
    const torso=head.parent;
    const body=torso?meshes.filter(n=>descendant(n,torso)&&!descendant(n,head)&&/bodice|chest|torso|body|thorax|breast|collar|gorget|neck|cervical|cuirass/i.test(label(n))&&!/jewel|gem|rivet|buckle|brooch|sun.*disk|badge/i.test(label(n))&&!hasLimbAncestor(n,torso)):[];
    if(base.length&&body.length)contact('head-neck-to-body',base,body,head.name);
  }
  return {scale,toleranceNativeM:tolerance,interfaces,failures:interfaces.filter(c=>!c.pass)};
}
function hasLimbAncestor(node,stop){for(let p=node.parent;p&&p!==stop;p=p.parent)if(isJoint(p.name)&&p.name!==stop.name)return true;return false;}
function intersectRayTriangleSeam(ray,triangle,target){
  // World -> head-local matrix multiplication can place an exact ridge/diagonal
  // sample a few ulps outside BOTH adjacent triangles. Strict edge tests then
  // miss a closed roof or skip the upper skin and hit its lower face instead.
  // Moller-Trumbore keeps the same actual plane and forward ray, accepting only
  // 1e-10 dimensionless barycentric rounding at triangle boundaries. This is
  // many orders smaller than the unchanged physical/coverage tolerances.
  const edge1=triangle.b.clone().sub(triangle.a),edge2=triangle.c.clone().sub(triangle.a),cross=ray.direction.clone().cross(edge2),det=edge1.dot(cross);
  if(Math.abs(det)<=1e-14*edge1.length()*edge2.length()*ray.direction.length())return null;
  const inverse=1/det,relative=ray.origin.clone().sub(triangle.a),u=relative.dot(cross)*inverse,q=relative.clone().cross(edge1),v=ray.direction.dot(q)*inverse,seam=1e-10;
  if(u<-seam||v<-seam||u+v>1+seam)return null;
  const distance=edge2.dot(q)*inverse;if(distance<0)return null;
  return ray.at(distance,target);
}
function firstRayHit(origin,direction,triangles){
  const ray=new THREE.Ray(origin,direction),point=new THREE.Vector3();let nearest=Infinity;
  for(const {triangle:t} of triangles)if(intersectRayTriangleSeam(ray,t,point)){const distance=origin.distanceTo(point);if(distance<nearest)nearest=distance;}
  return nearest;
}
function lastRayHit(origin,direction,triangles){
  const ray=new THREE.Ray(origin,direction),point=new THREE.Vector3();let furthest=-Infinity;
  for(const {triangle:t} of triangles)if(intersectRayTriangleSeam(ray,t,point))furthest=Math.max(furthest,origin.distanceTo(point));
  return furthest;
}
function capSeatGap(flesh,caps,head){
  // Head-local axes make the sampled crown invariant under actual posed head
  // tilt/yaw, so world-up ray changes cannot manufacture a contact regression.
  const inverse=head.matrixWorld.clone().invert(),localNodes=nodes=>trianglesOf(nodes).map(({triangle:t})=>({triangle:new THREE.Triangle(t.a.applyMatrix4(inverse),t.b.applyMatrix4(inverse),t.c.applyMatrix4(inverse))}));
  const skin=localNodes(flesh),cover=localNodes(caps),coverParts=new Map();
  for(const cap of caps){const key=cap.parent===head?cap:cap.parent;if(!coverParts.has(key))coverParts.set(key,[]);coverParts.get(key).push(cap);}
  const coverVolumes=[...coverParts.values()].map(localNodes),box=new THREE.Box3().setFromPoints(skin.flatMap(({triangle:t})=>[t.a,t.b,t.c])),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
  const samples=[],worldScale=head.getWorldScale(new THREE.Vector3()).y;
  for(const [dx,dz] of [[0,0],[-.22,0],[.22,0],[0,-.22],[0,.22]]){
    const origin=new THREE.Vector3(centre.x+dx*size.x,box.max.y+size.y,centre.z+dz*size.z),down=firstRayHit(origin,new THREE.Vector3(0,-1,0),skin);
    if(!Number.isFinite(down))continue;const top=origin.clone().add(new THREE.Vector3(0,-down,0));
    const d=inside(top,cover)||coverVolumes.some(volume=>inside(top,volume))?0:firstRayHit(top.clone().add(new THREE.Vector3(0,1e-7,0)),new THREE.Vector3(0,1,0),cover);
    samples.push({originHeadLocal:top.toArray(),gapLocalM:Number.isFinite(d)?d:null});
  }
  const gap=samples.length?Math.max(...samples.map(s=>s.gapLocalM??Infinity))*worldScale:Infinity;
  return {gap,samples,criterion:'Five actual upper skin/hair surface rays to cap underside; head-local, not bounding boxes or front brim contact'};
}

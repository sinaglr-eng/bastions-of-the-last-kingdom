import * as THREE from 'three';

function visibleSurface(node,figure){
  const excluded=[figure.userData.bar,figure.userData.aura,figure.userData.shards];
  for(let current=node;current;current=current.parent){
    if(!current.visible||excluded.includes(current)||current.userData.sourceOrbitGem||current.userData.enemyPickIgnore)return false;
  }
  return true;
}
const visibleMaterial=material=>!!material&&material.visible!==false&&(!material.transparent||material.opacity>0);

// Raycast only the rendered body, never its health bar, defence FX or corpse.
// Recursive body meshes also cover imported/optimized models and flying actors.
export function pointedEnemy(raycaster,figures,game,{occluders=[]}={}){
  if(game.phase!=='combat')return null;
  const surfaces=[],owners=new Map(),live=new Map(game.combat.enemies.filter(e=>!e.dead&&e.hp>0&&game.combat.isRevealed(e)).map(e=>[e.id,e]));
  for(const [id,figure] of figures){
    if(!live.has(id)||!figure.visible||!figure.userData.body)continue;
    figure.updateWorldMatrix(true,true);
    figure.userData.body.traverse(node=>{
      const materials=Array.isArray(node.material)?node.material:[node.material];
      if(node.isMesh&&visibleSurface(node,figure)&&materials.some(visibleMaterial)){surfaces.push(node);owners.set(node,id);}
    });
  }
  for(const hit of raycaster.intersectObjects(surfaces,false)){
    const material=Array.isArray(hit.object.material)?hit.object.material[hit.face?.materialIndex??0]:hit.object.material;
    if(!visibleMaterial(material))continue;
    // A solid wall/defender in front owns its visible pixel; transparent aura
    // meshes do not occlude inspection of the actual body behind them.
    for(const object of occluders)object.updateWorldMatrix(true,true);
    const blocked=raycaster.intersectObjects(occluders,true).some(blocker=>{
      const m=Array.isArray(blocker.object.material)?blocker.object.material[blocker.face?.materialIndex??0]:blocker.object.material;
      return blocker.distance<hit.distance-1e-6&&visibleSurface(blocker.object,{userData:{}})&&visibleMaterial(m)&&!m.transparent;
    });
    return blocked?null:owners.get(hit.object);
  }
  return null;
}

export function createEnemySelectionRing(){
  const ring=new THREE.Mesh(new THREE.RingGeometry(.94,1,64),new THREE.MeshBasicMaterial({color:'#ffd477',side:THREE.DoubleSide,transparent:true,opacity:.95,depthWrite:false}));
  ring.name='selected-enemy-ring';ring.rotation.x=-Math.PI/2;ring.renderOrder=2;ring.visible=false;ring.raycast=()=>{};
  return ring;
}

const bounds=new THREE.Box3(),size=new THREE.Vector3();
export function syncEnemySelectionRing(ring,enemy,figure){
  ring.visible=!!enemy&&!!figure?.visible&&!!figure.userData.body;
  if(!ring.visible)return false;
  figure.updateWorldMatrix(true,true);bounds.setFromObject(figure.userData.body,true);bounds.getSize(size);
  const radius=Math.max(.38,Math.max(size.x,size.z)*.56);
  ring.position.copy(figure.getWorldPosition(new THREE.Vector3()));ring.position.y+=.065;
  ring.scale.setScalar(radius);return true;
}

export function disposeEnemySelectionRing(ring){ring.removeFromParent();ring.geometry.dispose();ring.material.dispose();}

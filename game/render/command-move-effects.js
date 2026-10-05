import * as THREE from 'three';

// Reuse one geometry and three materials for all move targets. These static
// tile outlines remain distinct from defender ranges and recipe markers.
export class CommandMoveEffects {
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x-18,y,z-18)}={}){
    this.position=position;this.disposed=false;this.group=new THREE.Group();this.group.name='Command Move targets';scene.add(this.group);
    this.geometry=new THREE.RingGeometry(.78,.89,4);
    const make=color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false});
    this.materials={defender:make('#75bafa'),selected:make('#ffdd83'),wall:make('#78e3ce')};this.items=new Map();
  }
  sync(game){
    if(this.disposed)return;
    const move=game.commandMove;
    const defenders=move?.active?move.eligibleDefenders:[],walls=move?.active?move.validWalls:[];
    const entries=[...defenders.map(t=>({tower:t,role:t.id===move.defenderId?'selected':'defender'})),...walls.map(t=>({tower:t,role:'wall'}))];
    const ids=new Set(entries.map(({tower})=>tower.id));
    for(const [id,mesh]of this.items)if(!ids.has(id)){mesh.removeFromParent();this.items.delete(id);}
    for(const {tower,role}of entries){
      let mesh=this.items.get(tower.id);
      if(!mesh){mesh=new THREE.Mesh(this.geometry,this.materials[role]);mesh.rotation.set(-Math.PI/2,0,Math.PI/4);mesh.renderOrder=3;mesh.raycast=()=>{};this.group.add(mesh);this.items.set(tower.id,mesh);}
      mesh.name=`Move ${role}: ${tower.id}`;mesh.material=this.materials[role];mesh.position.copy(this.position(tower.x,.082,tower.z));
      mesh.userData={towerId:tower.id,moveRole:role};
    }
    this.group.visible=entries.length>0;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.group.removeFromParent();this.items.clear();this.group.clear();this.geometry.dispose();Object.values(this.materials).forEach(material=>material.dispose());}
}

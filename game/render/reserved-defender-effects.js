import * as THREE from 'three';
import {siteUrl} from '../site-url.js';
import {battlefieldIcon} from './battlefield-icon.js';
import {disposeGeometricResources} from './geometric-resources.js';

// The Reserve action and its battlefield marker share the same pin.
export class ReservedDefenderEffects {
  constructor(scene,{position=(x,y,z)=>new THREE.Vector3(x-18,y,z-18)}={}){
    this.position=position;this.disposed=false;this.items=new Map();this.anchor=new THREE.Vector3();this.group=new THREE.Group();this.group.name='Reserved defenders';scene.add(this.group);
    this.template=null;
  }
  create(tower){
    const pin=new THREE.Group();pin.name=`Reserved defender #${tower.id}`;pin.userData={towerId:tower.id,inactive:true};
    this.template??=battlefieldIcon(siteUrl('assets/ui/war-table/ui-icons/pin.webp'),.72);
    const mesh=this.template.clone();mesh.position.y=.02;mesh.renderOrder=24;mesh.raycast=()=>{};pin.add(mesh);
    this.group.add(pin);return pin;
  }
  sync(game,models=new Map()){
    if(this.disposed)return;
    const reserved=game.towers.filter(t=>t.state==='reserved'),ids=new Set(reserved.map(t=>t.id));
    for(const [id,pin]of this.items)if(!ids.has(id)){pin.removeFromParent();this.items.delete(id);}
    for(const tower of reserved){
      let pin=this.items.get(tower.id);if(!pin){pin=this.create(tower);this.items.set(tower.id,pin);}
      const figure=models.get(tower.id)?.object;pin.userData.height=figure?new THREE.Box3().setFromObject(figure).max.y:2;
      pin.position.copy(this.position(tower.x,pin.userData.height+.5,tower.z));
    }
    this.group.visible=reserved.length>0;
  }
  update(camera,viewportHeight){
    if(this.disposed)return;
    for(const pin of this.items.values()){
      this.anchor.copy(pin.position);this.anchor.y=pin.userData.height+.5;
      const unitsPerPixel=2*camera.position.distanceTo(this.anchor)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,viewportHeight);
      const scale=Math.min(3,Math.max(.8,unitsPerPixel*23/.72));pin.scale.setScalar(scale);pin.position.y=pin.userData.height+.43*scale;pin.quaternion.copy(camera.quaternion);
    }
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.group.removeFromParent();this.group.clear();this.items.clear();disposeGeometricResources(this.template);this.template=null;}
}

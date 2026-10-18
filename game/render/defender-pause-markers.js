import {Box3,Vector3} from 'three';

const pauseGlyph='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor"/></svg>';

// These screen-sized badges read only each real defender's attackPaused flag.
// Global pause, selection and rank previews cannot create a badge.
export class DefenderPauseMarkers{
  constructor(container,{name=tower=>`Defender #${tower.id}`}={}){
    this.container=container;this.document=container.ownerDocument||globalThis.document;this.name=name;this.items=new Map();this.disposed=false;this.bounds=new Box3();this.point=new Vector3();
    this.layer=this.document.createElement('div');this.layer.className='defender-pause-markers';container.append(this.layer);
  }
  update(models,camera,width=this.container.clientWidth,height=this.container.clientHeight){
    if(this.disposed)return;
    const current=new Set();
    camera.updateMatrixWorld();
    for(const [id,value]of models){
      const tower=value.tower;if(tower.state!=='active'||tower.attackPaused!==true)continue;
      current.add(id);let marker=this.items.get(id);
      if(!marker){marker=this.document.createElement('span');marker.className='defender-pause-marker';marker.setAttribute('role','img');marker.innerHTML=pauseGlyph;this.layer.append(marker);this.items.set(id,marker);}
      const label=`${this.name(tower)} · attacks paused`;if(marker.getAttribute('aria-label')!==label)marker.setAttribute('aria-label',label);
      value.object.getWorldPosition(this.point);this.bounds.setFromObject(value.actor);this.point.y=(this.bounds.isEmpty()?this.point.y+1.5:this.bounds.max.y)+.28;
      this.point.project(camera);const visible=width>0&&height>0&&Math.abs(this.point.x)<=1&&Math.abs(this.point.y)<=1&&this.point.z>=-1&&this.point.z<=1;
      marker.hidden=!visible;
      if(visible)marker.style.transform=`translate(${(this.point.x+1)*width/2}px,${(1-this.point.y)*height/2}px) translate(-50%,-100%)`;
    }
    for(const [id,marker]of this.items)if(!current.has(id)){marker.remove();this.items.delete(id);}
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.items.clear();this.layer.remove();}
}

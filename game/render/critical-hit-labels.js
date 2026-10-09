import {Vector3} from 'three';

// Cosmetic event consumer: combat owns the critical roll and actual damage.
export class CriticalHitLabels{
  constructor(container,{half=18,maxLabels=24}={}){
    this.half=half;this.maxLabels=maxLabels;this.items=[];
    this.host=container.ownerDocument.createElement('div');this.host.className='critical-hit-labels';this.host.setAttribute('aria-hidden','true');container.append(this.host);
  }
  event(type,payload){
    if(['wave','won','lost'].includes(type)){this.clear();return;}
    if(type!=='critical-hit'||payload.visible===false||!(payload.effectiveDamage>0)||!payload.enemy)return;
    const el=this.host.ownerDocument.createElement('span');el.className='critical-hit-label';el.textContent='Crit!';
    this.host.append(el);const e=payload.enemy;
    this.items.push({el,enemy:e,x:e.x,z:e.z,height:e.flying?2.7:1.9,life:.85});
    if(this.items.length>this.maxLabels)this.items.shift().el.remove();
  }
  update(dt,camera,width,height,{reducedMotion=false,isRevealed=()=>true}={}){
    for(const item of this.items){
      item.life-=dt;
      const v=new Vector3(item.x-this.half,item.height+(reducedMotion?0:(.85-item.life)*.55),item.z-this.half).project(camera);
      item.el.hidden=item.life<=0||!isRevealed(item.enemy)||v.z<-1||v.z>1||Math.abs(v.x)>1||Math.abs(v.y)>1;
      item.el.style.transform=`translate(${(v.x+1)*width/2}px,${(1-v.y)*height/2}px) translate(-50%,-100%)`;
      item.el.style.opacity=String(Math.min(1,Math.max(0,item.life/.25)));
    }
    this.items=this.items.filter(item=>{if(item.life>0)return true;item.el.remove();return false;});
  }
  clear(){for(const item of this.items)item.el.remove();this.items=[];}
  dispose(){this.clear();this.host.remove();}
}

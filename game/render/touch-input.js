import {TOUCH} from 'three';

export function configureTouchControls(controls){
  controls.touches={ONE:TOUCH.PAN,TWO:TOUCH.DOLLY_ROTATE};
}

// Call only after PointerTapGesture accepts a primary release on an occupied tile.
// The first tap selects; the second may confirm the same current-round candidate.
export class SelectedTowerDoubleTap {
  constructor(now=()=>performance.now()){this.now=now;this.last=null;}
  tap(towerId,event,{selected=false,eligible=false}={}){
    const now=this.now(),last=this.last;
    if(!['touch','mouse','pen'].includes(event.pointerType)||!eligible||towerId==null){this.clear();return false;}
    const confirm=selected&&last?.towerId===towerId&&last.type===event.pointerType&&now-last.time<=450&&
      Math.hypot(event.clientX-last.x,event.clientY-last.y)<=24;
    this.last=confirm?null:{towerId,type:event.pointerType,time:now,x:event.clientX,y:event.clientY};
    return !!confirm;
  }
  clear(){this.last=null;}
}

// A gesture remains a drag even if a finger returns to its starting point.
// Every finger involved in a multi-touch gesture is ineligible to place a tower.
export class PointerTapGesture {
  constructor(now=()=>performance.now()){
    this.pointers=new Map();this.now=now;this.lastTouchEnd=-Infinity;
  }
  start(event){
    const pointer={x:event.clientX,y:event.clientY,button:event.button,type:event.pointerType,moved:false,blocked:false};
    if(this.pointers.size){pointer.blocked=true;for(const active of this.pointers.values())active.blocked=true;}
    this.pointers.set(event.pointerId,pointer);
  }
  move(event){
    const pointer=this.pointers.get(event.pointerId);if(!pointer)return;
    const slop=pointer.type==='touch'?12:6;
    if(Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>=slop)pointer.moved=true;
  }
  navigating(pointerId){const pointer=this.pointers.get(pointerId);return !!pointer&&(pointer.moved||pointer.blocked);}
  active(pointerId){return this.pointers.has(pointerId);}
  end(event){
    this.move(event);const pointer=this.pointers.get(event.pointerId);this.pointers.delete(event.pointerId);
    if(pointer?.type==='touch')this.lastTouchEnd=this.now();
    return !!pointer&&pointer.button===0&&!pointer.moved&&!pointer.blocked;
  }
  cancel(event){
    const pointer=this.pointers.get(event.pointerId);if(!pointer)return;
    if(pointer.type==='touch')this.lastTouchEnd=this.now();
    this.pointers.delete(event.pointerId);for(const active of this.pointers.values())active.blocked=true;
  }
  clear(){
    if([...this.pointers.values()].some(pointer=>pointer.type==='touch'))this.lastTouchEnd=this.now();
    this.pointers.clear();
  }
  suppressClick(event){return event.pointerType==='touch'||this.now()-this.lastTouchEnd<800;}
}

export function cancelPointerGesture(event,gesture,doubleTap,clearPointer){
  // OrbitControls releases capture after a normal pointerup. That notification
  // must preserve the completed first tap; an unexpected loss cancels it.
  if(event.type==='lostpointercapture'&&!gesture.active(event.pointerId))return false;
  gesture.cancel(event);doubleTap.clear();clearPointer();return true;
}

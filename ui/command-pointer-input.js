import {PointerTapGesture} from '../game/render/touch-input.js';

const managedType=type=>type==='touch'||type==='pen';
const commandButton=target=>{
  const button=target?.closest?.('button[data-action]');
  return button&&button.dataset.action!=='draw'&&!button.closest?.('.recipe-map-badge')?button:null;
};
const commandData=button=>JSON.stringify(Object.keys(button.dataset).sort().map(key=>[key,String(button.dataset[key])]));
function available(button){
  if(!button||button.disabled||button.hidden||button.isConnected===false||button.closest?.('[hidden],[inert],[aria-hidden="true"]')||button.matches?.(':disabled'))return false;
  if(button.getClientRects&&button.getClientRects().length===0)return false;
  const style=button.ownerDocument?.defaultView?.getComputedStyle?.(button);
  return !style||style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse';
}

// Ordinary commands use an accepted physical release instead of depending on
// Safari's later compatibility click. The caller owns actual game legality.
// A render may replace the button, but cannot replace the captured command.
export class CommandPointerInput {
  constructor({hitTest=null,activate=()=>{},captureIdentity=()=>null,validateIdentity=()=>false,now=()=>performance.now()}={}){
    this.hitTest=hitTest;this.activate=activate;this.captureIdentity=captureIdentity;this.validateIdentity=validateIdentity;this.now=now;
    this.gesture=new PointerTapGesture(now);this.origins=new Map();this.cancelledOrigins=new Map();this.releases=[];
  }
  prune(){const now=this.now();this.releases=this.releases.filter(release=>now-release.time>=0&&now-release.time<800);}
  remember(origin,event){
    this.prune();
    this.releases.push({action:origin.action,data:origin.data,x:event?.clientX??origin.x,y:event?.clientY??origin.y,time:this.now()});
    if(this.releases.length>32)this.releases.splice(0,this.releases.length-32);
  }
  start(event){
    if(event.pointerType==='mouse'){this.releases=[];return false;}
    if(!managedType(event.pointerType))return false;
    this.cancelledOrigins.delete(event.pointerId);
    // Noncommands participate too: a finger already on the map must block a
    // second finger on a button, and the reverse ordering must also be safe.
    this.gesture.start(event);
    const button=commandButton(event.target);if(!button)return false;
    const primary=event.isPrimary!==false&&event.button===0&&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)&&available(button);
    const identity=primary?this.captureIdentity(button,event):null;
    this.origins.set(event.pointerId,{action:button.dataset.action,data:commandData(button),identity,primary,type:event.pointerType,x:event.clientX,y:event.clientY});
    return primary&&identity!=null;
  }
  move(event){
    this.gesture.move(event);const origin=this.origins.get(event.pointerId)||this.cancelledOrigins.get(event.pointerId);
    if(origin){origin.x=event.clientX;origin.y=event.clientY;}
  }
  end(event){
    if(!managedType(event.pointerType))return false;
    const origin=this.origins.get(event.pointerId)||this.cancelledOrigins.get(event.pointerId),tap=this.gesture.end(event);
    this.origins.delete(event.pointerId);this.cancelledOrigins.delete(event.pointerId);
    if(!origin)return false;
    // Remember rejected releases as well; a delayed click cannot turn a drag,
    // cancelled identity or secondary finger into an executable command.
    this.remember(origin,event);
    const button=commandButton(this.hitTest?this.hitTest(event.clientX,event.clientY):event.target);
    if(!tap||!origin.primary||origin.identity==null||origin.type!==event.pointerType||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)||!available(button)||
      button.dataset.action!==origin.action||commandData(button)!==origin.data||!this.validateIdentity(origin.identity,button,event))return false;
    this.activate(button,event);return true;
  }
  cancel(event){
    const origin=this.origins.get(event.pointerId);if(origin){this.remember(origin,event);this.cancelledOrigins.set(event.pointerId,origin);}
    this.gesture.cancel(event);this.origins.delete(event.pointerId);
    if(this.cancelledOrigins.size>32)this.cancelledOrigins.delete(this.cancelledOrigins.keys().next().value);
  }
  lostCapture(event){if(this.gesture.active(event.pointerId)||this.origins.has(event.pointerId))this.cancel(event);}
  clear(){
    for(const [id,origin]of this.origins){this.remember(origin);this.cancelledOrigins.set(id,origin);}
    this.gesture.clear();this.origins.clear();
    while(this.cancelledOrigins.size>32)this.cancelledOrigins.delete(this.cancelledOrigins.keys().next().value);
    // Keep completed-release records: rendering a command's result may itself
    // scroll or blur, before the browser dispatches its compatibility click.
  }
  suppressClick(event){
    // WebKit can label a touch compatibility click as a mouse click. A real
    // mouse pointerdown clears the release records in start(); the later
    // click's advertised pointerType alone cannot identify a new mouse press.
    if(!(event.detail>0)||event.sourceCapabilities?.firesTouchEvents===false)return false;
    if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY))return false;
    this.prune();
    return this.releases.some(release=>{
      if(Math.hypot(event.clientX-release.x,event.clientY-release.y)>24)return false;
      // A command may remove itself or expose the canvas before click. Consume
      // that retargeted event at the same release position before other input.
      return true;
    });
  }
}

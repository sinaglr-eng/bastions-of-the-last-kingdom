// Three.js remains responsible for restoring GPU resources. This controller
// freezes the same in-memory run during interruption; it never reloads a page,
// replaces Game, rewinds RNG, or resumes an unseen battle automatically.
export class GraphicsRecovery{
 constructor(canvas,game,{onLost=()=>{},onRestored=()=>{},onFault=()=>{},onStateChange=()=>{}}={}){
  this.canvas=canvas;this.game=game;this.onLost=onLost;this.onRestored=onRestored;this.onFault=onFault;this.onStateChange=onStateChange;this.lost=false;this.awaitingResume=false;this.disposed=false;this.fault=null;this.retryPending=false;
  this.loss=()=>{if(this.disposed||this.lost)return;this.lost=true;this.awaitingResume=true;game.paused=true;this.onLost();this.notify();};
  this.restore=()=>{if(this.disposed||!this.lost)return;this.lost=false;game.paused=true;if(this.fault?.recoverable)this.retryPending=true;try{this.onRestored();}catch(error){this.fail(error,{stage:'battlefield'});}this.notify();};
  canvas.addEventListener('webglcontextlost',this.loss,{passive:true});canvas.addEventListener('webglcontextrestored',this.restore,{passive:true});
 }
 get blocked(){return this.lost||!!this.fault&&!this.retryPending;}
 notify(){this.onStateChange(this.lost?'lost':this.fault?this.retryPending?'recovering':'fault':this.awaitingResume?'restored':'ready',this.fault);this.game.emit?.('change');}
 fail(error,{stage='battlefield'}={}){
  if(this.disposed||this.fault&&!this.retryPending)return false;
  this.fault={stage,message:String(error?.message??error).slice(0,600),stack:String(error?.stack??'').slice(0,2000),recoverable:stage!=='simulation'};this.retryPending=false;this.awaitingResume=true;this.game.paused=true;this.onFault(this.fault);this.notify();return true;
 }
 retry(){if(this.disposed||this.lost||!this.fault?.recoverable)return false;this.retryPending=true;this.game.paused=true;try{this.notify();}catch(error){this.fail(error,{stage:'battlefield'});}return this.retryPending;}
 frameSucceeded(){if(this.disposed||this.lost||!this.fault||!this.retryPending)return false;this.fault=null;this.retryPending=false;this.game.paused=true;this.notify();return true;}
 update(){if(this.blocked){this.game.paused=true;return false;}if(this.fault){this.game.paused=true;return true;}if(this.awaitingResume&&!this.game.paused){this.awaitingResume=false;this.onStateChange('ready');}return true;}
 resume(){if(this.disposed||this.lost||this.fault||!this.awaitingResume)return false;this.awaitingResume=false;this.game.paused=false;this.notify();return true;}
 dispose(){if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.loss);this.canvas.removeEventListener('webglcontextrestored',this.restore);}
}

// A small, local-only incident record survives a page restart. No score,
// player name, asset data or external telemetry is written here.
export function recordGraphicsIncident(storage,incident){
 try{const key='forged-alliances.graphics-recovery-v1',text=storage?.getItem(key),old=text&&text.length<16000?JSON.parse(text):[],rows=Array.isArray(old)?old.slice(-7):[];rows.push(incident);storage?.setItem(key,JSON.stringify(rows));return true;}catch{return false;}
}

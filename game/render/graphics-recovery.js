// Three.js remains responsible for restoring GPU resources. This controller
// freezes the same in-memory run during interruption; it never reloads a page,
// replaces Game, rewinds RNG, or resumes an unseen battle automatically.
export class GraphicsRecovery{
 constructor(canvas,game,{onLost=()=>{},onRestored=()=>{},onStateChange=()=>{}}={}){
  this.canvas=canvas;this.game=game;this.onLost=onLost;this.onRestored=onRestored;this.onStateChange=onStateChange;this.lost=false;this.awaitingResume=false;this.disposed=false;
  this.loss=()=>{if(this.disposed||this.lost)return;this.lost=true;this.awaitingResume=true;game.paused=true;this.onLost();this.notify();};
  this.restore=()=>{if(this.disposed||!this.lost)return;this.lost=false;game.paused=true;this.onRestored();this.notify();};
  canvas.addEventListener('webglcontextlost',this.loss,{passive:true});canvas.addEventListener('webglcontextrestored',this.restore,{passive:true});
 }
 notify(){this.onStateChange(this.lost?'lost':this.awaitingResume?'restored':'ready');this.game.emit?.('change');}
 update(){if(this.lost){this.game.paused=true;return false;}if(this.awaitingResume&&!this.game.paused){this.awaitingResume=false;this.onStateChange('ready');}return true;}
 resume(){if(this.disposed||this.lost||!this.awaitingResume)return false;this.awaitingResume=false;this.game.paused=false;this.notify();return true;}
 dispose(){if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.loss);this.canvas.removeEventListener('webglcontextrestored',this.restore);}
}

// A small, local-only incident record survives a page restart. No score,
// player name, asset data or external telemetry is written here.
export function recordGraphicsIncident(storage,incident){
 try{const key='forged-alliances.graphics-recovery-v1',text=storage?.getItem(key),old=text&&text.length<16000?JSON.parse(text):[],rows=Array.isArray(old)?old.slice(-7):[];rows.push(incident);storage?.setItem(key,JSON.stringify(rows));return true;}catch{return false;}
}

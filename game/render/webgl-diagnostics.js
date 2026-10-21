// Observational only. Three.js owns context recovery; these bounded counters
// help distinguish GPU context loss from an individual asset-loading failure.
export function observeWebGLContext(canvas,{now=()=>performance.now()}={}){
  let losses=0,restores=0,lost=false,lastEvent=null,disposed=false;
  const record=type=>{
    if(disposed)return;
    const time=now();lastEvent={type,atMs:Number.isFinite(time)?Math.max(0,time):null};
    lost=type==='lost';
    if(lost)losses=Math.min(Number.MAX_SAFE_INTEGER,losses+1);
    else restores=Math.min(Number.MAX_SAFE_INTEGER,restores+1);
  };
  const onLost=()=>record('lost'),onRestored=()=>record('restored');
  canvas.addEventListener('webglcontextlost',onLost,{passive:true});
  canvas.addEventListener('webglcontextrestored',onRestored,{passive:true});
  return {
    snapshot:()=>({lost,losses,restores,lastEvent:lastEvent?{...lastEvent}:null}),
    dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);},
  };
}

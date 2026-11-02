// Queue the next browser frame before entering application code. One failed
// render must not silently remove the application's only animation callback.
export function startFrameLoop({step,onError,requestFrame=callback=>globalThis.requestAnimationFrame(callback)}){
 let active=true;
 function frame(now){
  if(!active)return;
  requestFrame(frame);
  try{step(now);}catch(error){try{onError(error);}catch(reportError){console.error('Could not report the interrupted frame.',reportError);}}
 }
 requestFrame(frame);
 return()=>{active=false;};
}

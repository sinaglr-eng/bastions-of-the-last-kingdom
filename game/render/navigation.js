export function edgePan(pointer,width,height,band=34){
  if(!pointer||pointer.x<0||pointer.y<0||pointer.x>width||pointer.y>height)return {x:0,y:0};
  const axis=(p,max)=>p<band?-(1-p/band):p>max-band?1-(max-p)/band:0;
  return {x:axis(pointer.x,width),y:-axis(pointer.y,height)};
}
export const compassBearing=(camera,target)=>Math.atan2(camera.x-target.x,camera.z-target.z);

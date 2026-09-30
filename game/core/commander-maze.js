// Transcribed from the user's red-line drawing, calibrated to its seven checkpoints.
// The cornered walls curl around a compact central battery and run around CP3 to CP5.
// Tight painted corners are widened 1–2 cells so cardinal routes remain open.
// The central battery is a solid 3 × 3 block: nine adjacent defenders, no gaps.
export const COMMANDER_CORE=Array.from({length:9},(_,i)=>({x:17+i%3,z:17+Math.floor(i/3)}));
export const COMMANDER_STROKES=[
  [[0,18],[3,18],[4,17],[5,18],[13,18],[14,18],[15,16],[16,14],[20,14],[22,16],[22,20],[21,22],[18,22]],
  [[13,18],[13,22]],
  [[20,18],[17,18],[16,19],[16,24],[17,25],[23,25],[24,24],[24,20],[25,19],[25,12],[26,10],[27,9],[28,8],[29,6],[30,5],[31,4],[32,3],[33,4],[34,5],[33,6],[32,7],[31,8],[30,9],[29,10],[28,11],[28,23],[26,25],[25,26],[24,27],[19,27],[18,28],[18,31],[19,32],[18,33],[18,36]],
  [[30,18],[31,18],[32,19],[33,18],[36,18]],
  [[18,0],[18,3]],[[18,5],[18,8]],
];

export function commanderWalls(checkpoints){
  const reserved=new Set(checkpoints.map(p=>`${p.x},${p.z}`)),cells=new Map();
  // Eight-connected digital walls stop cardinal movement at diagonal bends too.
  for(const stroke of COMMANDER_STROKES)for(let i=1;i<stroke.length;i++){
    const [ax,az]=stroke[i-1],[bx,bz]=stroke[i],steps=Math.max(Math.abs(bx-ax),Math.abs(bz-az));
    for(let j=0;j<=steps;j++){
      const x=Math.round(ax+(bx-ax)*j/steps),z=Math.round(az+(bz-az)*j/steps),key=`${x},${z}`;
      if(!reserved.has(key))cells.set(key,{x,z});
    }
  }
  for(const p of COMMANDER_CORE)cells.set(`${p.x},${p.z}`,p);
  return [...cells.values()];
}

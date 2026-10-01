export function playerName(value){
  if(typeof value!=='string')throw new Error('Enter a player name.');
  const name=value.normalize('NFKC').trim().replace(/ +/g,' ');
  if(!name||[...name].length>24||!/[\p{L}\p{N}]/u.test(name)||!/^[\p{L}\p{M}\p{N} ._-]+$/u.test(name))throw new Error('Use 1–24 letters, numbers, spaces, dots, underscores or hyphens.');
  return name;
}
export const validId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function validateSnapshot(s,{families,waveDefinitions,enemyDefinitions}){
  if(!s||!validId(s.id)||!integer(s.sequence,1,100000)||!integer(s.mode,1,waveDefinitions.length)||!['playing','abandoned','lost','won'].includes(s.outcome)||!integer(s.score,0,100000000)||!integer(s.durationMs,0,7*86400000)||!integer(s.health,0,30)||!integer(s.kingdomLevel,1,10000)||!integer(s.gold,0,10000000))throw new Error('Invalid run.');
  if(typeof s.version!=='string'||!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s.version)||!Number.isFinite(s.seed))throw new Error('Invalid edition.');
  const validUnit=t=>t&&Object.hasOwn(families,t.family)&&integer(t.id,1,250)&&integer(t.tier,1,6)&&integer(t.x,0,36)&&integer(t.z,0,36);
  if(!Array.isArray(s.draws)||s.draws.length>250||s.draws.some(t=>!validUnit(t)||!integer(t.wave,1,s.mode))||new Set(s.draws.map(t=>t.id)).size!==s.draws.length)throw new Error('Invalid draws.');
  if(!Array.isArray(s.decisions)||s.decisions.length>750||s.decisions.some(t=>!validUnit(t)||!integer(t.wave,1,s.mode)||!['keep','combine'].includes(t.action)))throw new Error('Invalid decisions.');
  if(!Array.isArray(s.waves)||s.waves.length>s.mode)throw new Error('Invalid waves.');
  let score=0,completed=0;
  for(let i=0;i<s.waves.length;i++){
    const w=s.waves[i],definition=waveDefinitions[i];
    if(w.index!==i+1||w.boss!==!!definition.boss||typeof w.completed!=='boolean'||!integer(w.kills,0,5000)||!integer(w.bossKills,0,w.kills)||!integer(w.leaks,0,5000)||!integer(w.spawned,w.kills+w.leaks,5000)||!integer(w.startHealth,1,30)||!integer(w.endHealth,0,30)||!integer(w.healthLost,0,150000)||!integer(w.durationMs,0,86400000)||!integer(w.routeLength,1,10000)||!integer(w.kingdomLevel,1,10000)||!integer(w.mastery,0,15)||(!w.completed&&i<s.waves.length-1))throw new Error('Invalid wave checkpoint.');
    if(w.bossKills>(w.boss?definition.groups.reduce((n,g)=>n+g.count,0):0)||w.spawned>definition.groups.reduce((n,g)=>n+g.count,0))throw new Error('Invalid enemy count.');
    if(w.completed&&w.kills+w.leaks!==definition.groups.reduce((n,g)=>n+g.count,0))throw new Error('Incomplete completed wave.');
    if(w.completed&&w.endHealth<1)throw new Error('Invalid surviving health.');
    if(w.startHealth!==(i?s.waves[i-1].endHealth:30))throw new Error('Invalid keep health history.');
    if(!Array.isArray(w.towers)||w.towers.length>250||new Set(w.towers.map(t=>t.id)).size!==w.towers.length||w.towers.some(t=>!validUnit(t)||!integer(t.kills,0,w.kills)||!integer(t.hits,0,1000000)||!integer(t.shots,0,1000000)||!Number.isFinite(t.damage)||t.damage<0||t.damage>1e10||!Number.isFinite(t.controlSeconds)||t.controlSeconds<0||t.controlSeconds>1e9||!Number.isFinite(t.supportSeconds)||t.supportSeconds<0||t.supportSeconds>1e9))throw new Error('Invalid defender performance.');
    if(w.towers.reduce((n,t)=>n+t.kills,0)>w.kills)throw new Error('Invalid defender kill total.');
    if(!w.effects||Object.keys(w.effects).length>40||Object.entries(w.effects).some(([k,v])=>!/^[a-zA-Z]{1,32}$/.test(k)||!Number.isFinite(v)||v<0||v>1e9))throw new Error('Invalid effects.');
    if(!w.enemyTypes||Object.keys(w.enemyTypes).length>30||Object.entries(w.enemyTypes).some(([key,v])=>!definition.groups.some(g=>g.type===key)||!integer(v.spawned,0,5000)||!integer(v.kills,0,v.spawned)||!integer(v.leaks,0,v.spawned-v.kills)))throw new Error('Invalid warband.');
    const types=Object.entries(w.enemyTypes);
    if(types.some(([key,v])=>v.spawned>definition.groups.filter(g=>g.type===key).reduce((n,g)=>n+g.count,0)))throw new Error('Invalid per-type enemy count.');
    if(types.reduce((n,[,v])=>n+v.spawned,0)!==w.spawned||types.reduce((n,[,v])=>n+v.kills,0)!==w.kills||types.reduce((n,[,v])=>n+v.leaks,0)!==w.leaks||types.reduce((n,[key,v])=>n+(enemyDefinitions?.[key]?.boss?v.kills:0),0)!==w.bossKills)throw new Error('Invalid warband totals.');
    score+=w.index*((w.kills-w.bossKills)*10+w.bossKills*500);if(w.completed){completed++;score+=w.index*(100+(w.boss?200:0));}
  }
  if(s.waves.length&&s.health!==s.waves.at(-1).endHealth)throw new Error('Invalid final keep health.');
  if(s.wavesSurvived!==completed||s.score!==score||(s.outcome==='won'&&(completed!==s.mode||s.health<1))||(s.outcome==='lost'&&s.health!==0))throw new Error('Result does not match the wave history.');
  const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]]));
  const clean=pick(s,['id','version','mode','seed','sequence','outcome','score','wavesSurvived','durationMs','kingdomLevel','health','gold']);
  clean.draws=s.draws.map(t=>pick(t,['id','family','tier','x','z','wave']));clean.decisions=s.decisions.map(t=>pick(t,['id','family','tier','x','z','wave','action']));
  clean.waves=s.waves.map(w=>({...pick(w,['index','boss','completed','startHealth','endHealth','healthLost','kills','bossKills','leaks','spawned','durationMs','routeLength','kingdomLevel','mastery']),enemyTypes:Object.fromEntries(Object.entries(w.enemyTypes).map(([key,v])=>[key,pick(v,['spawned','kills','leaks'])])),effects:{...w.effects},towers:w.towers.map(t=>pick(t,['id','family','tier','x','z','damage','hits','shots','kills','controlSeconds','supportSeconds']))}));
  return clean;
}

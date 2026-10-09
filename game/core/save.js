import {GAME_VERSION} from '../release.js';

const KEY='bastions.profile.v1',SCORES_KEY='bastions.scores.v1';
const versionOf=value=>typeof value==='string'&&/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)?value:null;
const scoreOf=value=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const read=key=>{try{return object(JSON.parse(localStorage.getItem(key)||'{}'));}catch{return {};}};
function mergeBestScores(...lists){
  const rows=new Map();
  for(const row of lists.flat())if(row&&typeof row==='object'&&Number.isFinite(row.score)&&row.score>=0){
    const version=versionOf(row.version),mode=[10,50].includes(row.mode)?row.mode:null,key=JSON.stringify([version,mode]),existing=rows.get(key);
    if(!existing||row.score>existing.score)rows.set(key,{...row,version,mode,score:scoreOf(row.score)});
  }
  return [...rows.values()];
}
function mergeRunHistory(...lists){
  const rows=new Map();
  for(const row of lists.flat())if(row&&typeof row==='object'&&typeof row.id==='string'&&row.id&&Number.isFinite(row.score)&&row.score>=0){
    const existing=rows.get(row.id);
    if(!existing)rows.set(row.id,{...row,version:versionOf(row.version),score:scoreOf(row.score)});
    else if(existing.version===versionOf(row.version)&&!['won','lost'].includes(existing.outcome)&&row.score>=existing.score)rows.set(row.id,{...existing,...row,version:existing.version,score:scoreOf(row.score)});
  }
  return [...rows.values()];
}
function scores(raw,archive){
  const runHistory=mergeRunHistory(archive.runHistory||[],raw.runHistory||[]);
  const bestScores=mergeBestScores(archive.bestScores||[],raw.bestScores||[],runHistory);
  const bestScore=Math.max(scoreOf(raw.bestScore),scoreOf(archive.bestScore),...bestScores.map(row=>row.score));
  // A scalar from an older client has no trustworthy version or campaign.
  if(bestScore>0&&!bestScores.some(row=>row.score===bestScore))bestScores.push({version:null,mode:null,score:bestScore});
  return {bestScore,bestScores,runHistory};
}
export function loadProfile() {
  const raw=read(KEY);
  return {...raw,discoveries:Array.isArray(raw.discoveries)?raw.discoveries.filter(x=>typeof x==='string'):[],muted:raw.muted===true,bestWave:scoreOf(raw.bestWave),...scores(raw,read(SCORES_KEY)),wins:scoreOf(raw.wins),tutorial:raw.tutorial!==false,tutorialDecision:['accepted','skipped','complete'].includes(raw.tutorialDecision)?raw.tutorialDecision:null};
}
export function saveProfile(profile){
  const archive=read(SCORES_KEY),retained=scores(profile,scores(read(KEY),archive));Object.assign(profile,retained);
  // A separate stable archive survives an older tab rewriting the old profile.
  let archived=false,saved=false;
  try{localStorage.setItem(SCORES_KEY,JSON.stringify({...archive,schemaVersion:1,...retained}));archived=true;}catch{}
  try{localStorage.setItem(KEY,JSON.stringify(profile));saved=true;}catch{}
  return archived&&saved;
}
export function recordRunResult(profile,game,{id,version=GAME_VERSION,outcome}={}){
  if(typeof id!=='string'||!id||!versionOf(version)||![10,50].includes(game.waveLimit))return null;
  const previous=(profile.runHistory||[]).find(row=>row.id===id);
  if(previous&&previous.version!==version)return null;
  const result={id,version,mode:game.waveLimit,score:scoreOf(game.score),wavesSurvived:Math.max(0,Math.min(game.waveLimit,game.round-(['won','reward'].includes(game.phase)?0:1))),outcome:outcome||(['won','lost'].includes(game.phase)?game.phase:'abandoned'),finishedAt:Date.now(),...(Number.isFinite(game.elapsedSeconds)&&game.elapsedSeconds>=0?{durationSeconds:game.elapsedSeconds}:{})};
  profile.runHistory=mergeRunHistory(profile.runHistory||[],[result]);
  const accepted=profile.runHistory.find(row=>row.id===id);
  profile.bestScores=mergeBestScores(profile.bestScores||[],[accepted]);profile.bestScore=Math.max(scoreOf(profile.bestScore),accepted.score);
  return accepted;
}

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
  const excludedRuns=[...new Set([...(archive.excludedRuns||[]),...(raw.excludedRuns||[])])],excluded=new Set(excludedRuns);
  const runHistory=mergeRunHistory(archive.runHistory||[],raw.runHistory||[]).filter(row=>!excluded.has(row.id));
  const bestScores=mergeBestScores((archive.bestScores||[]).filter(row=>!excluded.has(row.id)),(raw.bestScores||[]).filter(row=>!excluded.has(row.id)),runHistory);
  const aware=value=>excludedRuns.every(id=>(value.excludedRuns||[]).includes(id));
  const bestScore=Math.max(aware(raw)?scoreOf(raw.bestScore):0,aware(archive)?scoreOf(archive.bestScore):0,...bestScores.map(row=>row.score));
  // A scalar from an older client has no trustworthy version or campaign.
  if(bestScore>0&&!bestScores.some(row=>row.score===bestScore))bestScores.push({version:null,mode:null,score:bestScore});
  return {bestScore,bestScores,runHistory,...(excludedRuns.length?{excludedRuns}:{})};
}
const stringList=value=>Array.isArray(value)?[...new Set(value.filter(x=>typeof x==='string'))]:[];
function legacyProgress(profile){
  const history=profile.runHistory||[],awards=new Set(history.flatMap(row=>stringList(row.discoveryAwards)));
  return {wins:Math.max(0,scoreOf(profile.wins)-history.filter(row=>row.outcome==='won').length),bestWave:scoreOf(profile.bestWave),discoveries:stringList(profile.discoveries).filter(id=>!awards.has(id))};
}
function progress(profile,archive,retained){
  const progressLedger=archive.progressLedger||profile.progressLedger||legacyProgress(profile);
  if(!retained.excludedRuns?.length)return {progressLedger};
  return {progressLedger,wins:scoreOf(progressLedger.wins)+retained.runHistory.filter(row=>row.outcome==='won').length,bestWave:Math.max(scoreOf(progressLedger.bestWave),0,...retained.runHistory.map(row=>scoreOf(row.wavesSurvived))),discoveries:[...new Set([...stringList(progressLedger.discoveries),...retained.runHistory.flatMap(row=>stringList(row.discoveryAwards))])]};
}
export function loadProfile() {
  const raw=read(KEY),archive=read(SCORES_KEY),retained=scores(raw,archive);
  return {...raw,discoveries:stringList(raw.discoveries),muted:raw.muted===true,bestWave:scoreOf(raw.bestWave),...retained,wins:scoreOf(raw.wins),...progress(raw,archive,retained),tutorial:raw.tutorial!==false,tutorialDecision:['accepted','skipped','complete'].includes(raw.tutorialDecision)?raw.tutorialDecision:null};
}
export function saveProfile(profile){
  const archive=read(SCORES_KEY),stored=read(KEY),retained=scores(profile,scores(stored,archive));
  // A pre-exclusion tab can contribute legitimate attributed run records, but
  // cannot restore excluded awards or overwrite more recent preferences.
  if(retained.excludedRuns?.some(id=>!(profile.excludedRuns||[]).includes(id)))Object.assign(profile,stored);
  Object.assign(profile,retained,progress(profile,archive,retained));
  // A separate stable archive survives an older tab rewriting the old profile.
  let archived=false,saved=false;
  try{localStorage.setItem(SCORES_KEY,JSON.stringify({...archive,schemaVersion:2,...retained,progressLedger:profile.progressLedger}));archived=true;}catch{}
  try{localStorage.setItem(KEY,JSON.stringify(profile));saved=true;}catch{}
  return archived&&saved;
}
export function recordRunResult(profile,game,{id,version=GAME_VERSION,outcome,discoveryAwards=game.earnedDiscoveries}={}){
  if(game.developerMode||(profile.excludedRuns||[]).includes(id))return null;
  if(typeof id!=='string'||!id||!versionOf(version)||![10,50].includes(game.waveLimit))return null;
  const previous=(profile.runHistory||[]).find(row=>row.id===id);
  if(previous&&previous.version!==version)return null;
  const result={id,version,mode:game.waveLimit,score:scoreOf(game.score),wavesSurvived:Math.max(0,Math.min(game.waveLimit,game.round-(['won','reward'].includes(game.phase)?0:1))),outcome:outcome||(['won','lost'].includes(game.phase)?game.phase:'abandoned'),finishedAt:Date.now(),discoveryAwards:stringList(discoveryAwards?Array.from(discoveryAwards):[]),...(Number.isFinite(game.elapsedSeconds)&&game.elapsedSeconds>=0?{durationSeconds:game.elapsedSeconds}:{})};
  profile.runHistory=mergeRunHistory(profile.runHistory||[],[result]);
  const accepted=profile.runHistory.find(row=>row.id===id);
  profile.bestScores=mergeBestScores(profile.bestScores||[],[accepted]);profile.bestScore=Math.max(scoreOf(profile.bestScore),accepted.score);
  return accepted;
}
export function excludeRunResult(profile,id,{baseline={}}={}){
  if(!id)return;
  const archive=read(SCORES_KEY),stored=read(KEY),excludedRuns=[...new Set([...(archive.excludedRuns||[]),...(stored.excludedRuns||[]),...(profile.excludedRuns||[]),id])],excluded=new Set(excludedRuns);
  const runHistory=mergeRunHistory(archive.runHistory||[],stored.runHistory||[],profile.runHistory||[]).filter(row=>!excluded.has(row.id));
  const bestScores=mergeBestScores(...[archive.bestScores||[],stored.bestScores||[],profile.bestScores||[],baseline.bestScores||[],runHistory].map(rows=>rows.filter(row=>!excluded.has(row.id))));
  const bestScore=Math.max(scoreOf(baseline.bestScore),0,...bestScores.map(row=>row.score));
  const retained={bestScore,bestScores,runHistory,excludedRuns},progressLedger=baseline.progressLedger||archive.progressLedger||legacyProgress(baseline);
  Object.assign(profile,stored,retained,progress(profile,{progressLedger},retained));
  // Only the excluded run's attributed awards disappear; concurrent legitimate
  // wins, independently earned discoveries and the latest preferences remain.
  try{localStorage.setItem(SCORES_KEY,JSON.stringify({...archive,schemaVersion:2,...retained,progressLedger}));}catch{}
  try{localStorage.setItem(KEY,JSON.stringify(profile));}catch{}
}

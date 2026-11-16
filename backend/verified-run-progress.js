import {BOSS_XP} from '../game/core/account-progression.js';
const parse=(s,fallback)=>{try{return JSON.parse(s);}catch{return fallback;}};
export function verifiedRunProgress(run){
 const summary=parse(run.progress_json,{}),snapshot=parse(run.snapshot_json,{}),graph=snapshot.graph;
 const root=graph?.nodes?.[graph?.root?.r]?.value||{},node=ref=>graph?.nodes?.[ref?.r]?.value;
 const game=node(root.game)||{},progress=node(root.progress)||{},bosses=Array.isArray(summary.bosses)?summary.bosses:node(progress.bosses)||[],champions=[...(Array.isArray(summary.champions)?summary.champions:[]),...(Array.isArray(node(progress.champions))?node(progress.champions):[])],streaks=[summary.streakBest,progress.streakBest].filter(n=>Number.isSafeInteger(n)&&n>=0);
 return {epoch:game.progressionEpoch||'initial',waves:Math.max(0,Number.isSafeInteger(run.highest_wave)?run.highest_wave:0),campaign:summary.campaign===true||progress.campaign===true,bosses:[...new Set(bosses.filter(id=>Object.hasOwn(BOSS_XP,id)))],bossWaves:summary.bossWaves||node(progress.bossWaves)||{},champions:[...new Set(champions.filter(id=>typeof id==='string'))],streakBest:Math.max(0,...streaks),excluded:['developer','reset'].includes(run.outcome)||game.developerMode===true,missingBossEvidence:!Array.isArray(summary.bosses)&&!Array.isArray(node(progress.bosses))&&(summary.bossKills||0)>0};
}

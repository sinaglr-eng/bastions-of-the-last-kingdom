import {formatRunDuration} from './run-clock.js';
import {icon} from './icons.js';
import {siteUrl} from '../game/site-url.js';
import {OUTCOME_ART_SCENES,selectOutcomeArt} from './outcome-art.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const count=value=>Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
const number=value=>count(value).toLocaleString('en-US');
const enemyFact=(enemy,game)=>enemy?{id:enemy.id,type:enemy.type,name:enemy.name||game.data?.enemies?.[enemy.type]?.name||'Invader',flying:!!enemy.flying,boss:!!enemy.boss,wave:game.round}:null;

// A run-local UI observer uses existing events only. It neither adds telemetry
// nor calls the statistics snapshot method, which advances its sequence.
export class RunResultFacts{
  constructor(){this.completedWaves=new Set();this.waves=new Map();this.lastSpawn=null;this.lastLeak=null;this.previousHealth=null;this.ended=false;}
  event(type,payload={},game){
    if(!game||this.ended&&type!=='wave')return;
    if(type==='wave'){
      this.ended=false;this.lastSpawn=null;this.lastLeak=null;
      this.waves.set(game.round,{index:game.round,leaks:0,healthLost:0,healthKnown:Number.isFinite(game.lives),leakIds:new Set()});
    }
    if(type==='spawn')this.lastSpawn=enemyFact(payload.enemy,game);
    if(type==='leak'&&payload.enemy){
      let wave=this.waves.get(game.round);
      if(!wave){wave={index:game.round,leaks:0,healthLost:0,healthKnown:false,leakIds:new Set()};this.waves.set(game.round,wave);}
      const id=payload.enemy.id;
      if(!wave.leakIds.has(id)){
        wave.leakIds.add(id);wave.leaks++;
        const healthLost=Number.isFinite(this.previousHealth)&&Number.isFinite(game.lives)?Math.max(0,this.previousHealth-game.lives):null;
        if(healthLost===null)wave.healthKnown=false;else wave.healthLost+=healthLost;
        this.lastLeak={...enemyFact(payload.enemy,game),healthLost};
      }
    }
    if(type==='wave-complete'&&Number.isSafeInteger(payload.round))this.completedWaves.add(payload.round);
    this.previousHealth=Number.isFinite(game.lives)?game.lives:null;
    if(type==='won'||type==='lost')this.ended=true;
  }
}

export function runResultModel(game,{tracker=null,facts=null}={}){
  const ended=['won','lost'].includes(game.phase),won=game.phase==='won',wave=count(game.round),limit=count(game.waveLimit);
  const rows=[...(tracker?.waves||[]),...(tracker?.current?[tracker.current]:[])],lastWave=rows.findLast(row=>row.index===wave),observed=facts?.waves.get(wave);
  // Recorded IDs also describe Sandbox jumps/replays, where the current round
  // cannot establish which earlier waves were actually completed.
  const recorded=facts?.completedWaves instanceof Set||Array.isArray(tracker?.waves);
  const completedIds=new Set([...(facts?.completedWaves instanceof Set?facts.completedWaves:[]),...rows.filter(row=>row.completed===true).map(row=>row.index)].filter(index=>Number.isSafeInteger(index)&&index>0&&index<=limit));
  const completedWaves=ended?recorded?completedIds.size:Math.min(limit,won?wave:Math.max(0,wave-1)):null;
  const leaks=observed?.leaks??(Number.isFinite(lastWave?.leaks)?count(lastWave.leaks):null);
  const healthLost=observed?(observed.healthKnown?observed.healthLost:null):Number.isFinite(lastWave?.startHealth)&&Number.isFinite(lastWave?.endHealth)?Math.max(0,lastWave.startHealth-lastWave.endHealth):null;
  const lastLeak=facts?.lastLeak?.wave===wave?{...facts.lastLeak}:null,lastThreat=lastLeak|| (facts?.lastSpawn?.wave===wave?{...facts.lastSpawn}:null);
  return {ended,won,outcome:game.phase,wave,waveLimit:limit,completedWaves,defeatWave:game.phase==='lost'?wave:null,score:count(game.score),kills:count(game.kills),elapsedSeconds:Number.isFinite(game.elapsedSeconds)&&game.elapsedSeconds>=0?game.elapsedSeconds:null,totalLeaks:Number.isFinite(game.leaks)?count(game.leaks):null,finalWaveName:game.wave?.name||null,finalWaveLeaks:leaks,finalWaveHealthLost:healthLost,lastLeak,lastThreat,developerMode:!!game.developerMode,art:selectOutcomeArt(game)};
}

function factsMarkup(model){
  const detail=model.finalWaveLeaks===null?'Leak detail was not recorded for this wave.':`${number(model.finalWaveLeaks)} ${model.finalWaveLeaks===1?'invader reached':'invaders reached'} the keep${model.finalWaveHealthLost===null?'':` · ${number(model.finalWaveHealthLost)} keep health lost`}.`;
  const last=model.lastLeak?`Last leak: ${model.lastLeak.name}${model.lastLeak.flying?' · Flying':' · Ground'}.`:model.lastThreat?`Last recorded invader: ${model.lastThreat.name}${model.lastThreat.flying?' · Flying':' · Ground'}.`:'Last invader detail is unavailable.';
  return `<section class="run-result-facts" aria-label="Recorded final wave facts"><h3>Final wave${model.finalWaveName?` · ${escape(model.finalWaveName)}`:''}</h3><p>${escape(detail)}</p><p>${escape(last)}</p><small>Recorded events describe this run; they do not establish why a defense failed.</small></section>`;
}

function outcomeArtMarkup(model){
  const won=model.won;
  const copy=won?'The kingdom’s defenders raise their banners in triumph.':'The last human keep has fallen to the orc horde.';
  const art=model.art||OUTCOME_ART_SCENES[won?'won':'lost'][0];
  return `<p class="run-result-outcome-copy">${copy}</p><img class="run-result-art ${won?'run-result-victory-art':'run-result-defeat-art'}" data-outcome-art="${art.id}" src="${siteUrl(art.path)}" alt="${escape(art.alt)}">`;
}

export function runResultMarkup(model,{scoreVersionMarkup='',leaderboardMarkup=''}={}){
  if(!model.ended)return '';
  return `<section class="result run-result ${model.won?'is-victory':'is-defeat'}" aria-label="Local run result"><div class="run-result-symbol">${icon(model.won?'crown':'shield')}</div><div class="eyebrow">Run ended · ${model.won?'Victory':'Defeat'}</div><h2>${model.won?'The kingdom endures.':'The last banners fall.'}</h2>${outcomeArtMarkup(model)}<div class="run-result-progress"><strong>${number(model.completedWaves)} <span>waves completed</span></strong><p>${model.won?model.completedWaves===model.waveLimit?`Campaign completed · ${number(model.waveLimit)} waves`:`Final wave completed · Wave ${number(model.wave)}`:`Defeated on wave ${number(model.defeatWave)}`}</p></div><div class="result-stats run-result-stats"><div><strong>${number(model.score)}</strong><small>Score</small></div><div><strong>${number(model.kills)}</strong><small>Invaders defeated</small></div><div><strong>${model.elapsedSeconds===null?'Not recorded':formatRunDuration(model.elapsedSeconds)}</strong><small>Elapsed time</small></div>${scoreVersionMarkup}</div>${factsMarkup(model)}<div class="run-result-actions"><button type="button" class="primary-button" data-action="restart">${icon('reset')} Play again</button><button type="button" class="text-button" data-action="result-review">${icon('target')} Inspect battlefield</button></div>${model.developerMode?'<p class="developer-mode-indicator">Developer Mode — this run is excluded from scores and statistics.</p>':leaderboardMarkup?`<details class="run-result-online"><summary>Online scores <span>Optional</span></summary><p class="run-result-online-note">Your local result and Play again remain available if online scores cannot load.</p>${leaderboardMarkup}</details>`:''}</section>`;
}

export function endedRunReviewMarkup(model){
  if(!model.ended)return '';
  return `<section class="ended-run-review" aria-label="Ended battlefield review"><div class="eyebrow">Battlefield review · Run ended</div><h2>${model.won?(model.completedWaves===model.waveLimit?'Campaign completed':'Final wave completed'):`Defeated on wave ${number(model.defeatWave)}`}</h2><p>${number(model.completedWaves)} waves completed · ${number(model.score)} score.</p><p class="ended-run-read-only">Read-only battlefield. Placement and build actions are disabled; inspect the final defenders or invaders that remain.</p><div class="run-result-actions"><button type="button" class="primary-button" data-action="restart">Play again</button><button type="button" class="text-button" data-action="result-return">Return to result</button></div></section>`;
}

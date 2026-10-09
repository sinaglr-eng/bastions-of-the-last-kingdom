import {playerName} from '../backend/validation.js';
import {GAME_VERSION} from '../game/release.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function resultScoreVersionMarkup(profile,{version=GAME_VERSION}={}){
  const records=(profile.bestScores||[]).filter(row=>row.score===profile.bestScore),versions=[...new Set(records.map(row=>row.version||'Version not recorded'))];
  const best=versions.length?versions.join(', '):'Version not recorded';
  return `<div class="result-version"><strong>${escape(version)}</strong><small>Game version</small><span class="result-best-version">Best score version: ${escape(best)}</span></div>`;
}
export function resultLeaderboardMarkup(){return '<section class="result-leaderboard" aria-label="Online leaderboard"><h3>Top 10 commanders</h3><p class="leaderboard-caption">Scores from all game versions are retained. Campaign lengths have separate standings.</p><p class="leaderboard-status" role="status" aria-live="polite">Loading scores…</p><div class="leaderboard-rows"></div><form class="score-form"><label for="score-name">Save this score under your name</label><div><input id="score-name" name="name" maxlength="24" autocomplete="nickname" placeholder="Your name" required><button class="primary-button" type="submit">Save score</button></div><small>Letters and numbers, spaces, dots, underscores and hyphens · up to 24 characters.</small><p class="score-status" role="status" aria-live="polite"></p></form></section>';}
export function renderLeaderboard(container,result){
  const list=container.querySelector('.leaderboard-rows');list.replaceChildren();
  if(!result.top.length){const empty=document.createElement('p');empty.textContent='No scores yet. Be the first to raise your banner.';list.append(empty);}
  const table=document.createElement('table');const head=document.createElement('thead'),heading=document.createElement('tr');for(const text of ['Rank','Commander','Score','Waves','Version']){const th=document.createElement('th');th.textContent=text;heading.append(th);}head.append(heading);table.append(head);const body=document.createElement('tbody');
  const add=row=>{const tr=document.createElement('tr');if(row.id===result.current?.id)tr.className='current-player';const version=row.version||(result.version&&result.version!=='all'?result.version:'Not recorded');for(const value of [row.rank,row.name,row.score.toLocaleString('en-US'),row.wavesSurvived,version]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}body.append(tr);};
  result.top.forEach(add);if(result.current&&result.current.rank>10){const gap=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.textContent='⋯';gap.append(cell);body.append(gap);add(result.current);}table.append(body);if(result.top.length||result.current)list.append(table);
  const caption=container.querySelector('.leaderboard-caption');if(caption)caption.textContent=result.olderService?'This service currently shows only this game version. Earlier scores remain stored.':result.version==='all'?`All game versions${result.mode?` · ${result.mode}-wave campaign`:''}. Earlier scores are retained.`:`Game version ${result.version||'not recorded'}. Earlier scores are retained.`;
  container.querySelector('.leaderboard-status').textContent=result.current?`Your rank: ${result.current.rank}.`:'Save your score to see your rank.';
}
export async function connectResultLeaderboard(container,client){
  const status=container.querySelector('.leaderboard-status'),form=container.querySelector('form'),input=form.querySelector('input'),message=form.querySelector('.score-status'),button=form.querySelector('button');
  let saving=false,saved=false,initialResult=null,initialError=null;
  const showInitial=()=>{if(saving||saved)return;if(initialResult)renderLeaderboard(container,initialResult);else if(initialError)status.textContent=initialError;};
  // Register immediately: a slow initial GET must never allow native form navigation.
  form.addEventListener('submit',async event=>{event.preventDefault();if(saving||saved)return;try{const name=playerName(input.value);input.value=name;saving=true;button.disabled=true;message.textContent='Saving your score…';const result=await client.saveScore(name);saved=true;renderLeaderboard(container,result);message.textContent=`Score saved. You are ranked ${result.current.rank}.`;input.disabled=true;button.textContent='Saved';}catch(error){message.textContent=error.message;button.disabled=false;}finally{saving=false;showInitial();}});
  try{initialResult=await client.leaderboard();}catch(error){initialError=error.message;}showInitial();
}

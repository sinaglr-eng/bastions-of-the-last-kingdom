import {factionName} from '../game/core/factions.js';
import {playerName} from '../backend/validation.js';
import {GAME_VERSION} from '../game/release.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function resultScoreVersionMarkup(profile,{version=GAME_VERSION,factionId}={}){
  const cohort=(profile.bestScores||[]).filter(row=>factionId===undefined||(row.factionId??null)===(factionId??null)),maximum=Math.max(0,...cohort.map(row=>row.score));const records=cohort.filter(row=>row.score===(factionId===undefined?profile.bestScore:maximum)),versions=[...new Set(records.map(row=>row.version||'Version not recorded'))];
  const best=versions.length?versions.join(', '):'Version not recorded';
  return `<div class="result-version"><strong>${escape(version)}</strong><small>Game version</small><span class="result-best-version">Best score version: ${escape(best)}</span></div>`;
}
const validVersion=version=>typeof version==='string'&&/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(version);
const orderedVersions=versions=>[...new Set(versions.filter(validVersion))].sort((a,b)=>{const left=a.split('.').map(Number),right=b.split('.').map(Number);return right[0]-left[0]||right[1]-left[1]||right[2]-left[2];});
function singleVersionResult(result,expected=result?.version){
  if(!validVersion(expected)||result?.version!==expected||!Array.isArray(result.top)||[...result.top,...(result.current?[result.current]:[])].some(row=>row.version&&row.version!==expected))throw new Error('Scores for this version could not be verified. Please try again.');
  return result;
}
export function resultLeaderboardMarkup({version=GAME_VERSION}={}){
  const edition=validVersion(version)?version:GAME_VERSION;
  return `<section class="result-leaderboard" aria-label="Online leaderboard"><form class="score-form"><label for="score-name">Save this score under your name</label><div><input id="score-name" name="name" maxlength="24" autocomplete="nickname" placeholder="Your name" required><button class="primary-button" type="submit">Save score</button></div><small>Letters and numbers, spaces, dots, underscores and hyphens · up to 24 characters.</small><p class="score-status" role="status" aria-live="polite"></p></form><h3>Top 10 commanders</h3><p class="leaderboard-caption">Scores are retained for every game version. Compare commanders within the same version and campaign.</p><nav class="leaderboard-versions" aria-label="Score versions"><button type="button" aria-pressed="true" data-score-version="${escape(edition)}">${escape(edition)}</button></nav><p class="leaderboard-status" role="status" aria-live="polite">Loading version ${escape(edition)}…</p><div class="leaderboard-rows" aria-label="Selected version standings"></div></section>`;
}
export function renderLeaderboard(container,result){
  singleVersionResult(result);
  const list=container.querySelector('.leaderboard-rows');list.replaceChildren();
  if(!result.top.length){const empty=document.createElement('p');empty.textContent='No scores yet for this version. Be the first to raise your banner.';list.append(empty);}
  const table=document.createElement('table');const head=document.createElement('thead'),heading=document.createElement('tr');for(const text of ['Rank','Commander','Score','Waves','Version']){const th=document.createElement('th');th.textContent=text;heading.append(th);}head.append(heading);table.append(head);const body=document.createElement('tbody');
  const add=row=>{const tr=document.createElement('tr');if(row.id===result.current?.id)tr.className='current-player';for(const value of [row.rank,row.name,row.score.toLocaleString('en-US'),row.wavesSurvived,row.version||result.version]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}body.append(tr);};
  result.top.forEach(add);if(result.current&&result.current.rank>10){const gap=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=5;cell.textContent='⋯';gap.append(cell);body.append(gap);add(result.current);}table.append(body);if(result.top.length||result.current)list.append(table);
  const caption=container.querySelector('.leaderboard-caption');if(caption)caption.textContent=`Version ${result.version}${result.mode?` · ${result.mode}-wave campaign`:''}. Scores from earlier versions remain stored.`;
  container.querySelector('.leaderboard-status').textContent=result.current?`Your rank in ${result.version}: ${result.current.rank}.`:`No saved score for this run in version ${result.version}.`;
}
export async function connectResultLeaderboard(container,client){
  const status=container.querySelector('.leaderboard-status'),form=container.querySelector('form'),input=form.querySelector('input'),message=form.querySelector('.score-status'),button=form.querySelector('button'),tabs=container.querySelector('.leaderboard-versions'),rows=container.querySelector('.leaderboard-rows');
  const runVersion=validVersion(client.tracker?.version)?client.tracker.version:GAME_VERSION;
  let selected=runVersion,versions=[runVersion],request=0,saving=false,saved=false,deferred=null;
  let legacyVersions=[];const paintTabs=()=>{
    if(!tabs)return;const focused=tabs.contains?.(document.activeElement)?document.activeElement?.dataset?.scoreVersion:null;tabs.replaceChildren();if(client.tracker?.factionId){const cohort=document.createElement('button');cohort.type='button';cohort.textContent=client.legacyStandings?'Back to '+factionName(client.tracker?.factionId):'Legacy records · Faction not recorded';cohort.addEventListener('click',()=>{client.legacyStandings=!client.legacyStandings;versions=client.legacyStandings?legacyVersions:[runVersion];selected=versions[0]||runVersion;versions=orderedVersions([...versions,selected]);void loadVersion(selected);});tabs.append(cohort);}
    for(const version of versions){const tab=document.createElement('button');tab.type='button';tab.textContent=version;tab.dataset.scoreVersion=version;tab.setAttribute('aria-pressed',String(version===selected));tab.addEventListener('click',()=>loadVersion(version));tabs.append(tab);if(version===focused)tab.focus();}
  };
  const show=(result,version)=>{singleVersionResult(result,version);legacyVersions=Array.isArray(result.legacyVersions)?result.legacyVersions:legacyVersions;versions=orderedVersions([...(Array.isArray(result.versions)?result.versions:[]),version,...(!client.legacyStandings?[runVersion]:[])]);renderLeaderboard(container,result);paintTabs();};
  const showDeferred=()=>{if(!deferred||deferred.request!==request)return;const pending=deferred;deferred=null;if(pending.error)status.textContent=pending.error;else try{show(pending.result,pending.version);}catch(error){status.textContent=error.message;}};
  const loadVersion=async version=>{
    if(!versions.includes(version))return;selected=version;const current=++request;deferred=null;rows.replaceChildren();status.textContent=`Loading version ${version}…`;paintTabs();
    try{const result=await client.leaderboard(version);if(current!==request)return;if(saving){deferred={request:current,result,version};return;}show(result,version);}
    catch(error){if(current!==request)return;if(saving)deferred={request:current,error:error.message};else status.textContent=error.message;}
  };
  // Register immediately so slow version loading cannot cause native form navigation.
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving||saved)return;
    try{const name=playerName(input.value);input.value=name;saving=true;button.disabled=true;message.textContent='Saving your score…';const result=await client.saveScore(name);client.legacyStandings=false;singleVersionResult(result,runVersion);selected=runVersion;++request;deferred=null;show(result,runVersion);saved=true;message.textContent=result.current?`Score saved. Your rank in ${runVersion}: ${result.current.rank}.`:`Score saved in version ${runVersion}.`;input.disabled=true;button.textContent='Saved';}
    catch(error){message.textContent=error.message;button.disabled=false;}
    finally{saving=false;if(!saved)showDeferred();}
  });
  await loadVersion(runVersion);
}

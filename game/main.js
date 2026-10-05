import '../ui/style.css';
import '../ui/tower-dps.css';
import '../ui/selected-enemy.css';
import '../ui/run-clock.css';
import '../ui/command-points.css';
import '../ui/wave-preview.css';
import {WavePreviewFlow,previewDisclosureOpen} from '../ui/wave-preview-flow.js';
import {wavePreviewMarkup,wavePreviewGateMarkup} from '../ui/wave-preview.js';
import {WaveThreatAnalyzer} from './core/wave-threats.js';
import {ArmyReadiness} from './core/army-readiness.js';
import {commandPointsMarkup} from '../ui/command-points.js';
import {formatRunDuration} from '../ui/run-clock.js';
import {selectedEnemyMarkup,updateSelectedEnemyPanel} from '../ui/selected-enemy.js';
import {updateTowerDpsPanel} from '../ui/tower-dps.js';
import {TowerDpsTracker} from './core/tower-dps.js';
import '../ui/tutorial.css';
import {GuidedTutorial} from '../ui/tutorial.js';
import '../ui/leaderboard.css';
import {resultLeaderboardMarkup,connectResultLeaderboard} from '../ui/leaderboard.js';
import {StatisticsClient} from './core/statistics-client.js';
import balance from '../data/balance.json';
import historicalTowers from '../data/towers.json';
import historicalEnemies from '../data/enemies.json';
import historicalWaves from '../data/waves.json';
import historicalRecipes from '../data/recipes.json';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from './core/campaign-roster.js';
import {Game} from './core/game.js';
import {prepareWavePreviewReview,prepareCommandPointsReview,prepareConstructionTimingReview,prepareEnemyInspectionReview,prepareBattleReview,prepareSpellReview,prepareSupportReview,prepareEnemyReview,prepareRecipeMarkerReview,prepareSecretDraftReview,prepareDefenseReview,prepareConcealmentReview,prepareMergeReview} from './core/debug-review.js';
import {towerStats} from './core/math.js';
import {recipeProgress,recipesUsing,recipeFamily,recipeLabel,rankLabel} from './core/recipes.js';
import {currentWarbandInfo,bossHealth,builtTowerCount} from './core/warband-info.js';
import {currentWarbandContents,updateCurrentWarbandPanel} from '../ui/current-warband.js';
import {cellKey} from './core/grid.js';
import {loadProfile,saveProfile} from './core/save.js';
import {Battlefield,makeThumbnails} from './render/world.js';
import {AudioManager} from './audio/audio.js';
import {rankColor} from './render/ranks.js';
import {icon} from '../ui/icons.js';
import {ROMAN,abilityLines,defenderGuide,baseAttackDps,formatTowerNumber,damageTypeName,championRecipeCard,recipeIngredientTree,recipeProgressLegend} from '../ui/grimoire.js';
import {championClassification} from './render/champion-classification.js';
import {siteUrl} from './site-url.js';
import {defenderCode} from './core/unit-label.js';
import {PointerTapGesture} from './render/touch-input.js';
import {DraftCardActivation,drawnTower,keepDrawKeeper,mergeTowerFromBadge} from '../ui/draft-input.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';
import {masteryPanelMarkup} from '../ui/mastery-panel.js';
import {selectedSupportMarkup,supportEffectsMarkup,supportMapLegendMarkup} from '../ui/support-guide.js';
import {DefenderRankPreview,defenderRankPreviewMarkup} from '../ui/defender-rank-preview.js';
import {enemyTraitsMarkup} from '../ui/enemy-trait-symbols.js';
import {warbandCardsMarkup} from '../ui/warband-cards.js';

const towers=campaignTowers(historicalTowers),recipes=campaignRecipes(historicalRecipes),enemies=campaignEnemies(historicalEnemies),waves=campaignWaves(historicalWaves);
const data={balance,towers,enemies,waves,recipes},profile=loadProfile(),audio=new AudioManager(profile.muted),roman=ROMAN;
const params=new URLSearchParams(location.search);const debug=import.meta.env.DEV&&params.has('debug');
let game,world,statistics,images,dpsTracker,dpsWave=null,toastTimer,uiClock=0,previous=performance.now(),modalPaused=false,mode=waves.length,recipeFocus=null;
const app=document.getElementById('app');
const rankPreview=new DefenderRankPreview();
const previewFlow=new WavePreviewFlow(),threatAnalyzer=new WaveThreatAnalyzer(data),armyReadiness=new ArmyReadiness(data);
let intelligenceModel=null,intelligenceKey=null,intelligenceIndex=null,intelligencePending=false;
const draftCardActivation=new DraftCardActivation(),draftPointerGesture=new PointerTapGesture(),pointerDraws=new Map();
app.innerHTML=`
<header class="topbar">
 <div class="brand"><div class="crest">${icon('shield')}</div><div><h1>BASTIONS</h1><small>OF THE LAST KINGDOM</small></div></div>
 <div class="top-stats">
  <div class="hud-stat wave">${icon('swords')}<div><small>WAVE</small><strong id="hud-wave"></strong></div></div>
  <div class="hud-stat keep">${icon('shield')}<div><small>KEEP HEALTH</small><strong id="hud-lives"></strong></div></div>
  <div class="hud-stat">${icon('coin')}<div><small>GOLD</small><strong id="hud-gold"></strong></div></div>
  <div class="hud-stat score">${icon('spark')}<div><small>SCORE</small><strong id="hud-score"></strong></div></div>
  <div class="hud-stat command-points" title="Run-local tactical resource · +${balance.commandPoints.bossReward} for each defeated boss" aria-label="Command Points">${icon('swords')}<div><small>CP</small><strong id="hud-cp">${balance.commandPoints.starting}</strong></div></div>
  <div class="hud-stat run-time" title="Real elapsed time, including pauses; independent of game speed" aria-label="Elapsed run time"><div><small>TIME</small><strong id="hud-time">00:00</strong></div></div>
 </div>
 <div class="header-actions"><a class="text-button" href="${siteUrl('archer.html')}" target="_blank" rel="noopener" title="Explore all Blender defenders">Royal atelier</a><button class="text-button" data-action="warbands" title="Fifty-wave warband guide (V)">${icon('swords')}<span>Warbands</span></button><button class="text-button gold" data-action="codex" title="Tower grimoire (C)">${icon('book')}<span>Grimoire</span></button><button class="icon-button" data-action="mute" id="mute" title="Toggle sound" aria-label="Toggle sound">${icon(profile.muted?'mute':'sound')}</button><button class="icon-button" data-action="help" title="How to play (H)" aria-label="How to play">${icon('help')}</button></div>
</header>
<section id="battlefield" aria-label="Battlefield"></section>
<div class="map-start" id="map-start" hidden><button class="primary-button" data-action="start" id="start-wave"></button></div>
<aside class="tower-dps" id="tower-dps" aria-label="Peak actual tower damage per second this wave"></aside>
<div class="map-controls"><button class="icon-button active" data-action="path" title="Show enemy route (P)" aria-label="Show enemy route">${icon('path')}</button><button class="icon-button active" data-action="grid" title="Show construction grid (G)" aria-label="Show construction grid">${icon('grid')}</button><button class="icon-button" data-action="ranges" title="Show tower ranges (R)" aria-label="Show tower ranges">${icon('target')}</button><button class="icon-button" data-action="camera" title="Reset camera (Home)" aria-label="Reset camera">${icon('reset')}</button><button class="icon-button" data-action="maze" title="Suggested maze (M)" aria-label="Suggested maze" aria-pressed="false">${icon('maze')}</button></div>
<div class="control-hint"><span class="touch-controls">Drag one finger to pan · Pinch to zoom / two fingers rotate · Tap to build or select</span><span class="mouse-controls"><kbd>WASD</kbd> / edges pan &nbsp;·&nbsp; <kbd>Q / E</kbd> rotate &nbsp;·&nbsp; Scroll to zoom &nbsp;·&nbsp; <kbd>1–5</kbd> select draw &nbsp;·&nbsp; <kbd>Del / ⌫</kbd> remove wall</span></div><div class="map-compass">N${icon('spark')}</div>
<aside class="sidebar" aria-label="Command panel"><div class="side-top" id="side-top"></div><div id="wave-intelligence" aria-label="Upcoming wave intelligence"></div><div class="side-body" id="side-body"></div><div class="sidebar-recipe" id="recipe-browser"></div></aside>
<section class="draft-panel" aria-label="Five tower draws"><div class="draft-main" id="draft"></div><aside class="draft-mastery" id="economy" aria-label="Construction mastery"></aside></section>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<dialog id="dialog" aria-label="Game information"><div id="dialog-content"></div></dialog>`;
const $=id=>document.getElementById(id);
const tour=new GuidedTutorial({onFinish:()=>{profile.tutorialDecision='complete';saveProfile(profile);}});
function offerTutorial(){if(profile.tutorialDecision||debug)return;openDialog(`<div class="tutorial-welcome"><div class="eyebrow">Welcome to Ashen Vale</div><h2>Would you like a tutorial?</h2><p>A short field guide shows where to build, how to keep defenders, and where to find maze plans and champion recipes.</p><div class="actions"><button class="primary-button" data-action="tutorial-start">Show tutorial</button><button class="text-button" data-action="tutorial-skip">Play without tutorial</button></div></div>`);}
function startTutorial(){profile.tutorialDecision='accepted';saveProfile(profile);closeDialog();tour.start();}
function quality(t){if(t.state==='ruin')return 'Castle wall';return towers[t.family]?.advanced?`${championClassification(t.family)} champion`:`${defenderCode(towers[t.family],t.tier)} · ${balance.tiers[t.tier-1]}`;}
function notice(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4000);}
function renderIntelligence(){
  const index=previewFlow.nextIndex(game),host=$('wave-intelligence');
  if(index===null){host.replaceChildren();intelligenceModel=null;intelligenceKey=null;intelligenceIndex=null;intelligencePending=false;return;}
  const outlook=threatAnalyzer.outlook(index,game.waveLimit),readiness=armyReadiness.evaluate(outlook.next,game.towers);
  intelligenceModel={...outlook,readiness};
  const pending=previewFlow.pending(game),key=JSON.stringify([index,game.waveLimit,readiness,pending]);
  if(key===intelligenceKey)return;
  const wasOpen=host.querySelector('details.wave-intelligence')?.open;
  const open=previewDisclosureOpen({index,previousIndex:intelligenceIndex,pending,previousPending:intelligencePending,open:wasOpen});
  host.innerHTML=wavePreviewMarkup(intelligenceModel,data,images,{compact:true,open,headingId:'wave-preview-title'});
  intelligenceKey=key;intelligenceIndex=index;intelligencePending=pending;
}
function openDefenderDraft(){
  if(!previewFlow.open(game))return false;
  draftCardActivation.clear();world.doubleTap.clear();game.selected=null;
  const panel=$('wave-intelligence').querySelector('details.wave-intelligence');if(panel)panel.open=false;
  world.sync();render();return true;
}
function sendWave(){if(game.phase!=='ready')return false;draftCardActivation.clear();game.selected=null;return game.startCombat();}
function mainAction(){if(previewFlow.pending(game)){openDefenderDraft();return;}if(game.commandMove.active){game.cancelMove();return;}if(game.phase==='ready')sendWave();else if(game.phase==='select')game.keep();else if(game.phase==='combat'){game.paused=!game.paused;render();}}
function tutorial(){return `<div class="eyebrow">A last stand begins</div><h2>Build your defense.</h2><p class="intro-text">Five draws. One keeper.<br>Every placement shapes the battle.</p><div class="rule-steps"><div class="rule-step"><span class="step-number">1</span><p><strong>Place all five defenders</strong>Choose a tile. A random defender appears only after you build.</p></div><div class="rule-step"><span class="step-number">2</span><p><strong>Keep, merge, or combine</strong>Unchosen positions become barricades. Reserve one for the next draft with CP.</p></div><div class="rule-step"><span class="step-number">3</span><p><strong>Make the invaders take the long way</strong>Follow I → II → III → IV → V → the keep.</p></div></div>${game.round===1&&game.towers.length===0&&waves.length>10?`<label class="section-label" for="mode">CAMPAIGN LENGTH</label><select id="mode" aria-label="Campaign length"><option value="${waves.length}" ${mode===waves.length?'selected':''}>${waves.length} waves · Last Kingdom</option><option value="10" ${mode===10?'selected':''}>10 waves · Border skirmish</option></select>`:''}`;}
function towerPanel(t) {
  if(t.state==='reserved')return `<div class="eyebrow">${icon('pin')} Reserved for the next draft</div><div class="tower-portrait"><img src="${images[`${t.family}:${t.tier}`]||images[t.family]}" alt="${towers[t.family].name} model"></div><h2 class="tower-name">${towers[t.family].name}</h2><p class="intro-text">Inactive on this fixed position. Blocks the ground route like a castle wall, without attacks or support effects.</p><div class="stat-grid" style="margin-top:20px"><div><span>Rank</span><strong>${rankLabel(t.tier)}</strong></div><div><span>Attack</span><strong>Inactive</strong></div><div><span>Position</span><strong>Fixed</strong></div></div><p class="minor-note">Returns here as Slot 1 among the next five candidates. Place the other four, then keep it to activate, reserve it again with CP, or choose another keeper and leave a castle wall here.</p>`;
  if(t.state==='ruin')return `<div class="eyebrow">The walls remember</div><div class="tower-portrait"><img src="${images.ruin}" alt="Castle stone wall"></div><h2>Castle wall</h2><p class="intro-text">A crenellated stone wall. It cannot attack, but forces enemies to find a way around it.</p><div class="stat-grid" style="margin-top:20px"><div><span>Footprint</span><strong>1 tile</strong></div><div><span>Attack</span><strong>None</strong></div><div><span>Role</span><strong>Maze</strong></div></div><div class="actions"><button class="secondary-button" data-action="remove" ${game.phase==='combat'?'disabled':''}>Demolish wall · Del</button></div><p class="minor-note">Clear foundations between waves to reshape the route.</p>`;
  const view=rankPreview.view(t,data),stats=towerStats(view,data),partner=game.mergePartner(t),available=game.availableRecipes(t);
  return `<div style="--tower-color:${stats.advanced?stats.color:rankColor(view.tier)}"><div class="tower-portrait"><img src="${images[`${t.family}:${view.tier}`]||images[t.family]}" alt="${stats.name} model"></div><div class="quality-badge">${icon(stats.advanced?'crown':stats.icon)} ${quality(view)}</div><h2 class="tower-name">${stats.name}</h2>${defenderRankPreviewMarkup(t,view,data)}<p class="role">${stats.description}</p><p class="owned-count"><strong>${builtTowerCount(game.towers,t.family,view.tier)}</strong> built · ${stats.name}${stats.advanced?'':` · Rank ${rankLabel(view.tier)}`}</p><ul class="tower-effects">${abilityLines(stats).map(line=>`<li>${line}</li>`).join('')}</ul><div class="stat-grid combat-stat-grid"><div><span>Damage / hit</span><strong>${formatTowerNumber(stats.damage)}</strong></div><div><span>Base DPS</span><strong>${formatTowerNumber(baseAttackDps(stats))}</strong></div><div><span>Attacks / s</span><strong>${formatTowerNumber(1/stats.interval)}</strong></div><div><span>Range</span><strong>${formatTowerNumber(stats.range)}</strong></div></div><span class="damage-tag">${damageTypeName(stats.type)}</span><span style="font-size:10px;color:var(--muted);margin-left:10px">${t.kills} kills</span>${!stats.advanced?`<p class="strength">Strong: ${stats.strong}</p><p class="weakness">Weak: ${stats.weak}</p>`:''}${view.tier!==t.tier?`<p class="rank-field-note">FIELD COMMANDS &amp; SUPPORT · TIER ${roman[t.tier-1]}</p>`:''}${selectedSupportMarkup(t,game.towers,data,{combat:game.combat,phase:game.phase})}<div class="targeting"><label for="targeting">Target priority</label><select id="targeting">${['first','last','strongest','weakest','fastest','slowest'].map(p=>`<option value="${p}" ${t.priority===p?'selected':''}>${p[0].toUpperCase()+p.slice(1)}</option>`).join('')}</select></div>
  <div class="actions">${game.phase==='select'&&t.state==='draft'?`${!stats.advanced&&t.tier>1?`<button class="secondary-button" data-action="downgrade" ${game.economy.gold<balance.downgradeCost?'disabled':''}>Downgrade to Tier ${roman[t.tier-2]} &amp; keep · ${balance.downgradeCost} gold</button><p class="minor-note">One rank lower. Kept immediately on its wall.</p>`:''}`:''}${partner&&game.canCombine(t)?`<button class="secondary-button merge" data-action="merge">${icon('spark')} MERGE AVAILABLE · Tier ${roman[t.tier]}</button>`:''}${available.map(r=>`<button class="secondary-button merge" data-action="craft" data-id="${r.id}">${icon('crown')} Create ${recipeLabel(r,data)}</button>`).join('')}</div>
  ${game.phase==='build'?`<p class="minor-note">Place ${game.draft.draws.filter(d=>!d.placed).length} more defenses before choosing a keeper.</p>`:''}
  <div class="section-label">POTENTIAL COMBINATIONS</div>${recipesUsing(view,game.recipes).map(r=>{const progress=recipeProgress(r,game.towers),count=progress.filter(p=>p.owned).length,drafts=progress.filter(p=>p.draft).length;return `<button class="text-button" data-action="recipe-open" data-id="${r.id}" style="width:100%;justify-content:space-between;margin-top:6px;font-size:10px"><span>${recipeLabel(r,data)}</span><span class="potential-progress ${count?'owned-progress':''}">${count}/${r.ingredients.length}${drafts?` <small class="draft-progress">+${drafts} this round</small>`:''}</span></button>`;}).join('')||'<p class="role">This rank is not used by any champion recipe.</p>'}</div>`;
}
function waveTraitsPanel(){
  return `<div class="current-warband">${currentWarbandContents(currentWarbandInfo(game))}</div>`;
}
function enemyInspectionOptions(){return {data,images,combat:game.combat,paused:game.paused,speed:game.speed};}
function combatPanel(){return `<div class="eyebrow">Wave ${game.round} · ${game.wave.boss?'Warlord approaching':'Hold the line'}</div><h2>${game.wave.name}</h2>${waveTraitsPanel()}<div class="battle-progress"><div id="combat-progress"></div></div><p class="role"><span id="enemy-count">${game.combat.remaining}</span> enemies remaining</p>${game.wave.boss?'<div class="boss-health"><div><strong id="boss-health-label">Warlord health</strong><span id="boss-hp"></span></div><div class="boss-health-track"><span id="boss-health-fill"></span></div></div>':''}<div class="combat-buttons"><button class="text-button" data-action="pause">${icon(game.paused?'play':'pause')}${game.paused?'Resume':'Pause'}</button><button class="text-button gold" data-action="speed">${game.speed}× speed</button></div>`;}

function renderSidebar(){const phaseLabels={build:'CONSTRUCTION',select:'CHOOSE YOUR KEEPER',ready:'READY FOR BATTLE',combat:'THE SIEGE',reward:'THE VALLEY HOLDS',won:'VICTORY',lost:'THE KEEP HAS FALLEN'};$('side-top').innerHTML=`<span class="phase">${icon(game.phase==='combat'?'swords':'hammer')}${previewFlow.pending(game)?'WAVE PREVIEW':phaseLabels[game.phase]}</span><span class="phase-round">${game.round} / ${game.waveLimit}</span>`;
  const enemy=game.enemySelection,t=game.selection,body=$('side-body'),previousEnemy=body.querySelector('#selected-enemy-panel')?.dataset.enemyId,scroll=body.scrollTop;if(!t||t.state==='ruin')rankPreview.clear();
  body.innerHTML=enemy?`<div id="selected-enemy-panel" data-enemy-id="${enemy.id}">${selectedEnemyMarkup(enemy,enemyInspectionOptions())}</div>`:t?towerPanel(t):game.phase==='combat'?combatPanel():game.phase==='ready'?`<div class="eyebrow">The defenses are set</div><h2>Ready for the next assault.</h2><p class="intro-text">Inspect your defenses, then start the next wave from the button above the field. Space also begins the assault.</p>` :tutorial();
  if(!previewFlow.pending(game))body.insertAdjacentHTML('afterbegin',commandPointsMarkup(game,{context:'sidebar'}));
  if(enemy)body.scrollTop=previousEnemy===String(enemy.id)?scroll:0;else if(previousEnemy)body.scrollTop=0;
  $('targeting')?.addEventListener('change',e=>{game.selection.priority=e.target.value;});$('mode')?.addEventListener('change',e=>{mode=Number(e.target.value);game.waveLimit=mode;world.sync();render();});
}
function previewRecipe(){return game.recipes.find(r=>r.id===(recipeFocus||game.pinned))||null;}
function recipeBrowserMarkup(){
  const recipe=previewRecipe();
  if(!recipe)return `<button class="text-button recipe-browse" data-action="recipe-first">${icon('book')} Browse champion recipes</button>`;
  const order=game.recipes,index=order.findIndex(r=>r.id===recipe.id),family=recipeFamily(recipe),stats=towers[family];
  const pinned=recipe.id===game.pinned;
  return `<section class="recipe-browser-panel ${pinned?'is-pinned':''}" aria-label="Champion recipe preview" data-recipe-id="${recipe.id}"><div class="recipe-browser-nav"><button class="icon-button" data-action="recipe-prev" aria-label="Previous champion recipe" ${index===0?'disabled':''}>‹</button><span>${index+1} / ${order.length}</span><button class="icon-button" data-action="recipe-next" aria-label="Next champion recipe" ${index===order.length-1?'disabled':''}>›</button>${game.pinned?`<button class="text-button return-pinned" data-action="recipe-return" ${pinned?'disabled':''} title="Return to pinned ${recipeLabel(order.find(r=>r.id===game.pinned),data)}">${icon('reset')} Return to pinned</button>`:''}</div><div class="recipe-browser-header"><img src="${images[family]}" alt=""><div class="eyebrow">${championClassification(family)}${pinned?' · PINNED':''}</div><h3>${stats.name}</h3><p>${stats.description}</p></div><button class="text-button recipe-pin-button ${pinned?'recipe-pin':''}" data-action="pin" data-id="${recipe.id}">${icon('pin')}${pinned?'Unpin recipe':'Pin this recipe'}</button>${recipeProgressLegend()}${recipeIngredientTree(recipe,data,game.towers)}</section>`;
}
function renderRecipeBrowser(){
  const browser=$('recipe-browser');browser.hidden=!!game.enemySelection;if(browser.hidden)return;
  const scroll=browser.scrollTop;browser.innerHTML=recipeBrowserMarkup();browser.scrollTop=scroll;
  browser.classList.toggle('has-recipe',!!previewRecipe());
}
function openRecipePreview(id){recipeFocus=id;renderRecipeBrowser();$('recipe-browser').scrollTop=0;}
function browseRecipe(direction){const order=game.recipes,current=previewRecipe(),index=order.findIndex(r=>r.id===current?.id);openRecipePreview(order[Math.max(0,Math.min(order.length-1,index+direction))].id);}
function renderEconomy(){
  $('economy').innerHTML=masteryPanelMarkup(game.economy,balance);
}
function renderDraft(){
  if(previewFlow.pending(game)){$('draft').innerHTML=wavePreviewGateMarkup(intelligenceModel,data,images,{action:'open-defender-draft'});return;}
  const count=game.draft.draws.filter(draw=>draw.placed).length;
  const heading=game.phase==='build'?`Place your defenses <span class="draft-sub">${count}/5 placed</span>`:game.phase==='select'?`Choose your keeper <span class="draft-sub">Double-click or double-tap a card to keep</span>`:game.phase==='combat'?`The siege is underway <span class="draft-sub">SELECT A DEFENDER OR ENEMY TO INSPECT</span>`:'Your defenses are set';
  $('draft').innerHTML=`<div class="draft-heading"><h3>${heading}</h3>${game.phase==='combat'?`<div class="draft-combat-actions"><button class="text-button" data-action="pause">${icon(game.paused?'play':'pause')}${game.paused?'Resume':'Pause'}</button><button class="text-button" data-action="speed">${game.speed}×</button></div>`:`<span class="draft-sub">${game.grid.route.length-1} tiles of enemy route</span>`}</div>${commandPointsMarkup(game,{context:'draft'})}${game.phase==='won'||game.phase==='lost'?`<div class="draft-ended">${icon('crown')}<div><h3>${game.phase==='won'?'The kingdom endures.':'The banners fall.'}</h3><p>${game.kills} invaders defeated · ${game.round} waves faced · ${(game.score||0).toLocaleString()} score</p></div><button class="primary-button" data-action="restart">Try a new draft</button></div>`:draftCardsMarkup(game,data,images)}`;
}
function renderMapAction(){
  $('map-start').hidden=game.phase!=='ready';
  $('start-wave').innerHTML=`${icon('swords')} Start wave ${game.round}`;
}
function hud(){
  const inspected=game.enemySelection,inspection=$('selected-enemy-panel');
  if(inspected&&inspection)updateSelectedEnemyPanel(inspection,inspected,enemyInspectionOptions());
  else if(inspection){renderSidebar();renderRecipeBrowser();}
  updateTowerDpsPanel($('tower-dps'),dpsTracker.snapshot(game.towers,game.combat.elapsed,{includeDraft:true}),data,images,{phase:game.phase,paused:game.paused,wave:dpsWave});
  $('hud-wave').innerHTML=`${game.round} <span>/ ${game.waveLimit}</span>`;
  $('hud-lives').innerHTML=`${game.lives} <span>/ ${balance.startingLives}</span>`;
  $('hud-gold').textContent=game.economy.gold;
  $('hud-time').textContent=formatRunDuration(game.elapsedSeconds);
  const cp=$('hud-cp'),nextCP=String(game.commandPoints.value);if(cp.textContent!==nextCP){cp.textContent=nextCP;cp.parentElement.parentElement.classList.remove('cp-changed');void cp.offsetWidth;cp.parentElement.parentElement.classList.add('cp-changed');}
  $('hud-score').textContent=(game.score||0).toLocaleString();
  $('hud-score').title=`Best score: ${Math.max(profile.bestScore,game.score||0).toLocaleString()}`;
  if($('enemy-count'))$('enemy-count').textContent=game.combat.remaining;
  const warbandPanel=$('side-body').querySelector('.current-warband');
  if(warbandPanel)updateCurrentWarbandPanel(warbandPanel,currentWarbandInfo(game));
  if($('combat-progress'))$('combat-progress').style.width=`${(1-game.combat.remaining/Math.max(1,game.combat.total))*100}%`;
  const health=bossHealth(game);
  if($('boss-hp')&&health){
    $('boss-hp').textContent=`${health.hp.toLocaleString()} / ${health.maxHp.toLocaleString()} HP`;
    $('boss-health-label').textContent=health.approaching?'Warlord approaching':'Warlord health';
    $('boss-health-fill').style.width=`${health.maxHp?health.hp/health.maxHp*100:0}%`;
  }
  const effects=$('selected-support-effects'),selection=game.selection;
  if(effects&&selection&&selection.state!=='ruin'){
    const markup=supportEffectsMarkup(selection,game.towers,data,{combat:game.combat,phase:game.phase});
    if(effects.innerHTML!==markup)effects.innerHTML=markup;
  }
}

function render(){renderIntelligence();renderSidebar();renderRecipeBrowser();renderEconomy();renderDraft();renderMapAction();hud();tour.refresh();}
function openDialog(html){draftCardActivation.clear();draftPointerGesture.clear();pointerDraws.clear();const dialog=$('dialog');if(!dialog.open){modalPaused=game.paused;game.paused=true;dialog.showModal();}world.keys.clear();$('dialog-content').innerHTML=html;if(debug&&html.includes('Commander’s tools'))$('dialog-content').insertAdjacentHTML('beforeend','<div class="dialog-body debug-row"><button class="text-button" data-action="debug-review">Review corpses and catapult</button><button class="text-button" data-action="debug-boss-review">Review boss battle</button><button class="text-button" data-action="debug-enemies-review">Review Dark Host and auras</button><button class="text-button" data-action="debug-markers-review">Review recipe portraits</button><button class="text-button" data-action="debug-secret-claire">Review Lady Claire draft</button><button class="text-button" data-action="debug-merge-review">Review rank merge buttons</button><button class="text-button" data-action="debug-soil-review">Review checkpoint soil</button><button class="text-button" data-action="debug-ruin-review">Review broken tower</button></div>');}
function closeDialog(){if($('dialog').open)$('dialog').close();}
$('dialog').addEventListener('close',()=>{game.paused=modalPaused;render();});
function dialogHeader(label,title){return `<div class="dialog-header"><div><div class="eyebrow">${label}</div><h2>${title}</h2></div><button class="icon-button" data-action="close" aria-label="Close">${icon('close')}</button></div>`;}
function codex(){
  const available=new Set(game.availableRecipes().map(r=>r.id));
  openDialog(`${dialogHeader('The royal archives','Tower grimoire')}<div class="dialog-body">${defenderGuide(data,images)}<p>Select an ingredient on the battlefield to choose the result tile. Consumed foundations remain as barricades. Pin a recipe to highlight basic recruits throughout its full crafting chain.</p><div class="recipe-grid">${game.recipes.map(r=>championRecipeCard(r,data,images,{towerList:game.towers,pinned:game.pinned===r.id,discovered:game.discoveries.has(recipeFamily(r))||game.discoveries.has(r.id),level:game.economy.level,craftable:available.has(r.id)})).join('')}</div></div>`);
}
function pinRecipe(id){
  const scrollTop=$('dialog-content').querySelector('.dialog-body')?.scrollTop||0;
  const inDialog=$('dialog').open;game.pinned=game.pinned===id?null:id;recipeFocus=id;render();if(!inDialog)return;codex();
  const body=$('dialog-content').querySelector('.dialog-body');body.scrollTop=scrollTop;
  const card=[...body.querySelectorAll('[data-recipe-id]')].find(card=>card.dataset.recipeId===id);
  const target=game.pinned===id?card?.querySelector('.recipe-basic-breakdown'):card;
  target?.scrollIntoView({block:'nearest'});
}

function warbands(){openDialog(`${dialogHeader('The approaching horde · 50 waves','Warbands of the Ashen Host')}<div class="dialog-body"><p>Fifty distinct warbands. Five warlords. Auras and symbols identify special resistances and abilities; ordinary armor has no shield symbol. Prepare physical, magical and pure damage for their changing defenses. Flying warbands follow the checkpoint route directly; concentrate your ranged defenders near the central crossings.</p><p>Variants are chosen when a wave begins. Clerics reveal veiled enemies within 6 tiles; any defender spots them within 2. Checkpoints reveal nearby invaders.</p><div class="warband-grid">${warbandCardsMarkup(waves,enemies,images,{balance})}</div><p class="minor-note">Wave order, movement and traits inspired by <a href="https://dota2.fandom.com/wiki/Gem_TD" target="_blank" rel="noreferrer">Gem TD</a>. Orc characters, combat timings and balance are original adaptations.</p></div>`);}
function fieldGuide(){openDialog(`${dialogHeader('A field guide for the commander','Hold the valley.')}<div class="dialog-body"><div class="help-grid"><div><h3>Five draws. One decision.</h3><p>Before each draft, review the upcoming wave and open the defender draft. The intelligence panel stays available above defender details. Every round grants exactly five candidates. A reserved defender returns already placed at its fixed position; the other four are new random defenders. New types and ranks are hidden until each successful placement rolls a defender. Place all five, then keep one, merge an identical pair, or craft a recipe. The unchosen towers become castle walls. A candidate above Tier I may instead be downgraded by one rank and immediately kept for 200 gold. Select any basic defender and use Compare ranks in the command panel to inspect all six portraits, stats and abilities. On field shows its actual rank; merging and downgrading act on that defender. Kept defenders stand on connected stone battlements.</p><br><p>Draft cards show the tower quality: Militia, Trained, Veteran, Elite, Royal, Mythic. Two identical families and qualities among the current five candidates merge into the next quality. Retained defenders cannot merge across rounds; advanced recipes can still use them. Mythic VI is the cap and comes from merging two Royal V units.</p></div><div><h3>The maze is your weapon.</h3><p>Invaders must pass through all five numbered checkpoints in order, including the loop at the upper right. Every checkpoint is on the fifth tile from its nearest edge (four tiles before it). Only invaders reaching the keep cost lives. The slim gold guide and moving chevrons show the route enemies can use now and their travel direction. The subdued grey dashed guide shows the route after all selected blueprint walls are built. The map legend lets you show each route separately. For a flying wave, the current route turns cyan and runs directly through the checkpoints. Place towers and barricades to lengthen it. A red tile means the placement is invalid. Flying invaders take a direct checkpoint route. Press M to choose a fixed maze blueprint or draw and save your own. Selecting a plan closes the panel and keeps its wall cells unchanged. Press M to change it. Commander’s spiral has a solid 3 × 3 central battery. Build blue cells and reserve the gold central positions for your strongest defenders. Counts include every checkpoint segment. The campaign grants at most 250 placements: five per wave. Walls and retained defenders share this budget. Demolishing a wall never refunds a placement. The planner counts existing structures outside the plan too, and warns if it exceeds the remaining draws. Flying waves ignore walls and travel directly between checkpoints.</p><br><p>Only castle walls can be demolished with Delete or Backspace for free. Retained defenders are permanent; advanced recipes may consume them and leave removable walls. Demolition works between waves. New candidates cannot be demolished before choosing a keeper. Stationary markers numbered 1–5 mark this round’s candidates; they disappear when you keep or combine. When a recipe is ready, portraits above its ingredients show the possible result: star for the result tile, minus for consumed ingredients, and a wall for discarded candidates. Retained ingredients have stationary portraits. Click a recipe portrait once to preview its result at that foundation; double-click or double-tap the same portrait to create it there. A survived wave opens the next wave preview before its defender draft.</p></div><div><h3>Controls</h3><ul><li>Left click: place or select a tower; select a visible invader to inspect its remaining health, stats and current effects. Double-click a defender on the map or its draft card to keep it after all five placements.</li><li>1–5: select a draft card / numbered candidate</li><li>Delete / Backspace: demolish selected castle wall · free</li><li>WASD / arrows / right drag / mouse at field edges: pan</li><li>Q / E / middle drag: rotate</li><li>Mouse wheel: zoom · Home: reset</li><li>Space: open draft / keep / send wave / pause</li><li>P: route · G: grid · R: all ranges · M: maze blueprint</li><li>C: grimoire · H: this guide</li><li>Touch / iPad: drag one finger to pan; tap to place or select; pinch to zoom and drag two fingers to rotate. Double-tap a draft defender on the map or its card to keep it.</li></ul></div><div><h3>Support on the field</h3><p>Friendly symbols show bonuses actually reaching a retained defender. Dread, disarm and barricade disruption appear only while their penalties are active. Select a defender to see each effect’s value and provider.</p>${supportMapLegendMarkup()}</div><div><h3>A stronger kingdom</h3><p>Kills grant Kingdom XP for champion recipes. Construction Mastery grows with each new wave, reaching 15 before wave 25 begins. Completing a normal wave earns 50 gold; a boss wave earns 200. Gold pays for lowering a draft defender by one rank; champions have fixed stats. The odds improve gradually and apply to future rounds. Each placement reveals a new random defender; invalid clicks reveal nothing. Each run starts with ${balance.commandPoints.starting} Command Points, and each defeated boss adds ${balance.commandPoints.bossReward}. After all five placements, Reroll costs ${balance.commandPoints.costs.reroll} CP and can be used once per draft. A returning reserved defender is protected from reroll. Reserve costs ${balance.commandPoints.costs.reserve} CP: the defender remains on its fixed tile as an inactive blocker, without attacks or support. It returns already placed in slot 1 among next draft’s five candidates, leaving four new placements. Keep it to activate it on that position. Reserve it again to carry it further; ignored returning defenders become walls normally. Reroll before confirming Reserve. Between waves, Move costs ${balance.commandPoints.costs.move} CP and exchanges a retained defender with an existing castle wall. Select a highlighted defender and then a highlighted wall; Cancel Move or Escape spends nothing. Combine the exact three ingredients shown in the grimoire to create one of the ${data.recipes.length} champions. Champions keep their fixed identity and cannot be merged into additional ranks. Open the grimoire to inspect their stats and abilities. Pin a recipe to see all basic recruits required by its complete crafting chain. Score grows with kills and completed waves; warlords grant larger awards.</p><br><p>Lost keep health cannot be bought back. Keep health reaching zero ends the run. Survive the final wave to win. Discoveries, audio settings, tutorial preference and custom maze blueprints are saved in this browser. The TIME clock measures total real time from the start, including construction and pauses. Game speed does not change it. Victory or defeat freezes the final time, which is recorded with each run’s statistics for balancing. At the end, choose a name to publish your score and see the Top 10 and your own rank. The 10-wave and 50-wave campaigns and different game editions have separate rankings.</p><button class="text-button" data-action="new-run" style="margin-top:20px">Start a new run</button>${debug?'<button class="text-button" data-action="debug" style="margin-top:10px">Developer tools</button>':''}</div></div></div>`);}
function help(){fieldGuide();$('dialog-content').querySelector('.dialog-body').insertAdjacentHTML('afterbegin','<button class="primary-button" data-action="tutorial-start" style="margin-bottom:20px">Replay tutorial</button>');}
function showResult(){
  const won=game.phase==='won';
  openDialog(`<div class="result">${icon(won?'crown':'shield')}<div class="eyebrow">${won?'Ashen Vale stands':'A kingdom remembered'}</div><h2>${won?'The kingdom endures.':'The last banners fall.'}</h2><p>${won?'The warband breaks against your walls. For one more dawn, the valley belongs to its people.':'The invaders have reached the keep. A different maze, a better combination, one more stand.'}</p><div class="result-stats"><div><strong>${(game.score||0).toLocaleString()}</strong><small>Score</small></div><div><strong>${profile.bestScore.toLocaleString()}</strong><small>Best score</small></div><div><strong>${game.round}</strong><small>Waves faced</small></div><div><strong>${game.kills}</strong><small>Invaders defeated</small></div><div><strong>${formatRunDuration(game.elapsedSeconds)}</strong><small>Elapsed time</small></div></div>${resultLeaderboardMarkup()}<button class="primary-button" data-action="restart">Raise the banners again</button><button class="text-button" style="margin:auto" data-action="close">Inspect battlefield</button></div>`);
  connectResultLeaderboard($('dialog-content').querySelector('.result-leaderboard'),statistics);
}

function debugPanel(){if(!debug)return;openDialog(`${dialogHeader('Development build only','Commander’s tools')}<div class="dialog-body"><div class="debug-row"><button class="text-button" data-action="debug-gold">Add 1,000 gold</button><button class="text-button" data-action="debug-mastery">Next mastery</button><button class="text-button" data-action="debug-kill">Kill all enemies</button><button class="text-button" data-action="debug-skip">Complete wave</button><button class="text-button" data-action="debug-unlock">Discover all recipes</button></div><div class="debug-row"><label>Force family <select id="force-family">${Object.entries(towers).filter(([,s])=>!s.advanced).map(([id,s])=>`<option value="${id}">${s.name}</option>`).join('')}</select></label><label>Quality <select id="force-tier">${roman.map((r,i)=>`<option value="${i+1}">${r}</option>`).join('')}</select></label><button class="text-button" data-action="debug-force">Force next draft</button></div><div class="debug-row"><select id="spawn-type">${Object.entries(enemies).map(([id,e])=>`<option value="${id}">${e.name}</option>`).join('')}</select><button class="text-button" data-action="debug-spawn">Spawn enemy</button><button class="text-button" data-action="debug-spell-review">Review spells and concealment</button><button class="text-button" data-action="debug-support-review">Review support effects</button><button class="text-button" data-action="debug-defense-review">Review active defenses</button><button class="text-button" data-action="debug-inspection-review">Review enemy inspection</button><button class="text-button" data-action="debug-command-review">Review Command Points</button><button class="text-button" data-action="debug-wave-preview" data-round="1">Review preview wave 1</button><button class="text-button" data-action="debug-wave-preview" data-round="7">Review preview wave 7</button><button class="text-button" data-action="debug-wave-preview" data-round="14">Review preview wave 14</button><button class="text-button" data-action="debug-wave-preview" data-round="20">Review preview wave 20</button><button class="text-button" data-action="debug-wave-preview" data-round="31">Review preview wave 31</button><button class="text-button" data-action="debug-wave-preview" data-round="42">Review preview wave 42</button><button class="text-button" data-action="debug-wave-preview" data-round="50">Review preview wave 50</button><button class="text-button" data-action="debug-timing-review">Review wave 25 mastery</button><button class="text-button" data-action="debug-concealment-review">Review concealment and disarm</button></div></div>`);}
function activateDraw(index,event=null){
  if(previewFlow.pending(game))return;
  const draw=game.draft.draws[index];if(!draw||world.maze.editing){draftCardActivation.clear();return;}
  audio.unlock();
  if(draw.placed){draftCardActivation.activate(game,index,event);return;}
  draftCardActivation.clear();
  if(game.phase==='build'){game.activeDraw=index;game.selected=null;world.sync();render();}
}
app.addEventListener('pointerdown',event=>{
  draftPointerGesture.start(event);
  const card=event.target.closest?.('[data-action="draw"]');
  if(card&&!card.disabled){const index=Number(card.dataset.index);pointerDraws.set(event.pointerId,{index,towerId:drawnTower(game,index)?.id??null,round:game.round});}
  if(draftPointerGesture.navigating(event.pointerId))draftCardActivation.clear();
});
window.addEventListener('pointermove',event=>{draftPointerGesture.move(event);if(draftPointerGesture.navigating(event.pointerId))draftCardActivation.clear();});
window.addEventListener('pointerup',event=>{
  const origin=pointerDraws.get(event.pointerId),tap=draftPointerGesture.end(event);pointerDraws.delete(event.pointerId);
  const card=event.target.closest?.('[data-action="draw"]');
  if(!tap||!origin||!card||card.disabled||Number(card.dataset.index)!==origin.index||game.round!==origin.round||
    (drawnTower(game,origin.index)?.id??null)!==origin.towerId){draftCardActivation.clear();return;}
  activateDraw(origin.index,event);
});
window.addEventListener('pointercancel',event=>{draftPointerGesture.cancel(event);pointerDraws.delete(event.pointerId);draftCardActivation.clear();});
window.addEventListener('lostpointercapture',event=>{if(pointerDraws.has(event.pointerId)){draftPointerGesture.cancel(event);pointerDraws.delete(event.pointerId);draftCardActivation.clear();}});
function handleCommand(e){
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;audio.unlock();const action=b.dataset.action;
  if(action==='tutorial-start'){startTutorial();return;}if(action==='tutorial-skip'){profile.tutorialDecision='skipped';saveProfile(profile);closeDialog();return;}
  if(action==='open-defender-draft'){openDefenderDraft();return;}
  if(previewFlow.pending(game)&&['draw','keep-draw','merge-tower','keep','downgrade','merge','craft','remove','reroll','reserve','move'].includes(action))return;
  if(action==='draw'&&!world.maze.editing){if(e.detail>0||e.pointerType==='touch')return;activateDraw(Number(b.dataset.index));return;}
  draftCardActivation.clear();world.doubleTap.clear();
  if(world.maze.editing&&!['maze','camera','grid','path','ranges','close','help'].includes(action))return;
  const actions={'enemy-inspect-close':()=>game.select(null),'tower-dps-select':()=>game.select(Number(b.dataset.id)),'preview-rank':()=>{const tier=Number(b.dataset.tier);if(rankPreview.select(game.selection,tier,data)){renderSidebar();$('side-body').querySelector(`[data-action="preview-rank"][data-tier="${tier}"]`)?.focus({preventScroll:true});}},'merge-tower':()=>mergeTowerFromBadge(game,Number(b.dataset.towerId),b.dataset.mergeKey),'keep-draw':()=>keepDrawKeeper(game,Number(b.dataset.index),Number(b.dataset.towerId),b.dataset.keeperKey),keep:()=>game.keep(),downgrade:()=>game.downgrade(),merge:()=>game.merge(),craft:()=>{if(game.craft(b.dataset.id))closeDialog();},remove:()=>game.remove(),reroll:()=>game.reroll(),reserve:()=>game.reserve(),move:()=>{if(world.maze.editing)return game.message('Finish or cancel blueprint editing before Move.');world.maze.panelOpen=false;world.maze.sync();return game.beginMove();},'cancel-move':()=>game.cancelMove(),mastery:()=>game.mastery(),'upgrade-special':()=>game.upgradeSpecial(),start:sendWave,pause:()=>{game.paused=!game.paused;render();},speed:()=>{game.speed=game.speed===1?2:game.speed===2?3:1;render();},codex,warbands,help,close:closeDialog,pin:()=>pinRecipe(b.dataset.id),'recipe-open':()=>openRecipePreview(b.dataset.id),'recipe-first':()=>openRecipePreview(game.recipes[0].id),'recipe-prev':()=>browseRecipe(-1),'recipe-next':()=>browseRecipe(1),'recipe-return':()=>openRecipePreview(game.pinned),mute:()=>{audio.muted=!audio.muted;profile.muted=audio.muted;saveProfile(profile);$('mute').innerHTML=icon(audio.muted?'mute':'sound');$('mute').setAttribute('aria-pressed',String(audio.muted));},path:()=>toggleWorld('showPath','path'),grid:()=>toggleWorld('showGrid','grid'),ranges:()=>toggleWorld('showRanges','ranges'),maze:()=>{game.cancelMove();world.maze.togglePanel();},camera:()=>world.resetCamera(),restart:()=>{closeDialog();startGame();},'new-run':()=>openDialog(`${dialogHeader('Raise new banners','Start a new run?')}<div class="dialog-body"><p>Your current battlefield will be cleared. Your recipe discoveries and records remain.</p><button class="primary-button" data-action="restart">Start new run</button><button class="text-button" data-action="close" style="margin-top:12px">Return to the battlefield</button></div>`),debug:debugPanel};
  if(actions[action])actions[action]();
  else if(debug&&action.startsWith('debug-')){
    previewFlow.runScene(game,()=>{
    if(action==='debug-timing-review'){prepareConstructionTimingReview(game);modalPaused=false;closeDialog();}
    if(action==='debug-inspection-review'){prepareEnemyInspectionReview(game);modalPaused=true;closeDialog();}
    if(action==='debug-enemies-review'){prepareEnemyReview(game);modalPaused=true;closeDialog();}
    if(action==='debug-secret-claire'){prepareSecretDraftReview(game,'ladyclaire');modalPaused=false;closeDialog();}
    if(action==='debug-markers-review'){prepareRecipeMarkerReview(game);closeDialog();}
    if(action==='debug-merge-review'){prepareMergeReview(game);closeDialog();}
    if(action==='debug-soil-review'||action==='debug-ruin-review'){
      const point=game.grid.checkpoints[action==='debug-soil-review'?1:5],half=(game.grid.size-1)/2;
      closeDialog();world.clearPointer();world.controls.target.set(point.x-half,.55,point.z-half);world.camera.position.set(point.x-half+3.7,9.6,point.z-half+8.1);world.controls.update();
    }
    if(action==='debug-spell-review'){prepareSpellReview(game);closeDialog();}
    if(action==='debug-support-review'){prepareSupportReview(game);closeDialog();}
    if(action==='debug-defense-review'){modalPaused=true;closeDialog();prepareDefenseReview(game);}
    if(action==='debug-concealment-review'){modalPaused=false;closeDialog();prepareConcealmentReview(game);}
    if(action==='debug-review'||action==='debug-boss-review'){prepareBattleReview(game,action==='debug-boss-review');closeDialog();}
    if(action==='debug-gold')game.economy.reward(1000,180);
    if(action==='debug-mastery')game.economy.setConstructionRound(game.economy.constructionRound+1);
    if(action==='debug-wave-preview'){previewFlow.reset(game);prepareWavePreviewReview(game,Number(b.dataset.round));modalPaused=false;closeDialog();}
    if(action==='debug-command-review'){prepareCommandPointsReview(game);closeDialog();}
    if(action==='debug-kill')game.combat.enemies.forEach(enemy=>game.combat.damage(enemy,1e9,'holy',{},null));
    if(action==='debug-skip'&&game.phase==='combat'){game.combat.enemies=[];game.combat.spawnQueue=[];game.completeWave();}
    if(action==='debug-unlock'){game.recipes.forEach(r=>game.discoveries.add(r.id));profile.discoveries=[...game.discoveries];saveProfile(profile);}
    if(action==='debug-force')game.draft.forced={family:$('force-family').value,tier:Number($('force-tier').value)};
    if(action==='debug-spawn'&&game.phase==='combat')game.combat.spawn($('spawn-type').value);
    });intelligenceKey=null;intelligenceIndex=null;render();notice('Developer change applied.');
  }
}
app.addEventListener('click',handleCommand);
function toggleWorld(key,action){world[key]=!world[key];world.sync();document.querySelector(`[data-action="${action}"]`).classList.toggle('active',world[key]);document.querySelector(`[data-action="${action}"]`).setAttribute('aria-pressed',String(world[key]));}
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&game?.commandMove.active&&!$('dialog').open){e.preventDefault();game.cancelMove();return;}if(e.key==='Escape'&&world?.maze.editing&&!$('dialog').open){e.preventDefault();world.maze.finishEditor();return;}if(e.key==='Escape'&&game?.enemySelection&&!$('dialog').open){e.preventDefault();game.select(null);return;}if(e.ctrlKey||e.metaKey||e.altKey||document.activeElement.isContentEditable||['INPUT','SELECT','TEXTAREA','BUTTON','A','SUMMARY'].includes(document.activeElement.tagName))return;if($('dialog').open)return;const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','delete','backspace'].includes(key))e.preventDefault();world.keys.add(key);if(e.repeat)return;audio.unlock();if(world.maze.editing){if(key==='escape')world.maze.finishEditor();if(key==='m')world.maze.togglePanel();if(key==='home')world.resetCamera();return;}if(key==='delete'||key==='backspace'){game.remove();return;}if(/^[1-5]$/.test(key))document.querySelector(`[data-action="draw"][data-index="${Number(key)-1}"]`)?.click();if(key===' '){mainAction();}if(key==='c')codex();if(key==='v')warbands();if(key==='h')help();if(key==='p')toggleWorld('showPath','path');if(key==='g')toggleWorld('showGrid','grid');if(key==='r')toggleWorld('showRanges','ranges');if(key==='m'){game.cancelMove();world.maze.togglePanel();}if(key==='home')world.resetCamera();if(key==='f2'&&debug)debugPanel();});
window.addEventListener('pagehide',()=>{if(game){statistics?.checkpoint({abandoned:true,keepalive:true});profile.bestScore=Math.max(profile.bestScore,game.score||0);saveProfile(profile);}});
window.addEventListener('keyup',e=>world?.keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{draftCardActivation.clear();draftPointerGesture.clear();pointerDraws.clear();world?.keys.clear();if(world)world.edgePointer=null;if(game?.phase==='combat'){game.paused=true;render();}});document.addEventListener('visibilitychange',()=>{if(document.hidden){draftCardActivation.clear();draftPointerGesture.clear();pointerDraws.clear();if(game?.phase==='combat'){game.paused=true;render();}}});
function startGame(){rankPreview.clear();tour.finish();statistics?.checkpoint({abandoned:true});statistics?.dispose();recipeFocus=null;draftCardActivation.clear();draftPointerGesture.clear();pointerDraws.clear();if(game){profile.bestScore=Math.max(profile.bestScore,game.score||0);saveProfile(profile);}if(world){world.dispose();$('battlefield').replaceChildren();}game=new Game(data,{seed:debug?Number(params.get('seed')||42):Date.now(),waveLimit:mode,discoveries:profile.discoveries});Object.defineProperty(game,'previewPending',{get:()=>previewFlow.pending(game)});intelligenceKey=null;intelligenceIndex=null;previous=performance.now();dpsTracker=new TowerDpsTracker();dpsWave=null;statistics=new StatisticsClient(game,{enabled:!debug});world=new Battlefield($('battlefield'),game,(x,z)=>{audio.unlock();const occupied=game.grid.occupied.get(cellKey(x,z));if(game.commandMove.active){if(occupied)game.selectMove(occupied);return;}if(occupied)game.select(occupied);else if(previewFlow.pending(game))notice('Review the next wave, then open the defender draft.');else game.place(x,z);});
  game.on((type,payload)=>{if(['reroll','reserve','move','command-points'].includes(type)){draftCardActivation.clear();world.doubleTap.clear();}if(type==='wave'){dpsTracker.reset(game.combat.elapsed);dpsWave=game.round;}if(type==='hit')dpsTracker.recordHit(payload,game.combat.elapsed);audio.play(type,payload);if(type==='message')notice(payload.text);if(type==='change')render();if(type==='discover'){profile.discoveries=[...game.discoveries];saveProfile(profile);}if(['reward','won','lost'].includes(type)){profile.bestWave=Math.max(profile.bestWave,type==='reward'?payload.round:game.round-(type==='lost'?1:0));profile.bestScore=Math.max(profile.bestScore,game.score||0);if(type==='won')profile.wins++;saveProfile(profile);}if(type==='combine')notice(`${towers[payload.tower.family].name} ${towers[payload.tower.family].advanced?'forged!':`upgraded to ${balance.tiers[payload.tower.tier-1]}.`}`);if(type==='won'||type==='lost')showResult();});
  if(debug)window.__BASTIONS__={game,world,data,render};
  for(const [action,key] of [['path','showPath'],['grid','showGrid'],['ranges','showRanges']]){const button=document.querySelector(`[data-action="${action}"]`);button.classList.toggle('active',world[key]);button.setAttribute('aria-pressed',String(world[key]));}
  world.loadAssets();render();
}
try{images=makeThumbnails(data);startGame();offerTutorial();
  function frame(now){const elapsedDt=Math.max(0,(now-previous)/1000),dt=Math.min(elapsedDt,0.05);previous=now;statistics.sample(dt,elapsedDt);game.tick(dt,elapsedDt);world.update(dt);uiClock+=dt;if(uiClock>0.2){hud();uiClock=0;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
}catch(error){console.error(error);app.innerHTML=`<div class="error-screen"><h1>The battlefield could not be drawn.</h1><p>This game needs a browser with WebGL enabled. Try a recent Chrome, Edge, or Firefox with hardware acceleration turned on.</p><p>${String(error.message).replace(/[<>]/g,'')}</p><button class="primary-button" onclick="location.reload()" style="margin-top:20px">Try again</button></div>`;}

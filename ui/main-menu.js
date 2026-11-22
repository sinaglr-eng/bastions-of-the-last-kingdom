import {editSkillLoadout,generalView,skillPickerMarkup} from './commander-skills.js';
import {CommanderVault,readyChestCount} from './commander-vault.js';
import {claimAvailableAchievements} from './achievement-claim-all.js';
import {achievementsView,hallView,achievementData} from './war-table-view.js';
import {GAME_VERSION} from '../game/release.js';
import {siteUrl} from '../game/site-url.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {achievementCatalog} from '../game/core/achievements.js';
import {currentFactionData} from '../game/core/current-data.js';
import {FACTIONS} from '../game/core/factions.js';
import {rankLabel} from '../game/core/recipes.js';
import {offlinePlayMarkup,registerOfflineControl} from './offline-play.js';
import {homelandArt} from './homeland-art.js';
import {homeMenuMarkup,selectHomeFaction,replaceRunMarkup} from './home-menu.js';
import {authDialogMarkup,providerButtons} from './auth-dialog.js';
import {medalAmount} from './progression-art.js';
import {generalPageMarkup,refreshGeneralLoadout} from './general-page.js';
import {achievementCardsMarkup,achievementSummaryMarkup} from './achievement-page.js';
import {icon} from './icons.js';
import {accountBadgeMarkup,rankOverviewMarkup} from './account-progression.js';
import {allianceLogoArtwork} from './account-progression-art.js';
import {MenuMazeEditor,mazeEditorMarkup} from './menu-maze-editor.js';
export {generalControlsMarkup} from './general-controls.js';

export const escapeMenu=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeMenu,number=value=>{try{return BigInt(value||0).toLocaleString('en-US');}catch{return '0';}};
const skillsLabel=loadout=>Object.entries(loadout||{}).map(([id,level])=>`${GENERAL_SKILLS[id]?.name||id} ${rankLabel(level)}`).join(' · ')||'No skills';
export class MainMenu{
 constructor({player,app,onNew,onResume,onSave,onVolumeChange,audio,onBlueprintSaved}){
  Object.assign(this,{player,app,onNew,onResume,onSave,onVolumeChange,audio,onBlueprintSaved});this.legacyVersion='all';this.legacyMode=50;this.page='home';this.faction='crown';this.selectedFaction='crown';this.achievementKind='all';this.achievementState='all';this.offset=0;this.hallFaction='all';this.hallView='top';this.selectedSkill=null;this.skillFilter='all';this.equipmentDraft=null;
  if(import.meta.env?.PROD)registerOfflineControl();
  this.root=document.createElement('section');this.root.className='fr010-menu';this.root.id='main-menu';this.root.hidden=true;this.root.setAttribute('aria-label','Main menu');document.body.append(this.root);
  this.commanderVault=new CommanderVault({player:this.player,render:()=>this.show('general'),status:(text,error)=>this.status(text,error)});
  this.root.addEventListener('click',e=>void this.click(e));this.root.addEventListener('submit',e=>void this.submit(e));
  this.root.addEventListener('keydown',e=>{if(e.key==='Escape'&&(this.authDialog||this.replaceDialog)){e.preventDefault();e.stopPropagation();if(this.authDialog)this.closeAuth();else if(!this.starting)this.closeReplace();}});
  this.root.addEventListener('change',e=>{if(this.commanderVault.change(e))return;if(e.target.name==='hall-view'){this.hallView=e.target.value;this.offset=0;void this.loadHall('hall');return;}if(e.target.name==='legacy-version'){this.legacyVersion=e.target.value;void this.show('legacy');}if(e.target.name==='legacy-mode'){this.legacyMode=Number(e.target.value);this.legacyVersion='all';void this.show('legacy');}if(e.target.name==='faction'){this.faction=e.target.value;if(this.page==='legacy')this.legacyVersion='all';this.offset=0;void this.show(this.page);}if(e.target.name==='achievement-kind'){this.achievementKind=e.target.value;this.offset=0;void this.show('achievements');}if(e.target.name==='achievement-state'){this.achievementState=e.target.value;this.offset=0;void this.show('achievements');}});
  this.root.addEventListener('input',e=>{if(this.commanderVault.input(e))return;if(e.target.dataset.menuVolume)this.onVolumeChange(e.target.dataset.menuVolume,Number(e.target.value));});
 }
 get visible(){return !this.root.hidden;}
 status(text,error=false){const el=(this.authDialog||this.replaceDialog||this.root).querySelector('[data-menu-status]');if(el){el.textContent=text;el.classList.toggle('is-error',error);}}
 refreshAccount(){const rank=this.root.querySelector('[data-account-rank]');if(rank)rank.innerHTML=accountBadgeMarkup(this.player.profile||{});const wallet=this.root.querySelector('[data-wallet]');if(wallet)wallet.innerHTML=medalAmount(this.player.profile?.balance,'');const skillsWallet=this.root.querySelector('[data-skills-wallet]');if(skillsWallet)skillsWallet.innerHTML=medalAmount(this.player.profile?.balance);const count=this.player.readyAchievements?.length||0;for(const el of this.root.querySelectorAll('[data-ready-count]')){el.textContent=count;el.hidden=!count;el.setAttribute('aria-label',`${count} achievements ready to claim`);}const chestBadge=this.root.querySelector('[data-chest-count]');if(chestBadge){const chests=readyChestCount(this.player);chestBadge.textContent=chests;chestBadge.hidden=!chests;chestBadge.setAttribute('aria-label',`${chests} ready chests`);}}
 shell(title,content){const count=this.player.readyAchievements?.length||0,chests=readyChestCount(this.player);return `<div class="menu-shell war-shell page-${this.page}"><header class="menu-header"><button class="war-brand" data-nav="home" aria-label="Forged Alliances — Home"><img src="${homelandArt('wordmark')}" alt="Forged Alliances Tower Defense" width="420" height="128"></button><nav class="war-main-nav" aria-label="Main navigation">${[['home','Home'],['hall','Hall of Fame'],['achievements','Achievements'],['general','Commander']].map(([id,label])=>`<button data-nav="${id}" aria-current="${this.page===id||id==='hall'&&this.page==='legacy'||id==='general'&&this.page==='ranks'?'page':'false'}" ${!this.player.user&&['achievements','general'].includes(id)?'disabled title="Sign in to unlock"':''}>${!this.player.user&&['achievements','general'].includes(id)?`<img class="nav-guest-lock" alt="" width="18" height="18" src="${siteUrl('assets/ui/war-table/ui-icons/status-guest-lock.webp')}">`:''}${label}${id==='general'?`<span class="war-count" data-chest-count aria-label="${chests} ready chests" ${chests?'':'hidden'}>${chests}</span>`:''}${id==='achievements'?`<span class="war-count" data-ready-count aria-label="${count} achievements ready to claim" ${count?'':'hidden'}>${count}</span>`:''}</button>`).join('')}</nav><span class="homeland-horizon" aria-hidden="true"></span><div class="menu-account">${this.player.user?`<button class="menu-rank-link" data-open-ranks aria-label="View all commander ranks"><span data-account-rank>${accountBadgeMarkup(this.player.profile||{})}</span></button><div class="menu-player-wallet"><button class="menu-account-name" data-nav="account">${esc(this.player.user.name)}</button><button type="button" class="menu-medal-link" data-open-skills aria-label="Open Commander Skills to spend medals"><span data-wallet>${medalAmount(this.player.profile?.balance,'')}</span></button></div>`:'<button data-nav="sign-in">Sign In</button><button class="war-primary" data-nav="register">Register</button>'}</div></header>${this.page==='home'?'<h1 class="sr-only" tabindex="-1">Home</h1>':`<div class="war-title"><button class="menu-back" data-nav="home" hidden>‹ Back to Home</button><h1 tabindex="-1">${esc(title)}</h1>${this.player.game&&!['lost','won','abandoned','reset'].includes(this.player.game.phase)?'<button data-menu="continue" class="war-return">Return to defense</button>':''}</div>`}${content}<p class="menu-status" role="status" aria-live="polite" data-menu-status>${esc(this.player.status)}</p><small class="war-version">${GAME_VERSION}</small></div>`;}
 async confirmEquipmentLeave(){
  if(this.skillWrite)return false;
  if(!this.equipmentDraft||JSON.stringify(this.equipmentDraft)===JSON.stringify(this.player.profile?.equipped||[]))return true;
  return new Promise(resolve=>{const d=document.createElement('dialog');d.className='war-confirm';d.innerHTML='<h2>Save your loadout?</h2><p>Your selected skills have not been saved.</p><div><button data-choice="cancel">Cancel</button><button data-choice="discard">Discard</button><button data-choice="save">Save</button></div><p role="status"></p>';document.body.append(d);const finish=value=>{d.close();d.remove();resolve(value);};d.addEventListener('cancel',e=>{e.preventDefault();finish(false);});d.addEventListener('click',async e=>{const b=e.target.closest('[data-choice]');if(!b)return;if(b.dataset.choice==='cancel')return finish(false);if(b.dataset.choice==='save'){b.disabled=true;try{await this.player.changeProfile('equip',{equipped:this.equipmentDraft});}catch(error){d.querySelector('[role="status"]').textContent=error.message;b.disabled=false;return;}}this.equipmentDraft=null;finish(true);});d.showModal();d.querySelector('[data-choice="cancel"]').focus();});
 }
 get selectedLoadout(){return this.equipmentDraft??this.player.profile?.equipped??[];}
 async updateSkillSlot(slot, skill) {
  if (this.skillWrite || !this.player.online || !this.player.user) return;
  const next = editSkillLoadout(this.selectedLoadout, this.player.profile?.skills || {}, slot, skill);
  if (!next) return;
  this.equipmentDraft = next;
  await this.show('general');
  this.root.querySelector(`[data-skill-slot="${Math.min(slot, next.length)}"]`)?.focus({preventScroll:true});
 }

 openSkillPicker(trigger, options) {
  if (this.skillWrite || !this.player.online || !this.player.user) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'war-confirm skills-picker';
  dialog.setAttribute('aria-labelledby', 'skill-picker-title');
  dialog.innerHTML = skillPickerMarkup(this.selectedLoadout, this.player.profile?.skills || {}, options);
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
   dialog.remove();
   if (trigger.isConnected) trigger.focus({preventScroll:true});
  }, {once:true});
  dialog.addEventListener('click', event => {
   const choice = event.target.closest('button');
   if (!choice) return;
   if (choice.hasAttribute('data-picker-cancel')) return dialog.close();
   if (choice.dataset.pickerSlot === undefined) return;
   dialog.close();
   void this.updateSkillSlot(Number(choice.dataset.pickerSlot), choice.dataset.pickerSkill || null);
  });
  dialog.showModal();
 }

 async writeSkills(action, button) {
  if (this.skillWrite || !this.player.user || !this.player.online) return;
  const equipped = this.selectedLoadout;
  const skill = button.dataset.buy;
  const statusSelector = action === 'purchase' ? '[data-skill-feedback]' : '[data-loadout-feedback]';
  const status = this.root.querySelector(statusSelector);
  this.skillWrite = true;
  button.disabled = true;
  button.setAttribute('aria-busy','true');
  if (status) {
   status.hidden = false;
   status.textContent = action === 'purchase' ? 'Purchasing…' : 'Saving loadout…';
  }
  try {
   await this.player.changeProfile(action, action === 'purchase' ? {skill} : {equipped});
   if (action === 'equip' && this.equipmentDraft === equipped) this.equipmentDraft = null;
   if (action === 'purchase') this.selectedSkill = skill;
   await this.show('general', {
    skillFeedback: action === 'purchase' ? `${GENERAL_SKILLS[skill].name} · Rank ${rankLabel(this.player.profile.skills[skill])} purchased.` : '',
    loadoutFeedback: action === 'equip' ? 'Loadout saved for your next defense.' : ''
   });
   const target = action === 'purchase' ? '[data-buy]:enabled, #skills-detail-title' : '[data-skill-slot]';
   this.root.querySelector(target)?.focus({preventScroll:true});
  } catch (error) {
   if (status?.isConnected) status.textContent = error.message;
   else this.status(error.message,true);
  } finally {
   this.skillWrite = false;
   if (button.isConnected) {
    button.disabled = false;
    button.removeAttribute('aria-busy');
   }
  }
 }
 async show(page='home',{skillFeedback='',loadoutFeedback=''}={}){
  const previousPage=this.page;if(previousPage==='general'&&page!=='general'&&!await this.confirmEquipmentLeave())return;
  if(['general','achievements','account','ranks'].includes(page)&&!this.player.user){await this.show('sign-in');this.status('Sign in to build your legacy. Guest play is always available.');return;}
  if(['sign-in','register','reset-request','reset-password'].includes(page)){
   const returnFocus=this.authReturnFocus||document.activeElement;
   if(!this.authDialog){await this.show('home');this.authReturnFocus=returnFocus?.isConnected?returnFocus:this.root.querySelector(`[data-nav="${returnFocus?.dataset?.nav==='register'?'register':'sign-in'}"]`);this.authDialog=document.createElement('dialog');this.authDialog.className='auth-dialog';this.authDialog.setAttribute('aria-labelledby','auth-title');this.root.append(this.authDialog);const dialog=this.authDialog;dialog.addEventListener('cancel',e=>{e.preventDefault();this.closeAuth();});dialog.addEventListener('close',()=>{if(this.authDialog===dialog)this.closeAuth();});}
   this.page=page;this.authDialog.innerHTML=authDialogMarkup(page,this.player.authOptions,this.player.mailMode);if(!this.authDialog.open)this.authDialog.showModal();this.authDialog.querySelector('#auth-title').focus({preventScroll:true});return;
  }
  const libraryScroll=this.root.querySelector('.skills-list')?.scrollTop||0;
  this.closeAuth(false);this.closeReplace(false);
  if(page==='legacy'&&this.faction==='all')this.faction='crown';
  if(page!=='legacy'&&this.faction==='legacy')this.faction='crown';this.page=page;this.app.inert=true;this.root.hidden=false;if(this.player.game)this.player.game.paused=true;
  let title='Choose your allegiance.',content='';
  if(page==='home'){
   let saved=null;try{saved=await this.player.store.get(this.player.owner);}catch{}
   this.cloudUnavailable=false;if(this.player.user&&this.player.online&&(!saved||['lost','won','abandoned','reset'].includes(saved.meta.phase)))try{const remote=(await this.player.request('/player/active')).run;if(remote&&remote.outcome==='playing'&&!(saved&&['lost','won','abandoned','reset'].includes(saved.meta.phase)&&saved.meta.runId===remote.id))saved={meta:{runId:remote.id,phase:'playing',factionId:remote.factionId,round:remote.round||1},snapshot:remote.snapshot,savedAt:remote.updatedAt};}catch{this.cloudUnavailable=true;this.status('Cloud continuation unavailable. Your local save is preserved.',true);}
   this.displayedSave=saved;const active=saved&&!['lost','won','abandoned','reset'].includes(saved.meta.phase);this.hasSave=!!active;
   content=homeMenuMarkup({player:this.player,saved,selectedFaction:this.selectedFaction,cloudUnavailable:this.cloudUnavailable});
   if(import.meta.env?.PROD)content+=offlinePlayMarkup(this.player);
  }else if(page==='general'){
   title='Commander';content=this.commanderVault.markup(generalView(this.player.profile,!!this.player.user&&this.player.online,{selected:this.selectedSkill,filter:this.skillFilter,equipped:this.selectedLoadout,feedback:skillFeedback,loadoutFeedback}));
  }else if(page==='ranks'){
   title='Commander Ranks';content=`<section class="commander-ranks-page"><p>Earn XP through completed waves, boss victories and claimed achievements. Your current rank is highlighted below.</p>${rankOverviewMarkup(this.player.profile||{},{expanded:true})}<button class="war-primary" data-nav="general">Back to Commander</button></section>`;
  }else if(page==='maze'){
   title='Maze Builder';content=mazeEditorMarkup();
  }else if(page==='achievements'){
   title='Achievements';content=achievementsView(this.player,{faction:this.faction,kind:this.achievementKind,status:this.achievementState,offset:this.offset,focusId:this.focusAchievement});
  }else if(page==='hall'||page==='legacy'){
   title=page==='hall'?'Hall of Fame':'Legacy records';content=`<p>One shared competition. Earn medals, strengthen your commander and push your best score further.</p><div class="menu-filters">${this.factionSelector(page==='legacy')}${page==='legacy'?`<label>Campaign<select name="legacy-mode"><option value="50" ${this.legacyMode===50?'selected':''}>50 waves</option><option value="10" ${this.legacyMode===10?'selected':''}>10 waves</option></select></label><label>Version<select name="legacy-version"><option value="all">All Legacy versions</option></select></label>`:''}<button data-nav="${page==='hall'?'legacy':'hall'}">${page==='hall'?'Legacy records':'Current standings'}</button></div><div data-hall-content><p>Loading standings…</p></div><div data-personal-content></div>`;
  }else if(page==='account'){
   title='Your account';content=this.accountSettingsMarkup();
  }
  if(page==='hall')content='<div data-hall-content><div class="war-loading" role="status">Loading verified records…</div></div>';
  if(this.page!==page)return;
  this.mazeEditor?.unmount();this.root.innerHTML=this.shell(title,content);const library=this.root.querySelector('.skills-list');if(library)library.scrollTop=libraryScroll;if(page==='maze'){this.mazeEditor??=new MenuMazeEditor({storage:globalThis.localStorage,onSaved:plan=>this.onBlueprintSaved?.(plan)});this.mazeEditor.mount(this.root.querySelector('.home-maze-workshop'));}if(previousPage!==page)this.root.scrollTop=0;this.root.querySelector('h1')?.focus({preventScroll:true});if(page==='hall'||page==='legacy')void this.loadHall(page);
 }
 achievementProgress(a){return achievementData(this.player,this.faction).progress(a);}
 socialMarkup(page){
  if(!['sign-in','register'].includes(page))return '';
  return providerButtons(this.player.authOptions)+'<p>Your first provider sign-in creates your player profile automatically.</p>';
 }
 accountSettingsMarkup(){return this.player.user?`<section class="menu-account-settings"><h2>Player account</h2><button data-menu="sign-out">Sign Out</button><form class="menu-form" data-form="nickname"><label>Public nickname<input name="name" value="${esc(this.player.user.name)}" autocomplete="nickname" maxlength="24" required></label><button type="submit">Save Nickname</button></form><p>Use the same sign-in provider on another device to restore your progress.</p><details class="menu-reset"><summary>Delete player account</summary><p>This permanently removes this account, saved games, scores, achievements and medals. Your Google, Apple or Facebook account remains available.</p><form class="menu-form" data-form="delete-account"><label>Type DELETE to confirm<input name="confirmation" autocomplete="off" pattern="DELETE" required></label><button type="submit">Delete Player Account</button></form></details><a href="${siteUrl('privacy.html')}" target="_blank" rel="noopener">Privacy & account data</a></section>`:'';}
 factionSelector(includeLegacy=false){return `<label>Faction<select name="faction">${includeLegacy?`<option value="legacy" ${this.faction==='legacy'?'selected':''}>Before factions</option>`:''}${FACTIONS.map(f=>`<option value="${f.id}" ${f.id===this.faction?'selected':''}>${f.name}</option>`).join('')}</select></label>`;}
 async loadHall(page){
  if(page==='hall'){const key=++this.hallRequest||1;this.hallRequest=key;try{const result=await this.player.request(`/player/hall?faction=${this.hallFaction}&offset=${this.offset}&view=${this.hallView}`);if(this.page!==page||this.hallRequest!==key)return;this.offset=result.offset;this.root.querySelector('[data-hall-content]').innerHTML=hallView(result,{guest:!this.player.user,view:this.hallView});}catch(error){if(this.page===page&&this.hallRequest===key)this.root.querySelector('[data-hall-content]').innerHTML='<section class="war-empty"><h2>Records unavailable</h2><p>'+esc(error.message)+'</p><button data-retry-hall>Retry</button></section>';}return;}

  if(page==='hall'&&this.faction==='legacy')this.faction='crown';
  try{const result=page==='legacy'?await this.player.request(`/leaderboard?mode=${this.legacyMode}&version=${encodeURIComponent(this.legacyVersion)}${this.faction==='legacy'?'':'&faction='+this.faction}`):await this.player.request(`/player/hall?faction=${this.faction}&offset=${this.offset}`);if(this.page!==page)return;if(page==='legacy'){const select=this.root.querySelector('[name="legacy-version"]');select.innerHTML='<option value="all">All Legacy versions</option>'+[...new Set(result.versions||[])].map(v=>`<option value="${esc(v)}" ${v===this.legacyVersion?'selected':''}>${esc(v)}</option>`).join('');}const rows=result.top||[],hallPagination=page==='hall'?`<nav class="menu-pagination"><button data-page="${Math.max(0,this.offset-25)}" ${this.offset===0?'disabled':''}>Previous</button><span>Ranks ${rows.length?this.offset+1:0}–${this.offset+rows.length}</span><button data-page="${this.offset+25}" ${rows.length<25?'disabled':''}>Next</button></nav>`:'';this.root.querySelector('[data-hall-content]').innerHTML=rows.length?`<div class="menu-table-wrap"><table><thead><tr><th>Rank</th><th>Commander</th><th>Score</th><th>Waves</th><th>General</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.rank}</td><td>${esc(r.name)}</td><td>${number(r.score)}</td><td>${r.highestWave??r.wavesSurvived}</td><td>${page==='legacy'?'Legacy':esc(skillsLabel(r.loadout))}</td></tr>`).join('')}</tbody></table></div>${result.own?`<p>Your best position: ${result.own.rank} · ${number(result.own.score)} score · Wave ${result.own.highestWave}</p>`:''}${hallPagination}`:'<p>No completed verified scores in this category yet.</p>'+hallPagination;
   if(this.player.user&&page==='hall'){const stats=await this.player.request('/player/statistics');if(this.page===page)this.root.querySelector('[data-personal-content]').innerHTML=`<h2>Your records</h2><div class="menu-records">${[['Best score',number(stats.bestScore)],['Highest wave',stats.highestWave||0],['Runs played',stats.played],['Campaign clears',stats.campaignClears||0],['Boss kills',stats.bossKills||0],['Champions discovered',(this.player.profile?.grants||[]).filter(g=>g.id.startsWith('champion:')).length]].map(([k,v])=>`<div><strong>${v}</strong><span>${k}</span></div>`).join('')}</div>`;}
  }catch(error){if(this.page===page)this.root.querySelector('[data-hall-content]').textContent='Standings are unavailable. '+error.message;}
 }
 closeAuth(restoreFocus=true){const dialog=this.authDialog;if(!dialog)return;this.authDialog=null;dialog.close();dialog.remove();this.page='home';const previous=this.authReturnFocus;this.authReturnFocus=null;if(restoreFocus)(previous?.isConnected?previous:this.root.querySelector('[data-nav="sign-in"]'))?.focus({preventScroll:true});}
 closeReplace(restoreFocus=true){const dialog=this.replaceDialog;if(!dialog)return;this.replaceDialog=null;dialog.close();dialog.remove();this.pendingNewFaction=null;if(restoreFocus)this.root.querySelector('[data-menu="new"]')?.focus({preventScroll:true});}
 requestNewRun(){
  if(this.starting||this.replaceDialog)return;
  // The Home card already resolved local/cloud continuation. Open directly in
  // the tap handler; a second IndexedDB read can stall after iPad suspension.
  const game=this.player.game,saved=this.displayedSave||(game?{meta:{phase:game.phase,factionId:game.factionId,round:game.round,elapsedSeconds:game.elapsedSeconds}}:null);
  if(!saved||['lost','won','reset'].includes(saved.meta.phase))return this.startNewRun(this.selectedFaction);
  this.pendingNewFaction=this.selectedFaction;
  const dialog=document.createElement('dialog');this.replaceDialog=dialog;dialog.className='menu-replace-dialog';dialog.setAttribute('aria-labelledby','replace-title');dialog.innerHTML=replaceRunMarkup(saved,this.pendingNewFaction);this.root.append(dialog);
  dialog.addEventListener('cancel',e=>{e.preventDefault();if(!this.starting)this.closeReplace();});dialog.addEventListener('close',()=>{if(this.replaceDialog===dialog)this.closeReplace();});
  dialog.showModal();dialog.querySelector('[data-menu="cancel-replace"]').focus({preventScroll:true});
 }
 async confirmNewRun(){const factionId=this.pendingNewFaction,dialog=this.replaceDialog;if(!factionId||!dialog||this.starting)return;await this.startNewRun(factionId,{replace:true});if(this.replaceDialog===dialog)this.closeReplace(false);}
 async startNewRun(factionId,{replace=false}={}){if(this.starting)return;this.starting=true;this.root.setAttribute('aria-busy','true');const dialog=this.replaceDialog,buttons=[...(dialog?.querySelectorAll('button')||[])];for(const button of buttons)button.disabled=true;if(dialog)dialog.setAttribute('aria-busy','true');this.status('Preparing your alliance… Please wait.');try{await this.onNew({factionId,replace});}finally{this.starting=false;this.root.removeAttribute('aria-busy');if(dialog){dialog.removeAttribute('aria-busy');for(const button of buttons)button.disabled=false;}}}
 hide(){this.closeReplace(false);this.closeAuth(false);this.root.hidden=true;this.app.inert=false;}
 async continue(){
  const c=await this.player.continuation();if(!c){this.status('No saved run is available. Start a new game.');return;}
  if(c.conflict){this.conflict=c;this.root.querySelector('h1').insertAdjacentHTML('afterend','<div class="menu-conflict" role="alert"><p>The cloud save changed on another device. Your local save has been preserved. Choose the cloud continuation, or cancel and keep the local save untouched.</p><button data-menu="cloud">Use Cloud Save</button><button data-menu="cancel-conflict">Cancel</button></div>');return;}
  const game=await this.player.resume(c);await this.onResume(game);this.hide();
 }
 async click(event){
  const b=event.target.closest('button');if(!b||b.disabled||this.starting||this.skillWrite)return;
  // Do not yield to unrelated async handlers before opening the native dialog.
  if(b.dataset.menu==='new'){try{await this.requestNewRun();}catch(error){this.status(error.message,true);}return;}
  if(await this.commanderVault.click(event))return;
  if(b.hasAttribute('data-auth-close')){this.closeAuth();return;}
  try{
   if(b.hasAttribute('data-open-skills')){this.commanderVault.tab='skills';await this.show('general');return;}
   if(b.hasAttribute('data-claim-all')){if(this.claimingAll)return;this.claimingAll=true;const top=this.root.scrollTop;for(const button of this.root.querySelectorAll('[data-claim],[data-claim-all]'))button.disabled=true;b.setAttribute('aria-busy','true');try{const result=await claimAvailableAchievements(this.player,({claimed,total})=>{if(b.isConnected)b.textContent=`Claiming ${claimed} / ${total}…`;});await this.show('achievements');this.root.scrollTop=top;this.status(`${result.claimed} ${result.claimed===1?'achievement':'achievements'} claimed. Medals and XP added to your account.`);}catch(error){await this.show('achievements');this.root.scrollTop=top;this.status(`${error.claimedCount?error.claimedCount+' rewards claimed. ':''}${error.message} Any remaining rewards are still ready to claim.`,true);}finally{this.claimingAll=false;}return;}
   if(b.hasAttribute('data-open-ranks')){await this.show('ranks');return;}
   if(b.hasAttribute('data-retry-hall')){await this.loadHall('hall');return;}
   if(b.hasAttribute('data-ready-rewards')){const first=this.player.readyAchievements?.find(g=>g.factionId);if(first)this.faction=first.factionId;this.achievementState='ready';this.achievementKind='all';this.offset=0;await this.show('achievements');return;}
   if(b.hasAttribute('data-clear-filters')){this.achievementKind='all';this.achievementState='all';this.offset=0;await this.show('achievements');return;}
   if(b.dataset.category){this.achievementKind=b.dataset.category;this.offset=0;this.focusAchievement=null;await this.show('achievements');return;}
   if(b.dataset.filterFaction){this.offset=0;this.focusAchievement=null;if(this.page==='hall'){this.hallFaction=b.dataset.filterFaction;await this.loadHall('hall');}else{this.faction=b.dataset.filterFaction;await this.show('achievements');}return;}
   if (b.dataset.selectSkill) {
    this.selectedSkill = b.dataset.selectSkill;
    await this.show('general');
    const detail = this.root.querySelector('#skills-detail-title');
    if (matchMedia('(max-width: 740px)').matches) {
     detail?.focus({preventScroll:true});
     detail?.scrollIntoView({block:'start'});
    } else this.root.querySelector(`[data-select-skill="${this.selectedSkill}"]`)?.focus({preventScroll:true});
    return;
   }
   if (b.hasAttribute('data-skill-library-back')) {
    const library = this.root.querySelector('#skills-library-title');
    library?.focus({preventScroll:true});
    library?.scrollIntoView({block:'start'});
    return;
   }
   if (b.dataset.skillFilter) {
    this.skillFilter = b.dataset.skillFilter;
    this.selectedSkill = null;
    const list = this.root.querySelector('.skills-list');
    if (list) list.scrollTop = 0;
    await this.show('general');
    this.root.querySelector(`[data-skill-filter="${this.skillFilter}"]`)?.focus({preventScroll:true});
    return;
   }
   if (b.dataset.skillSlot !== undefined) {
    this.openSkillPicker(b, {slot:Number(b.dataset.skillSlot)});
    return;
   }
   if (b.dataset.equipSkill) {
    const skill = b.dataset.equipSkill;
    if (this.selectedLoadout.length === 3) this.openSkillPicker(b, {skill});
    else await this.updateSkillSlot(this.selectedLoadout.length, skill);
    return;
   }
   if(b.dataset.claim){if(this.claimingAll)return;b.disabled=true;const label=b.innerHTML;b.textContent='Claiming…';b.setAttribute('aria-busy','true');const top=this.root.scrollTop;try{await this.player.claimAchievement(b.dataset.claim);await this.show('achievements');this.root.scrollTop=top;this.status('Reward claimed. Medals added to your treasury.');}finally{if(b.isConnected){b.disabled=false;b.removeAttribute('aria-busy');b.innerHTML=label;}}return;}
   if(b.dataset.newFaction){const faction=FACTIONS.find(f=>f.id===b.dataset.newFaction);if(!faction)return;this.selectedFaction=faction.id;selectHomeFaction(this.root.querySelector('[data-faction-picker]'),faction);return;}if(b.dataset.provider){b.disabled=true;await this.onSave();const url=await this.player.beginSocial(b.dataset.provider,new URL(siteUrl(''),location.href).href);location.assign(url);return;}if(b.dataset.nav){this.offset=0;await this.show(b.dataset.nav);return;}if(b.dataset.page!==undefined){if(this.page==='hall')this.hallView='top';this.focusAchievement=null;this.offset=Number(b.dataset.page);await this.show(this.page);this.root.scrollTop=0;return;}if(b.dataset.buy){await this.writeSkills('purchase',b);return;}
   const action=b.dataset.menu;
   if(action==='rank-chests'){this.commanderVault.tab='chests';await this.show('general');return;}
   if(action==='confirm-new')await this.confirmNewRun();
   else if(action==='cancel-replace')this.closeReplace();
   else if(action==='continue'){
    if(this.page!=='general'||await this.confirmEquipmentLeave())await this.continue();
   }
   else if(action==='cloud'){const game=await this.player.resume({remote:this.conflict.remote});await this.onResume(game);this.hide();}
   else if(action==='cancel-conflict'){this.conflict=null;await this.show('home');}
   else if(action==='sign-out'){await this.onSave();await this.player.auth('sign-out',{});await this.show('home');}
   else if(action==='refresh-account'){await this.player.initialize();await this.show('home');}
  }catch(error){if(b.dataset.provider)b.disabled=false;this.status(error.message,true);}
 }
 async submit(event){
  event.preventDefault();
  const form=event.target,type=form.dataset.form,button=form.querySelector('[type="submit"]');
  if(type==='equipment'){if(button&&!button.disabled)await this.writeSkills('equip',button);return;}
  const body=new FormData(form);if(button)button.disabled=true;
  try{const callbackURL=new URL(siteUrl(''),location.href).href;
   if(['sign-in','register','reset-request'].includes(type)&&!this.player.authOptions?.emailPassword)throw Error('Email sign-in is not available yet.');
   if(type==='nickname'){await this.player.request('/player/nickname',{name:body.get('name')});await this.player.initialize();await this.show('account');this.status('Nickname saved.');}
   else if(type==='delete-account'){if(body.get('confirmation')!=='DELETE')throw Error('Type DELETE to confirm account removal.');await this.player.deleteAccount();await this.show('home');}
   else if(type==='sign-in'){await this.player.auth('sign-in/email',{email:body.get('email'),password:body.get('password')});await this.show('home');}
   else if(type==='register'){await this.player.auth('sign-up/email',{name:body.get('name'),email:body.get('email'),password:body.get('password'),callbackURL});this.status('Account created. Open the verification link sent to your email, then sign in.');form.reset();}
   else if(type==='reset-request'){await this.player.auth('request-password-reset',{email:body.get('email'),redirectTo:callbackURL+'?reset=1'});this.status('If an account exists, a recovery link has been prepared.');}
   else if(type==='reset-password'){const token=new URLSearchParams(location.search).get('token');if(!token)throw Error('Open a valid password recovery link.');await this.player.auth('reset-password',{token,newPassword:body.get('password')});await this.show('sign-in');this.status('Password changed. Sign in with your new password.');}
  }catch(error){this.status(error.message,true);}finally{if(button?.isConnected)button.disabled=false;}
 }
}


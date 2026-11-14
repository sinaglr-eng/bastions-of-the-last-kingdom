import {GAME_VERSION} from '../game/release.js';
import {siteUrl} from '../game/site-url.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {achievementCatalog} from '../game/core/achievements.js';
import {currentFactionData} from '../game/core/current-data.js';
import {FACTIONS} from '../game/core/factions.js';
import {rankLabel} from '../game/core/recipes.js';
import {homeMenuMarkup,factionPickerMarkup,replaceRunMarkup} from './home-menu.js';
import {authDialogMarkup,providerButtons} from './auth-dialog.js';
import {medalAmount} from './progression-art.js';
import {generalPageMarkup,refreshGeneralLoadout} from './general-page.js';
import {achievementCardsMarkup,achievementSummaryMarkup} from './achievement-page.js';
import {icon} from './icons.js';
export {generalControlsMarkup} from './general-controls.js';

export const escapeMenu=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeMenu,number=value=>{try{return BigInt(value||0).toLocaleString('en-US');}catch{return '0';}};
const skillsLabel=loadout=>Object.entries(loadout||{}).map(([id,level])=>`${GENERAL_SKILLS[id]?.name||id} ${rankLabel(level)}`).join(' · ')||'No skills';
export class MainMenu{
 constructor({player,app,onNew,onResume,onSave,onVolumeChange,audio}){
  Object.assign(this,{player,app,onNew,onResume,onSave,onVolumeChange,audio});this.legacyVersion='all';this.legacyMode=50;this.page='home';this.faction='crown';this.selectedFaction='crown';this.achievementKind='all';this.achievementState='all';this.offset=0;
  this.root=document.createElement('section');this.root.className='fr010-menu';this.root.id='main-menu';this.root.hidden=true;this.root.setAttribute('aria-label','Main menu');document.body.append(this.root);
  this.root.addEventListener('click',e=>void this.click(e));this.root.addEventListener('submit',e=>void this.submit(e));
  this.root.addEventListener('keydown',e=>{if(e.key==='Escape'&&(this.authDialog||this.replaceDialog)){e.preventDefault();e.stopPropagation();if(this.authDialog)this.closeAuth();else this.closeReplace();}});
  this.root.addEventListener('change',e=>{if(e.target.name==='equipped'){if(!refreshGeneralLoadout(this.root,this.player.profile,e.target))this.status('Equip up to three skills. Remove one before adding another.',true);else this.status('Equipment selection updated. Save to apply.');return;}if(e.target.name==='legacy-version'){this.legacyVersion=e.target.value;void this.show('legacy');}if(e.target.name==='legacy-mode'){this.legacyMode=Number(e.target.value);this.legacyVersion='all';void this.show('legacy');}if(e.target.name==='faction'){this.faction=e.target.value;if(this.page==='legacy')this.legacyVersion='all';this.offset=0;void this.show(this.page);}if(e.target.name==='achievement-kind'){this.achievementKind=e.target.value;this.offset=0;void this.show('achievements');}if(e.target.name==='achievement-state'){this.achievementState=e.target.value;this.offset=0;void this.show('achievements');}});
  this.root.addEventListener('input',e=>{if(e.target.dataset.menuVolume)this.onVolumeChange(e.target.dataset.menuVolume,Number(e.target.value));});
 }
 get visible(){return !this.root.hidden;}
 status(text,error=false){const el=(this.authDialog||this.root).querySelector('[data-menu-status]');if(el){el.textContent=text;el.classList.toggle('is-error',error);}}
 shell(title,content){return `<div class="menu-shell"><header class="menu-header"><img src="${siteUrl('assets/branding/forged-alliances-v3/wordmark.svg')}" alt="Forged Alliances TD" width="650" height="160"><span class="menu-version">${GAME_VERSION}</span><div class="menu-account">${this.player.user?`<button class="menu-account-name" data-nav="account">${esc(this.player.user.name)}</button>${medalAmount(this.player.profile?.balance)}<button data-menu="sign-out">Sign Out</button>`:'<button data-nav="sign-in">Sign In</button><button class="menu-register" data-nav="register">Register</button>'}</div></header>${this.page!=='home'?`<button class="menu-back" data-nav="home"><span class="menu-back-crest">${icon('compass')}</span><span>Main Menu</span></button>`:'<p class="menu-chapter">The war table</p>'}<h1 tabindex="-1">${esc(title)}</h1>${content}<p class="menu-status" role="status" aria-live="polite" data-menu-status>${esc(this.player.status)}</p></div>`;}
 async show(page='home'){
  const previousPage=this.page;
  if(['general','achievements','account'].includes(page)&&!this.player.user){await this.show('sign-in');this.status('Sign in to build your legacy. Guest play is always available.');return;}
  if(['sign-in','register','reset-request','reset-password'].includes(page)){
   const returnFocus=this.authReturnFocus||document.activeElement;
   if(!this.authDialog){await this.show('home');this.authReturnFocus=returnFocus?.isConnected?returnFocus:this.root.querySelector(`[data-nav="${returnFocus?.dataset?.nav==='register'?'register':'sign-in'}"]`);this.authDialog=document.createElement('dialog');this.authDialog.className='auth-dialog';this.authDialog.setAttribute('aria-labelledby','auth-title');this.root.append(this.authDialog);const dialog=this.authDialog;dialog.addEventListener('cancel',e=>{e.preventDefault();this.closeAuth();});dialog.addEventListener('close',()=>{if(this.authDialog===dialog)this.closeAuth();});}
   this.page=page;this.authDialog.innerHTML=authDialogMarkup(page,this.player.authOptions,this.player.mailMode);if(!this.authDialog.open)this.authDialog.showModal();this.authDialog.querySelector('#auth-title').focus({preventScroll:true});return;
  }
  this.closeAuth(false);this.closeReplace(false);
  if(page!=='legacy'&&this.faction==='legacy')this.faction='crown';this.page=page;this.app.inert=true;this.root.hidden=false;if(this.player.game)this.player.game.paused=true;
  let title='Choose your allegiance.',content='';
  if(page==='home'){
   let saved=null;try{saved=await this.player.store.get(this.player.owner);}catch{}
   const active=saved&&!['lost','won'].includes(saved.meta.phase);this.hasSave=!!active;
   content=homeMenuMarkup({player:this.player,saved,selectedFaction:this.selectedFaction});
  }else if(page==='general'){
   title='Your general';content=generalPageMarkup(this.player.profile,!!this.player.user);
  }else if(page==='achievements'){
   title='Your achievements';const d=currentFactionData(this.faction),owned=new Map((this.player.profile?.grants||[]).map(g=>[g.id,g])),pending=new Set(this.player.game?.accountId?this.player.game.progress.grants().map(g=>g.id):[]),catalog=achievementCatalog(d,{streakBest:Math.max(this.player.profile?.progress?.[this.faction]?.streakBest||0,this.player.game?.factionId===this.faction?this.player.game.progress.streakBest:0)}),all=catalog.filter(a=>(this.achievementKind==='all'||a.kind===this.achievementKind)&&(this.achievementState==='all'||this.achievementState==='earned'&&owned.has(a.id)||this.achievementState==='unearned'&&!owned.has(a.id)));
   const earned=catalog.filter(a=>owned.has(a.id)).length;
   content=achievementSummaryMarkup({earned,total:catalog.length,balance:this.player.profile?.balance||0,factionName:FACTIONS.find(f=>f.id===this.faction)?.name})+`<div class="menu-filters achievement-filters">${this.factionSelector()}<label>Category<select name="achievement-kind">${['all','champion','boss','collection','mastery','campaign','streak','endless'].map(k=>`<option value="${k}" ${k===this.achievementKind?'selected':''}>${k==='all'?'All categories':k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select></label><label>Status<select name="achievement-state">${['all','earned','unearned'].map(k=>`<option value="${k}" ${k===this.achievementState?'selected':''}>${k==='all'?'All achievements':k==='earned'?'Earned':'To discover'}</option>`).join('')}</select></label><p>${all.length} achievements${this.player.game?.factionId===this.faction?` · Flawless streak: ${this.player.game.progress.streak}`:''}</p></div>`+achievementCardsMarkup({data:d,rows:all.slice(this.offset,this.offset+24),owned,pending,progress:a=>this.achievementProgress(a,owned,pending)})+`<nav class="menu-pagination"><button data-page="${Math.max(0,this.offset-24)}" ${this.offset===0?'disabled':''}>Previous</button><span>${all.length?this.offset+1:0}–${Math.min(this.offset+24,all.length)} / ${all.length}</span><button data-page="${this.offset+24}" ${this.offset+24>=all.length?'disabled':''}>Next</button></nav><p class="achievement-rules">Flawless waves must be consecutive. Any keep health loss resets the current streak. Each reward can be earned once.</p>`;
  }else if(page==='hall'||page==='legacy'){
   title=page==='hall'?'Hall of Fame':'Legacy records';content=`<p>One shared competition. Earn medals, strengthen your general and push your best score further.</p><div class="menu-filters">${this.factionSelector(page==='legacy')}${page==='legacy'?`<label>Campaign<select name="legacy-mode"><option value="50" ${this.legacyMode===50?'selected':''}>50 waves</option><option value="10" ${this.legacyMode===10?'selected':''}>10 waves</option></select></label><label>Version<select name="legacy-version"><option value="all">All Legacy versions</option></select></label>`:''}<button data-nav="${page==='hall'?'legacy':'hall'}">${page==='hall'?'Legacy records':'Current standings'}</button></div><div data-hall-content><p>Loading standings…</p></div><div data-personal-content></div>`;
  }else if(page==='account'){
   title='Your account';content=this.accountSettingsMarkup();
  }
  this.root.innerHTML=this.shell(title,content);if(previousPage!==page)this.root.scrollTop=0;this.root.querySelector('h1')?.focus({preventScroll:true});if(page==='hall'||page==='legacy')void this.loadHall(page);
 }
 achievementProgress(a,owned,pending){
  const ids=new Set([...owned.keys(),...pending]),f=this.faction,run=this.player.game?.factionId===f?this.player.game.progress:null,p=this.player.profile?.progress?.[f]||{};
  if(ids.has(a.id))return a.target;
  if(a.kind==='collection')return Math.min(a.target,[...ids].filter(id=>id.startsWith(`champion:${f}:`)).length);
  if(a.id===`boss-collection:${f}`)return [...ids].filter(id=>id.startsWith(`boss:${f}:`)).length;
  if(a.kind==='streak')return Math.min(a.target,Math.max(p.streakBest||0,run?.streakBest||0));
  if(a.kind==='endless')return Math.min(a.target,Math.max(...Object.values(this.player.profile?.progress||{}).map(v=>v.highestWave||0),this.player.game?.progress.highestWave||0,0));
  return 0;
 }
 socialMarkup(page){
  if(!['sign-in','register'].includes(page))return '';
  return providerButtons(this.player.authOptions)+'<p>Your first provider sign-in creates your player profile automatically.</p>';
 }
 accountSettingsMarkup(){return this.player.user?`<section class="menu-account-settings"><h2>Player account</h2><form class="menu-form" data-form="nickname"><label>Public nickname<input name="name" value="${esc(this.player.user.name)}" autocomplete="nickname" maxlength="24" required></label><button type="submit">Save Nickname</button></form><p>Use the same sign-in provider on another device to restore your progress.</p><details class="menu-reset"><summary>Delete player account</summary><p>This permanently removes this account, saved games, scores, achievements and medals. Your Google, Apple or Facebook account remains available.</p><form class="menu-form" data-form="delete-account"><label>Type DELETE to confirm<input name="confirmation" autocomplete="off" pattern="DELETE" required></label><button type="submit">Delete Player Account</button></form></details><a href="${siteUrl('privacy.html')}" target="_blank" rel="noopener">Privacy & account data</a></section>`:'';}
 factionSelector(includeLegacy=false){return `<label>Faction<select name="faction">${includeLegacy?`<option value="legacy" ${this.faction==='legacy'?'selected':''}>Before factions</option>`:''}${FACTIONS.map(f=>`<option value="${f.id}" ${f.id===this.faction?'selected':''}>${f.name}</option>`).join('')}</select></label>`;}
 async loadHall(page){
  if(page==='hall'&&this.faction==='legacy')this.faction='crown';
  try{const result=page==='legacy'?await this.player.request(`/leaderboard?mode=${this.legacyMode}&version=${encodeURIComponent(this.legacyVersion)}${this.faction==='legacy'?'':'&faction='+this.faction}`):await this.player.request(`/player/hall?faction=${this.faction}&offset=${this.offset}`);if(this.page!==page)return;if(page==='legacy'){const select=this.root.querySelector('[name="legacy-version"]');select.innerHTML='<option value="all">All Legacy versions</option>'+[...new Set(result.versions||[])].map(v=>`<option value="${esc(v)}" ${v===this.legacyVersion?'selected':''}>${esc(v)}</option>`).join('');}const rows=result.top||[],hallPagination=page==='hall'?`<nav class="menu-pagination"><button data-page="${Math.max(0,this.offset-25)}" ${this.offset===0?'disabled':''}>Previous</button><span>Ranks ${rows.length?this.offset+1:0}–${this.offset+rows.length}</span><button data-page="${this.offset+25}" ${rows.length<25?'disabled':''}>Next</button></nav>`:'';this.root.querySelector('[data-hall-content]').innerHTML=rows.length?`<div class="menu-table-wrap"><table><thead><tr><th>Rank</th><th>Commander</th><th>Score</th><th>Waves</th><th>General</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.rank}</td><td>${esc(r.name)}</td><td>${number(r.score)}</td><td>${r.highestWave??r.wavesSurvived}</td><td>${page==='legacy'?'Legacy':esc(skillsLabel(r.loadout))}</td></tr>`).join('')}</tbody></table></div>${result.own?`<p>Your best position: ${result.own.rank} · ${number(result.own.score)} score · Wave ${result.own.highestWave}</p>`:''}${hallPagination}`:'<p>No completed verified scores in this category yet.</p>'+hallPagination;
   if(this.player.user&&page==='hall'){const stats=await this.player.request('/player/statistics');if(this.page===page)this.root.querySelector('[data-personal-content]').innerHTML=`<h2>Your records</h2><div class="menu-records">${[['Best score',number(stats.bestScore)],['Highest wave',stats.highestWave||0],['Runs played',stats.played],['Campaign clears',stats.campaignClears||0],['Boss kills',stats.bossKills||0],['Champions discovered',(this.player.profile?.grants||[]).filter(g=>g.id.startsWith('champion:')).length]].map(([k,v])=>`<div><strong>${v}</strong><span>${k}</span></div>`).join('')}</div>`;}
  }catch(error){if(this.page===page)this.root.querySelector('[data-hall-content]').textContent='Standings are unavailable. '+error.message;}
 }
 closeAuth(restoreFocus=true){const dialog=this.authDialog;if(!dialog)return;this.authDialog=null;dialog.close();dialog.remove();this.page='home';const previous=this.authReturnFocus;this.authReturnFocus=null;if(restoreFocus)(previous?.isConnected?previous:this.root.querySelector('[data-nav="sign-in"]'))?.focus({preventScroll:true});}
 closeReplace(restoreFocus=true){const dialog=this.replaceDialog;if(!dialog)return;this.replaceDialog=null;dialog.close();dialog.remove();this.pendingNewFaction=null;if(restoreFocus)this.root.querySelector('[data-menu="new"]')?.focus({preventScroll:true});}
 async startNewRun(factionId){if(this.starting)return;this.starting=true;this.root.setAttribute('aria-busy','true');this.status('Preparing your alliance…');try{await this.onNew({factionId});}finally{this.starting=false;this.root.removeAttribute('aria-busy');}}
 hide(){this.closeReplace(false);this.closeAuth(false);this.root.hidden=true;this.app.inert=false;}
 async continue(){
  const c=await this.player.continuation();if(!c){this.status('No saved run is available. Start a new game.');return;}
  if(c.conflict){this.conflict=c;this.root.querySelector('h1').insertAdjacentHTML('afterend','<div class="menu-conflict" role="alert"><p>The cloud save changed on another device. Your local save has been preserved. Choose the cloud continuation, or cancel and keep the local save untouched.</p><button data-menu="cloud">Use Cloud Save</button><button data-menu="cancel-conflict">Cancel</button></div>');return;}
  const game=await this.player.resume(c);await this.onResume(game);this.hide();
 }
 async click(event){
  const b=event.target.closest('button');if(!b||b.disabled||this.starting)return;
  if(b.hasAttribute('data-auth-close')){this.closeAuth();return;}
  try{if(b.dataset.newFaction){const id=b.dataset.newFaction;if(!FACTIONS.some(f=>f.id===id))return;this.selectedFaction=id;this.root.querySelector('[data-faction-picker]').outerHTML=factionPickerMarkup(id);this.root.querySelector('[data-start-faction]').textContent=`Lead the ${FACTIONS.find(f=>f.id===id).name} alliance`;this.root.querySelector(`[data-new-faction="${id}"]`).focus({preventScroll:true});return;}if(b.dataset.provider){b.disabled=true;await this.onSave();const url=await this.player.beginSocial(b.dataset.provider,new URL(siteUrl(''),location.href).href);location.assign(url);return;}if(b.dataset.nav){this.offset=0;await this.show(b.dataset.nav);return;}if(b.dataset.page!==undefined){this.offset=Number(b.dataset.page);await this.show(this.page);this.root.scrollTop=0;return;}if(b.dataset.buy){await this.player.changeProfile('purchase',{skill:b.dataset.buy});await this.show('general');return;}
   const action=b.dataset.menu;
   if(action==='new'){
    let existing;try{existing=await this.player.store.get(this.player.owner);}catch{}if(existing&&!['lost','won'].includes(existing.meta.phase)){if(this.replaceDialog)return;this.pendingNewFaction=this.selectedFaction;this.replaceDialog=document.createElement('dialog');this.replaceDialog.className='menu-replace-dialog';this.replaceDialog.setAttribute('aria-labelledby','replace-title');this.replaceDialog.innerHTML=replaceRunMarkup(existing,this.pendingNewFaction);this.root.append(this.replaceDialog);const dialog=this.replaceDialog;dialog.addEventListener('cancel',e=>{e.preventDefault();this.closeReplace();});dialog.addEventListener('close',()=>{if(this.replaceDialog===dialog)this.closeReplace();});dialog.showModal();dialog.querySelector('[data-menu="cancel-replace"]').focus();return;}await this.startNewRun(this.selectedFaction);
   }else if(action==='confirm-new'){const factionId=this.pendingNewFaction;if(!factionId)return;this.closeReplace(false);await this.startNewRun(factionId);}
   else if(action==='cancel-replace')this.closeReplace();
   else if(action==='continue')await this.continue();
   else if(action==='cloud'){const game=await this.player.resume({remote:this.conflict.remote});await this.onResume(game);this.hide();}
   else if(action==='cancel-conflict'){this.conflict=null;await this.show('home');}
   else if(action==='sign-out'){await this.onSave();await this.player.auth('sign-out',{});await this.show('home');}
   else if(action==='refresh-account'){await this.player.initialize();await this.show('home');}
   else if(action==='reset-general'){await this.player.changeProfile('reset');await this.show('general');}
  }catch(error){if(b.dataset.provider)b.disabled=false;this.status(error.message,true);}
 }
 async submit(event){
  event.preventDefault();const form=event.target,body=new FormData(form),type=form.dataset.form,button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
  try{const callbackURL=new URL(siteUrl(''),location.href).href;
   if(['sign-in','register','reset-request'].includes(type)&&!this.player.authOptions?.emailPassword)throw Error('Email sign-in is not available yet.');
   if(type==='nickname'){await this.player.request('/player/nickname',{name:body.get('name')});await this.player.initialize();await this.show('account');this.status('Nickname saved.');}
   else if(type==='delete-account'){if(body.get('confirmation')!=='DELETE')throw Error('Type DELETE to confirm account removal.');await this.player.deleteAccount();await this.show('home');}
   else if(type==='equipment'){await this.player.changeProfile('equip',{equipped:body.getAll('equipped')});await this.show('general');this.status('Equipment saved for your next new run.');}
   else if(type==='sign-in'){await this.player.auth('sign-in/email',{email:body.get('email'),password:body.get('password')});await this.show('home');}
   else if(type==='register'){await this.player.auth('sign-up/email',{name:body.get('name'),email:body.get('email'),password:body.get('password'),callbackURL});this.status('Account created. Open the verification link sent to your email, then sign in.');form.reset();}
   else if(type==='reset-request'){await this.player.auth('request-password-reset',{email:body.get('email'),redirectTo:callbackURL+'?reset=1'});this.status('If an account exists, a recovery link has been prepared.');}
   else if(type==='reset-password'){const token=new URLSearchParams(location.search).get('token');if(!token)throw Error('Open a valid password recovery link.');await this.player.auth('reset-password',{token,newPassword:body.get('password')});await this.show('sign-in');this.status('Password changed. Sign in with your new password.');}
  }catch(error){this.status(error.message,true);}finally{if(button?.isConnected)button.disabled=false;}
 }
}


import {ARTIFACT_CATALOG as C,ARTIFACTS,ARTIFACT_SETS,RARITIES,craftUnlockTier,artifactModifierText,ARTIFACT_GEMS,artifactCraftGem} from '../game/core/artifacts.js';
import {commanderImageUrl,commanderUtilityArt} from './commander-art.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=value=>Number(value||0).toLocaleString('en-US');
export function artifactGemMarkup(gem, quantity, prefix=''){
 return `<span class="artifact-gem"><img src="${commanderUtilityArt(gem)}" alt="" width="34" height="34">${prefix}${num(quantity)} ${ARTIFACT_GEMS[gem]}</span>`;
}
export function artifactGemBalancesMarkup(account={}){
 return `<span class="artifact-gem-balances" aria-label="Gem balances">${Object.keys(ARTIFACT_GEMS).map(gem=>artifactGemMarkup(gem,account.gems?.[gem])).join('')}</span>`;
}
export function artifactCraftState(item,account={},online=true){
 const owned=(account.owned||[]).includes(item.id),cost=RARITIES[item.rarity].craft,tier=craftUnlockTier(item.rarity),shortfall=Math.max(0,cost-(account.dust||0));
 const gem=artifactCraftGem(item),missingGem=gem&&!(account.gems?.[gem]>0);
 const costs=[`${num(cost)} Dust`];
 if(gem)costs.push(`1 ${ARTIFACT_GEMS[gem]}`);
 const requirements=[];
 if((account.highestTier||0)<tier)requirements.push(`Earn a tier ${tier} chest to unlock ${RARITIES[item.rarity].name} crafting`);
 if(shortfall)requirements.push(`${num(shortfall)} more Dust needed`);
 if(missingGem)requirements.push(`1 ${ARTIFACT_GEMS[gem]} needed`);
 const reason=owned?'Already collected':!online?'Connect to forge artifacts':requirements.join(' · ')||'Ready to forge';
 return {owned,cost,tier,shortfall,gem,costLabel:costs.join(' + '),canCraft:!owned&&online&&requirements.length===0,reason};
}
export function artifactForgeRows({query='',rarity='all'}={}){
 query=query.trim().toLowerCase();
 return C.artifacts.filter(item=>(rarity==='all'||item.rarity===rarity)&&(!query||`${item.name} ${ARTIFACT_SETS[item.setId]?.name||'Standalone'} ${RARITIES[item.rarity].name}`.toLowerCase().includes(query))).sort((a,b)=>C.rarities.findIndex(r=>r.id===a.rarity)-C.rarities.findIndex(r=>r.id===b.rarity)||a.name.localeCompare(b.name));
}
export function artifactForgeMarkup(account={},state={},online=true){
 const rows=artifactForgeRows(state),pages=Math.max(1,Math.ceil(rows.length/12)),page=Math.max(0,Math.min(state.page||0,pages-1)),start=page*12;
 return `<header class="artifact-forge-heading"><div><small>THE RELIC FORGE</small><h2 id="artifact-forge-title" tabindex="-1">Craft an artifact</h2><p id="artifact-forge-description">Browse every artifact. Spend Relic Dust to create a missing piece. Celestial and Necromancer set pieces also require their matching gem.</p></div><button type="button" data-forge-close aria-label="Close artifact forge">×</button></header><div class="artifact-forge-wallet"><img src="${commanderImageUrl(commanderUtilityArt('dust'))}" alt=""><strong>${num(account.dust)} Relic Dust</strong>${artifactGemBalancesMarkup(account)}<span class="artifact-forge-wallet-note">Crafted artifacts go to your backpack. Equip them for your next new defense.</span></div><div class="artifact-forge-filters"><label>Search artifacts<input type="search" data-forge-search value="${esc(state.query||'')}" placeholder="Name or set…" autocomplete="off"></label><label>Rarity<span class="vault-select"><select data-forge-rarity>${[['all','All rarities'],...C.rarities.map(r=>[r.id,r.name])].map(([id,name])=>`<option value="${id}" ${state.rarity===id?'selected':''}>${name}</option>`).join('')}</select></span></label></div><p class="artifact-forge-status ${state.error?'is-error':''}" role="status" aria-live="polite">${esc(state.message||(!online?'Connect to forge artifacts. You can still browse the collection.':`${rows.length} artifacts match`))}</p><div class="artifact-forge-grid" aria-busy="${!!state.busy}">${rows.slice(start,start+12).map(item=>{const s=artifactCraftState(item,account,online);return `<article class="rarity-${item.rarity} ${s.owned?'is-owned':''}"><img src="${commanderImageUrl(item.art)}" alt="" loading="lazy" width="96" height="96"><div><small>${RARITIES[item.rarity].name} · ${esc(ARTIFACT_SETS[item.setId]?.name||'Standalone')}</small><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><ul>${artifactModifierText(item.modifiers).map(text=>`<li>${esc(text)}</li>`).join('')}</ul></div><footer><button type="button" data-forge-craft="${item.id}" ${s.canCraft&&!state.busy?'':'disabled'}>${s.owned?'✓ Collected':`Forge · ${esc(s.costLabel)}`}</button><small>${esc(s.reason)}</small></footer></article>`;}).join('')||'<p class="artifact-forge-empty">No matching artifacts. Try another name or rarity.</p>'}</div><nav class="vault-pagination" aria-label="Artifact forge pages"><button type="button" data-forge-page="${page-1}" ${page&&!state.busy?'':'disabled'} aria-label="Previous artifact forge page">‹</button><span>${rows.length?start+1:0}–${Math.min(start+12,rows.length)} / ${rows.length}</span><button type="button" data-forge-page="${page+1}" ${page+1<pages&&!state.busy?'':'disabled'} aria-label="Next artifact forge page">›</button></nav>`;
}
export class ArtifactForge{
 constructor({player,refresh,confirm}){Object.assign(this,{player,refresh,confirm});this.state={query:'',rarity:'all',page:0};}
 open(trigger){
  if(this.dialog?.open){this.dialog.querySelector('#artifact-forge-title')?.focus();return;}
  this.returnFocus=trigger||document.activeElement;this.state={query:'',rarity:'all',page:0};
  const d=document.createElement('dialog');this.dialog=d;d.className='artifact-forge';d.setAttribute('aria-labelledby','artifact-forge-title');d.setAttribute('aria-describedby','artifact-forge-description');document.body.append(d);
  d.addEventListener('cancel',event=>{event.preventDefault();this.close();});
  // The game's global Escape handler also runs before a defense exists. Stop
  // it here so the topmost native dialog owns its keyboard dismissal.
  d.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.close();}});
  d.addEventListener('close',()=>{if(this.dialog===d)this.close();});
  d.addEventListener('click',event=>void this.click(event));
  d.addEventListener('input',event=>{if(!event.target.matches('[data-forge-search]'))return;this.state.query=event.target.value;this.state.page=0;this.state.message='';const caret=event.target.selectionStart;this.update();const next=d.querySelector('[data-forge-search]');next.focus({preventScroll:true});try{next.setSelectionRange(caret,caret);}catch{}});
  d.addEventListener('change',event=>{if(!event.target.matches('[data-forge-rarity]'))return;this.state.rarity=event.target.value;this.state.page=0;this.state.message='';this.update();d.querySelector('[data-forge-rarity]').focus({preventScroll:true});});
  this.update();d.showModal();d.querySelector('#artifact-forge-title').focus();
 }
 update(){if(this.dialog?.isConnected)this.dialog.innerHTML=artifactForgeMarkup(this.player.profile?.artifacts,this.state,this.player.online);}
 close(){const d=this.dialog;if(!d)return;this.dialog=null;if(d.open)d.close();d.remove();(this.returnFocus?.isConnected?this.returnFocus:document.querySelector('[data-vault-action="forge"]'))?.focus({preventScroll:true});}
 async click(event){
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.hasAttribute('data-forge-close'))return this.close();
  if(this.state.busy)return;
  if(button.hasAttribute('data-forge-page')){this.state.page=Number(button.dataset.forgePage);this.update();this.dialog.querySelector('#artifact-forge-title').focus({preventScroll:true});return;}
  const item=ARTIFACTS[button.dataset.forgeCraft];if(!item)return;
  const state=artifactCraftState(item,this.player.profile?.artifacts,this.player.online);if(!state.canCraft)return;
  this.state.busy=true;this.update();
  try{
   if(!await this.confirm(item,state))return;
   await this.player.artifactMutation('craft',{artifactId:item.id});
   this.state.message=`${item.name} forged. It is ready in your backpack.`;this.state.error=false;await this.refresh();
  }catch(error){this.state.message=error.message;this.state.error=true;}
  finally{this.state.busy=false;this.update();this.dialog?.querySelector(`[data-forge-craft="${item.id}"]`)?.closest('article')?.scrollIntoView({block:'nearest'});this.dialog?.querySelector('#artifact-forge-title')?.focus({preventScroll:true});}
 }
}

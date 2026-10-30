import {FACTIONS} from '../game/core/factions.js';
import {siteUrl} from '../game/site-url.js';
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Selection is presentation only. The caller owns package preparation and the
// single successful run commit; no Game or RNG is constructed on card focus.
export function chooseFaction({registry,replace=false,confirm}){
 const dialog=document.createElement('dialog');dialog.className='faction-chooser';dialog.setAttribute('aria-labelledby','faction-choice-title');
 dialog.innerHTML=`<section class="faction-parchment"><span class="faction-corner nw" aria-hidden="true"></span><span class="faction-corner ne" aria-hidden="true"></span><span class="faction-corner sw" aria-hidden="true"></span><span class="faction-corner se" aria-hidden="true"></span><img class="faction-brand" src="${siteUrl('assets/branding/forged-alliances-v3/wordmark.svg')}" alt="Forged Alliances TD"><h1 id="faction-choice-title">Choose your faction</h1><p>Your defenders and recipes will belong to this faction for the entire run.</p><div class="faction-cards">${FACTIONS.map(f=>{return `<button type="button" data-faction="${f.id}" aria-pressed="false"><img class="faction-battle-art" src="${siteUrl(f.scene)}" alt="${escape(f.name)} champions marching into battle" width="${f.sceneWidth}" height="${f.sceneHeight}"><span class="faction-card-copy"><span class="faction-specialty">${escape(f.specialty)}</span><h2>${f.name}</h2><p>${escape(f.description)}</p></span><span class="faction-check" aria-hidden="true">✓</span></button>`;}).join('')}</div><p class="faction-status" role="status"></p><p class="minor-note">Choose a different faction when you start a new run.</p><div class="faction-actions">${replace?'<button type="button" data-cancel>Cancel</button>':''}<button type="button" class="primary-button" data-confirm disabled>Choose a faction</button></div></section>`;
 document.body.append(dialog);dialog.showModal();let selected=null,busy=false,controller=null;
 return new Promise(resolve=>{
  const finish=value=>{controller?.abort();dialog.close();dialog.remove();resolve(value);};
  const cancel=()=>{if(replace)finish(false);};
  dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
  dialog.querySelector('[data-cancel]')?.addEventListener('click',cancel);
  const action=dialog.querySelector('[data-confirm]');
  for(const b of dialog.querySelectorAll('[data-faction]'))b.addEventListener('click',()=>{if(busy)return;selected=b.dataset.faction;for(const c of dialog.querySelectorAll('[data-faction]'))c.setAttribute('aria-pressed',String(c===b));action.disabled=false;action.textContent=`Continue with ${FACTIONS.find(f=>f.id===selected).name}`;});
  action.addEventListener('click',async()=>{if(busy||!selected)return;busy=true;action.disabled=true;dialog.querySelector('.faction-status').textContent='Preparing your faction…';try{controller=new AbortController();await confirm(selected,{signal:controller.signal});if(dialog.isConnected)finish(true);}catch(error){if(!dialog.isConnected)return;dialog.querySelector('.faction-status').textContent=`Could not prepare this faction. ${error.message} Try again or choose another faction.`;busy=false;action.disabled=false;}});
 });
}

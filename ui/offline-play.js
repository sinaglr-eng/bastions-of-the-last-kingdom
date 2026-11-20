import {siteUrl} from '../game/site-url.js';

export function offlinePlayMarkup(player){
 const accountLink=player.localGuest?'<a href="'+siteUrl('')+'">Return to my account</a>':player.user?'<a href="'+siteUrl('')+'?offline=guest">Play a local guest defense</a>':'';
 return `<section class="offline-game-panel" aria-label="Offline play"><div><strong>Offline play</strong><p>Save all three factions on this device. Start a local guest defense or continue a saved defense without internet.</p>${accountLink}</div><offline-game-download></offline-game-download></section>`;
}

let registration;
async function getWorker(){
 if(navigator.onLine===false){
  const existing=await navigator.serviceWorker.getRegistration(siteUrl(''));
  if(existing?.active&&existing.scope===new URL(siteUrl(''),location.href).href)return existing.active;
  throw Error('Connect to download the game.');
 }
 if(!registration){
  registration=navigator.serviceWorker.register(siteUrl('offline-game.js'),{scope:siteUrl(''),updateViaCache:'none'}).catch(async error=>{
   registration=null;
   const previous=await navigator.serviceWorker.getRegistration(siteUrl(''));
   if(previous?.active)return previous;
   throw error;
  });
 }
 const registered=await registration;
 return registered.active||(await navigator.serviceWorker.ready).active;
}

export function registerOfflineControl(){
 if(!globalThis.customElements||customElements.get('offline-game-download'))return;
 customElements.define('offline-game-download',class extends HTMLElement{
  connectedCallback(){
   this.innerHTML='<button type="button" disabled>Download offline game</button><progress hidden aria-label="Offline game download"></progress><small role="status" aria-live="polite"></small>';
   this.button=this.querySelector('button');this.meter=this.querySelector('progress');this.message=this.querySelector('small');
   if(!navigator.serviceWorker||!self.isSecureContext){this.message.textContent='Offline downloads require a browser with Service Worker support.';return;}
   this.listen=event=>{if(event.data?.type==='offline-game-status')this.display(event.data);};
   this.check=()=>{void this.connect(false);};
   navigator.serviceWorker.addEventListener('message',this.listen);
   navigator.serviceWorker.addEventListener('controllerchange',this.check);
   window.addEventListener('online',this.check);
   this.button.onclick=()=>{void navigator.storage?.persist?.().catch(()=>{});void this.connect(true);};
   this.check();
  }
  disconnectedCallback(){
   if(!this.listen)return;
   navigator.serviceWorker.removeEventListener('message',this.listen);
   navigator.serviceWorker.removeEventListener('controllerchange',this.check);
   window.removeEventListener('online',this.check);
  }
  async connect(download){
   try{
    const worker=await getWorker();
    if(this.isConnected)worker.postMessage({type:download?'offline-game-download':'offline-game-check'});
   }catch{
    this.button.disabled=false;this.button.textContent='Retry offline download';
    this.message.textContent='Connect to the internet to prepare this device for offline play.';
   }
  }
  display({phase,total,bytes=0,error}){
   const size=Math.ceil(total/1e6)+' MB';
   this.button.disabled=phase==='downloading'||phase==='ready';
   this.meter.hidden=phase!=='downloading';this.meter.max=total;this.meter.value=bytes;
   const text={available:['Download offline game · '+size,''],update:['Update offline game · '+size,'Your previous download is still available.'],retry:['Resume download',error+' Files already saved will be reused.'],downloading:['Downloading…',Math.floor(100*bytes/total)+'% of '+size],ready:['Ready to play offline','Reopen this game address in the same browser to play.']};
   const [label,message]=text[phase];this.button.textContent=label;
   if(this.message.textContent!==message)this.message.textContent=message;
  }
 });
}

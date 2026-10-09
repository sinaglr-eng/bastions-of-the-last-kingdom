import {STATISTICS_API_URL} from '../statistics-config.js';
import {RunStatistics} from './run-statistics.js';

const KEY='bastions.statistics.outbox.v1';
const token=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
const browserStorage=()=>{try{return globalThis.localStorage;}catch{return null;}};
export class StatisticsClient {
  constructor(game,{endpoint=import.meta.env?.VITE_STATISTICS_API||STATISTICS_API_URL,enabled=true,fetcher=fetch,storage=browserStorage()}={}){
    this.endpoint=endpoint.replace(/\/$/,'');this.enabled=enabled&&!!this.endpoint;this.fetcher=(...args)=>fetcher(...args);this.storage=storage;this.tracker=new RunStatistics(game);this.writeToken=token();this.game=game;this.timer=0;this.busy=null;
    this.unsubscribe=game.on(type=>{if(['reward','won','lost'].includes(type)||(type==='place'&&game.towers.length===1))this.checkpoint();});
    this.online=()=>this.flush();window.addEventListener('online',this.online);this.flush();
  }
  readQueue(){try{const rows=this.memoryQueue??JSON.parse(this.storage?.getItem(KEY)||'[]');return Array.isArray(rows)?rows.filter(x=>x?.snapshot?.id&&x.writeToken&&x.endpoint===this.endpoint).slice(-20):[];}catch{return [];}}
  writeQueue(rows){this.memoryQueue=rows.slice(-20);try{if(!this.storage?.setItem)return false;this.storage.setItem(KEY,JSON.stringify(this.memoryQueue));this.memoryQueue=null;return true;}catch{return false;}}
  checkpoint({abandoned=false,keepalive=false}={}){
    if(!this.enabled||!this.tracker.draws.length)return;const entry={endpoint:this.endpoint,writeToken:this.writeToken,snapshot:this.tracker.snapshot({abandoned})};let queue=this.readQueue();queue=queue.filter(x=>x.snapshot.id!==entry.snapshot.id);queue.push(entry);this.pendingMemory=entry;this.writeQueue(queue);return this.flush({keepalive});
  }
  sample(dt,elapsedDt=dt){this.tracker.sample(dt);if(!this.enabled||['won','lost'].includes(this.game.phase)||!Number.isFinite(elapsedDt)||elapsedDt<=0)return;this.timer+=elapsedDt;if(this.timer>=30){this.timer=0;this.checkpoint();}}
  async request(path,body=null,{keepalive=false}={}){
    const res=await this.fetcher(`${this.endpoint}${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,keepalive});const payload=await res.json();if(!res.ok){const error=new Error(payload.error||'The score service is unavailable. Try again.');error.status=res.status;throw error;}return payload;
  }
  flush(options={}){
    if(!this.enabled)return Promise.resolve(false);if(this.busy)return this.busy;
    this.busy=Promise.resolve().then(async()=>{try{
      for(;;){let queue=this.readQueue();if(this.pendingMemory&&!queue.some(x=>x.snapshot.id===this.pendingMemory.snapshot.id&&x.snapshot.sequence>=this.pendingMemory.snapshot.sequence))queue.push(this.pendingMemory);
      if(!queue.length)break;
      for(const entry of queue){const s=entry.snapshot;await this.request('/api/runs',{id:s.id,writeToken:entry.writeToken,version:s.version,mode:s.mode,seed:s.seed},options);await this.request(`/api/runs/${s.id}/checkpoint`,{writeToken:entry.writeToken,snapshot:s},options);this.writeQueue(this.readQueue().filter(x=>x.snapshot.id!==s.id||x.snapshot.sequence>s.sequence));if(this.pendingMemory?.snapshot.id===s.id&&this.pendingMemory.snapshot.sequence===s.sequence)this.pendingMemory=null;}
      }return true;
    }catch(error){if(this.lastError!==error.message)console.warn('Statistics sync postponed; the result remains queued on this device.',error.message);this.lastError=error.message;return false;}finally{this.busy=null;}});return this.busy;
  }
  async leaderboard(){
    if(!this.enabled)throw new Error('The online leaderboard is not connected yet.');
    const load=version=>this.request(`/api/leaderboard?mode=${this.game.waveLimit}&version=${encodeURIComponent(version)}&id=${this.tracker.id}`);
    if(this.supportsAllVersions!==false)try{const result=await load('all');this.supportsAllVersions=true;return result;}catch(error){if(error.status!==400)throw error;this.supportsAllVersions=false;}
    const result=await load(this.tracker.version);return {...result,olderService:true};
  }
  async saveScore(name){
    if(!this.enabled)throw new Error('The online leaderboard is not connected yet.');
    this.checkpoint();if(!await this.flush())throw new Error(this.lastError||'Your result could not be uploaded. Try again.');
    // A newer checkpoint may have arrived while the first flush was in progress.
    if(this.pendingMemory&&!await this.flush())throw new Error(this.lastError);
    const result=await this.request(`/api/runs/${this.tracker.id}/score`,{writeToken:this.writeToken,name,leaderboardVersion:'all'});
    return result.version==='all'?result:this.leaderboard();
  }
  dispose(){this.unsubscribe();this.tracker.dispose();window.removeEventListener('online',this.online);}
}

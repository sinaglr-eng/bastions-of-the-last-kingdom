import {adoptDecodedGeometricAsset} from './geometric-resources.js';

// Only authoritative, placed board units may reveal which defender GLB is
// needed. A latent draft card or reserved identity snapshot is not a unit.
export function defenderTemplateKey(tower,definitions){
  if(!tower||!['active','draft','reserved'].includes(tower.state))return null;
  if(!Number.isInteger(tower.id)||!Number.isInteger(tower.x)||!Number.isInteger(tower.z))return null;
  const definition=definitions?.[tower.family];
  if(!definition||!Object.hasOwn(definitions,tower.family))return null;
  const tier=definition.advanced?1:tower.tier;
  return Number.isInteger(tier)&&tier>0?`${tower.family}:${tier}`:null;
}

// The manifests are cheap indexes, not a preload list. Requests made before
// they arrive wait for indexing; each family/rank then owns one shared job.
export class DefenderModelLoader {
  constructor({load,install,onFailure=()=>{},onStateChange=()=>{},isDisposed=()=>false,isNeeded=()=>true,concurrency=3,maxAttempts=2,retryDelayMs=10000,maxBatches=3,now=()=>Date.now()}){
    this.load=load;this.install=install;this.onFailure=onFailure;this.isDisposed=isDisposed;
    this.onStateChange=onStateChange;this.now=now;this.isNeeded=isNeeded;
    this.retryDelayMs=Math.max(1000,Number(retryDelayMs)||10000);
    this.maxBatches=Math.min(3,Math.max(1,Math.floor(maxBatches)||1));
    this.concurrency=Math.min(3,Math.max(1,Math.floor(concurrency)||1));
    this.maxAttempts=Math.min(2,Math.max(1,Math.floor(maxAttempts)||1));
    this.entries=new Map();this.requests=new Map();this.queue=[];
    this.indexed=false;this.disposed=false;this.activeCount=0;
  }
  get unavailable(){return this.disposed||this.isDisposed();}
  index(entries){
    if(this.unavailable)return 0;
    const added=new Set();
    for(const entry of entries){
      if(entry?.kind!=='tower'||typeof entry.family!=='string'||!Number.isInteger(entry.tier)||entry.tier<1)continue;
      const key=`${entry.family}:${entry.tier}`;
      if(!this.entries.has(key)){this.entries.set(key,entry);added.add(key);}
    }
    this.indexed=true;
    for(const request of this.requests.values()){
      if(request.status==='waiting')this.enqueue(request);
      // A partial/offline roster is not a permanent negative cache. A newly
      // supplied key immediately restarts its already requested placed unit.
      else if(request.status==='unavailable'&&added.has(request.key)&&this.isNeeded(request.key)){
        this.requests.delete(request.key);this.startRequest(request.key,1);
      }
    }
    this.pump();return this.entries.size;
  }
  statusFor(tower,definitions){
    const key=defenderTemplateKey(tower,definitions);
    if(!key)return 'unavailable';
    const status=this.requests.get(key)?.status;
    return status==='loaded'?'ready':status||'waiting';
  }
  requestTower(tower,definitions){
    const key=defenderTemplateKey(tower,definitions);
    if(!key||this.unavailable)return Promise.resolve(false);
    const previous=this.requests.get(key);
    if(previous){
      if(previous.status==='unavailable'&&this.entries.has(key)&&(!previous.entry||previous.notNeeded)){
        this.requests.delete(key);return this.startRequest(key,1);
      }
      if(previous.status!=='unavailable'||!this.entries.has(key)||previous.batch>=this.maxBatches||this.now()<previous.retryAt)return previous.promise;
      this.requests.delete(key);return this.startRequest(key,previous.batch+1);
    }
    return this.startRequest(key,1);
  }
  retryTower(tower,definitions){
    const key=defenderTemplateKey(tower,definitions),previous=this.requests.get(key);
    if(key&&previous?.status==='unavailable')this.requests.delete(key);
    return this.requestTower(tower,definitions);
  }
  setStatus(request,status){
    if(request.status===status)return;
    request.status=status;
    if(!this.unavailable)this.onStateChange(request.key,status);
  }
  startRequest(key,batch){
    let resolve;
    const promise=new Promise(done=>{resolve=done;});
    const request={key,promise,resolve,status:'waiting',settled:false,batch,retryAt:Infinity};
    this.requests.set(key,request);
    if(this.indexed){this.enqueue(request);this.pump();}
    return promise;
  }
  enqueue(request){
    if(!this.isNeeded(request.key)){request.notNeeded=true;this.finish(request,false);return;}
    const entry=this.entries.get(request.key);
    if(!entry){this.finish(request,false);return;}
    request.entry=entry;this.setStatus(request,'queued');this.queue.push(request);
  }
  finish(request,accepted){
    if(request.settled)return;
    request.settled=true;request.retryAt=accepted?Infinity:this.now()+this.retryDelayMs*2**(request.batch-1);
    this.setStatus(request,accepted?'loaded':'unavailable');request.resolve(accepted);
  }
  pump(){
    if(this.unavailable){this.dispose();return;}
    while(this.activeCount<this.concurrency&&this.queue.length){
      const request=this.queue.shift();
      if(!this.isNeeded(request.key)){request.notNeeded=true;this.finish(request,false);continue;}
      this.setStatus(request,'loading');this.activeCount++;
      void this.run(request);
    }
  }
  async run(request){
    let failure;
    try{
      for(let attempt=0;attempt<this.maxAttempts&&!this.unavailable;attempt++){
        try{
          const gltf=await this.load(request.entry);
          const accepted=adoptDecodedGeometricAsset(gltf,asset=>this.install(request.entry,asset),{isDisposed:()=>this.unavailable});
          this.finish(request,accepted);return;
        }catch(error){failure=error;}
      }
      this.finish(request,false);
      if(failure&&!this.unavailable)this.onFailure(request.entry,failure);
    }finally{
      this.activeCount--;this.pump();
    }
  }
  dispose(){
    if(this.disposed)return;
    this.disposed=true;
    // Decode itself cannot be cancelled. Running jobs still take the late
    // asset through adoptDecodedGeometricAsset and release its GPU resources.
    for(const request of this.requests.values())this.finish(request,false);
    this.queue.length=0;this.entries.clear();this.requests.clear();
  }
}

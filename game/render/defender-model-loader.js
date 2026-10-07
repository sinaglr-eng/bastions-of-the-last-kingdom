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
  constructor({load,install,onFailure=()=>{},isDisposed=()=>false,concurrency=3,maxAttempts=2}){
    this.load=load;this.install=install;this.onFailure=onFailure;this.isDisposed=isDisposed;
    this.concurrency=Math.min(3,Math.max(1,Math.floor(concurrency)||1));
    this.maxAttempts=Math.min(2,Math.max(1,Math.floor(maxAttempts)||1));
    this.entries=new Map();this.requests=new Map();this.queue=[];
    this.indexed=false;this.disposed=false;this.activeCount=0;
  }
  get unavailable(){return this.disposed||this.isDisposed();}
  index(entries){
    if(this.unavailable)return 0;
    for(const entry of entries){
      if(entry?.kind!=='tower'||typeof entry.family!=='string'||!Number.isInteger(entry.tier)||entry.tier<1)continue;
      const key=`${entry.family}:${entry.tier}`;
      if(!this.entries.has(key))this.entries.set(key,entry);
    }
    this.indexed=true;
    for(const request of this.requests.values())if(request.status==='waiting')this.enqueue(request);
    this.pump();return this.entries.size;
  }
  requestTower(tower,definitions){
    const key=defenderTemplateKey(tower,definitions);
    if(!key||this.unavailable)return Promise.resolve(false);
    if(this.requests.has(key))return this.requests.get(key).promise;
    let resolve;
    const promise=new Promise(done=>{resolve=done;});
    const request={key,promise,resolve,status:'waiting',settled:false};
    this.requests.set(key,request);
    if(this.indexed){this.enqueue(request);this.pump();}
    return promise;
  }
  enqueue(request){
    const entry=this.entries.get(request.key);
    if(!entry){this.finish(request,false);return;}
    request.entry=entry;request.status='queued';this.queue.push(request);
  }
  finish(request,accepted){
    if(request.settled)return;
    request.settled=true;request.status=accepted?'loaded':'unavailable';request.resolve(accepted);
  }
  pump(){
    if(this.unavailable){this.dispose();return;}
    while(this.activeCount<this.concurrency&&this.queue.length){
      const request=this.queue.shift();request.status='loading';this.activeCount++;
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

// Limit render targets and overlapping decoders, never authored geometry,
// materials, animation samples, combat time, targeting or damage.
export function renderBudget({pixelRatio=1,coarsePointer=false,platform='',maxTouchPoints=0,recovering=false}={}){
 const touch=coarsePointer||platform==='MacIntel'&&maxTouchPoints>1;
 return Object.freeze({touch,pixelRatio:Math.min(Number.isFinite(pixelRatio)&&pixelRatio>0?pixelRatio:1,recovering?1:touch?1.25:1.6),shadowMapSize:touch||recovering?1024:2048,assetConcurrency:touch||recovering?1:3,defenderConcurrency:touch?1:3,enemyConcurrency:touch?1:2,maxCachedUnused:touch||recovering?0:2});
}

// The enemy, defender and landmark loaders share one decode budget. A closed
// queue rejects work that never started; active assets still reach their
// original ownership boundary so late completions can dispose them safely.
export class AssetLoadQueue{
 constructor(concurrency=1){this.concurrency=Math.max(1,Math.min(3,Math.floor(concurrency)||1));this.running=0;this.queue=[];this.suspended=false;this.disposed=false;}
 run(task){if(this.disposed)return Promise.reject(Error('Battlefield closed.'));return new Promise((resolve,reject)=>{this.queue.push({task,resolve,reject});this.pump();});}
 pump(){if(this.disposed||this.suspended)return;while(this.running<this.concurrency&&this.queue.length){const job=this.queue.shift();this.running++;Promise.resolve().then(job.task).then(job.resolve,job.reject).finally(()=>{this.running--;this.pump();});}}
 setSuspended(value){this.suspended=!!value;if(!this.suspended)this.pump();}
 dispose(){if(this.disposed)return;this.disposed=true;for(const job of this.queue)job.reject(Error('Battlefield closed.'));this.queue.length=0;}
 snapshot(){return {running:this.running,queued:this.queue.length,suspended:this.suspended,concurrency:this.concurrency};}
}

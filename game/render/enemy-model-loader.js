/** Read actual queued choices and all next-wave appearances without rolling RNG. */
export function neededEnemyModelKeys(game){
  const keys=new Set(),key=e=>e?.visualAsset||e?.type;
  for(const enemy of game.combat.enemies)if(!enemy.dead)keys.add(key(enemy));
  for(const row of game.combat.spawnQueue){const base=game.data.enemies[row.type];keys.add(key({...base,...row.modifiers?.variant,type:row.type}));}
  const wave=game.data.waves[game.round-1+(game.phase==='combat'?1:0)];
  for(const group of wave?.groups||[]){const base=game.data.enemies[group.type];for(const variant of Object.hasOwn(group,'variant')?[group.variant]:base?.variants||[{}])keys.add(key({...base,...variant,type:group.type}));}
  return [...keys].filter(Boolean);
}

/** Decode only needed wave identities; never eagerly stream the 54-model pack. */
export class EnemyModelLoader{
  constructor({load,install,release=()=>{},protectedKeys=()=>new Set(),onFailure=()=>{},onReady=()=>{},concurrency=2,cacheSize=4}={}){
    Object.assign(this,{load,install,release,protectedKeys,onFailure,onReady,concurrency,cacheSize});this.entries=new Map();this.pending=new Map();this.loaded=new Map();this.failures=new Map();this.running=0;this.disposed=false;
  }
  index(entries){for(const entry of entries)this.entries.set(entry.id,entry);}
  request(keys){
    if(this.disposed)return;
    for(const key of keys){
      if(this.loaded.has(key)){const value=this.loaded.get(key);this.loaded.delete(key);this.loaded.set(key,value);continue;}
      const failure=this.failures.get(key);if(failure&&(failure.at+15000>Date.now()||failure.attempts>=3))continue;
      if(!this.pending.has(key)&&this.entries.has(key))this.pending.set(key,{entry:this.entries.get(key),running:false});
    }
    this.pump();
  }
  pump(){
    if(this.disposed)return;
    for(const [key,row]of this.pending){
      if(this.running>=this.concurrency)break;if(row.running)continue;
      row.running=true;this.running++;
      Promise.resolve().then(()=>this.load(row.entry)).then(asset=>{
        if(this.disposed){this.release(key,asset);return;}
        try{if(this.install(row.entry,asset)===false){this.release(key,asset);return;}this.loaded.set(key,asset);this.failures.delete(key);this.onReady(row.entry);}
        catch(error){this.release(key,asset);throw error;}
      }).catch(error=>{if(!this.disposed){this.failures.set(key,{at:Date.now(),attempts:(this.failures.get(key)?.attempts||0)+1});this.onFailure(row.entry,error);}}).finally(()=>{
        this.running--;this.pending.delete(key);this.trim();this.pump();
      });
    }
  }
  trim(){
    const protectedSet=this.protectedKeys();
    for(const [key,asset]of this.loaded){if(this.loaded.size<=this.cacheSize)break;if(protectedSet.has(key))continue;this.loaded.delete(key);this.release(key,asset);}
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.pending.clear();for(const [key,asset]of this.loaded)this.release(key,asset);this.loaded.clear();this.entries.clear();}
}

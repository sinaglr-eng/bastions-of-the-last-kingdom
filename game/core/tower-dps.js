export const TOWER_DPS_WINDOW_SECONDS=5;

// Combat's legacy damage may exceed remaining HP. New hit events expose the
// applied amount explicitly; the fallback reconstructs pre-hit HP from the
// synchronous legacy event, without retaining or changing the enemy.
export function effectiveHitDamage(hit){
  if(!hit||!Number.isFinite(hit.damage)||hit.damage<=0)return 0;
  if(Number.isFinite(hit.effectiveDamage))return Math.min(hit.damage,Math.max(0,hit.effectiveDamage));
  if(Number.isFinite(hit.enemy?.hp))return Math.min(hit.damage,Math.max(0,hit.enemy.hp+hit.damage));
  return 0;
}

const signature=source=>JSON.stringify([source.id,source.family,source.tier]);
const validSource=source=>source&&Number.isSafeInteger(source.id)&&source.id>0&&typeof source.family==='string'&&source.family!=='wall'&&Number.isInteger(source.tier)&&source.tier>0;

// The fixed denominator means the first combat seconds include an empty part
// of the window. Use combat.elapsed, never wall time or animation time. Call
// reset at combat start/new game; keep the last combat clock between waves.
export class TowerDpsTracker{
  constructor({windowSeconds=TOWER_DPS_WINDOW_SECONDS}={}){
    if(!Number.isFinite(windowSeconds)||windowSeconds<=0)throw new RangeError('DPS window must be positive game seconds');
    this.windowSeconds=windowSeconds;this.reset();
  }
  reset(time=0){
    if(!Number.isFinite(time)||time<0)throw new RangeError('DPS time must be nonnegative game seconds');
    this.time=time;this._buckets=[];this._head=0;this._totals=new Map();
  }
  advance(time){
    if(!Number.isFinite(time)||time<0)return false;
    if(time<this.time)this.reset(time);
    this.time=time;
    const cutoff=time-this.windowSeconds;
    while(this._head<this._buckets.length&&this._buckets[this._head].time<=cutoff){
      for(const [key,damage] of this._buckets[this._head++].damage){
        const total=this._totals.get(key);
        if(--total.buckets===0)this._totals.delete(key);
        else total.damage=Math.max(0,total.damage-damage);
      }
    }
    if(this._head===this._buckets.length){this._buckets=[];this._head=0;}
    else if(this._head>32&&this._head*2>this._buckets.length){this._buckets=this._buckets.slice(this._head);this._head=0;}
    return true;
  }
  recordHit(hit,time=this.time){
    if(!this.advance(time)||!validSource(hit?.source))return false;
    const damage=effectiveHitDamage(hit);if(damage<=0)return false;
    const key=signature(hit.source);
    let bucket=this._buckets.at(-1);
    if(!bucket||bucket.time!==time){bucket={time,damage:new Map()};this._buckets.push(bucket);}
    let total=this._totals.get(key);
    if(!total){total={damage:0,buckets:0};this._totals.set(key,total);}
    if(!bucket.damage.has(key))total.buckets++;
    bucket.damage.set(key,(bucket.damage.get(key)||0)+damage);total.damage+=damage;
    return true;
  }
  snapshot(towers,time=this.time,{includeDraft=true}={}){
    if(!this.advance(time))return [];
    return towers.filter(t=>validSource(t)&&(t.state==='active'||includeDraft&&t.state==='draft')).map(t=>{
      // A merge/recipe may reuse the ID. Never transfer an old family's or
      // rank's damage to the new defender, or to a currently placed draft.
      const damage=t.state==='active'?this._totals.get(signature(t))?.damage||0:0;
      return {id:t.id,family:t.family,tier:t.tier,state:t.state,x:t.x,z:t.z,damage,dps:damage/this.windowSeconds};
    }).sort((a,b)=>b.dps-a.dps||a.id-b.id);
  }
}

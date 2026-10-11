const phases=new Set(['build','battle','victory']);
export const RECORDED_ATTACK_TYPES=new Set(['arrow','sword','spear','hammer','runic_bolt','heavy_bolt','stone','charge','toxic_canister','nature','arcane','holy','frost','lightning','fire']);

// Resolve against the catalogue response URL, including portable/project bases.
// Display names, damage balance and model filenames do not choose the asset.
export function recordedCatalogue(raw,base){
  if(raw?.schemaVersion!==1||!Array.isArray(raw.music)||!Array.isArray(raw.effects)||!Array.isArray(raw.defenders))throw new TypeError('Invalid recorded audio catalogue.');
  const revision=new URL(base).searchParams.get('v');
  const resolve=clip=>{
    if(typeof clip?.id!=='string'||!clip.id||typeof clip.url!=='string'||!clip.url.trim())throw new TypeError('Recorded audio asset needs an ID and URL.');
    const url=new URL(clip.url,base);if(revision&&!url.searchParams.has('v'))url.searchParams.set('v',revision);
    return {...clip,url:url.href};
  };
  const music=raw.music.map(resolve),effects=new Map();
  const ids=new Set();for(const clip of music){if(!phases.has(clip.phase)||ids.has(clip.id))throw new TypeError('Invalid music phase or duplicate identity.');ids.add(clip.id);}
  for(const phase of phases)if(!music.some(clip=>clip.phase===phase))throw new TypeError('Missing music phase.');
  if(music.filter(clip=>clip.phase==='victory').length!==1)throw new TypeError('Exactly one approved victory celebration is required.');
  for(const item of raw.effects){const clip=resolve(item);if(!RECORDED_ATTACK_TYPES.has(clip.id)||effects.has(clip.id))throw new TypeError('Invalid or duplicate attack effect.');effects.set(clip.id,clip);}
  const defenders=new Map();for(const row of raw.defenders){
    if(typeof row.character_id!=='string'||defenders.has(row.character_id)||!Array.isArray(row.effects)||!row.effects.length||row.effects.some(id=>!effects.has(id)))throw new TypeError('Invalid defender audio binding.');
    defenders.set(row.character_id,structuredClone(row));
  }
  return {music,effects,defenders,policy:{crossfadeSeconds:1.5,duckGain:.32,...raw.policy}};
}

export function recordedAttackCue(event,payload={},defenders=new Map()){
  const source=payload.source||payload.tower,row=defenders.get(source?.family);if(!row||payload.visible===false)return null;
  if(event==='chain')return ['lightning','frost'].includes(payload.effect)&&row.effects.includes(payload.effect)?payload.effect:null;
  // This event is emitted only by the actual successful, positive-damage proc.
  // Ordinary poison/burn ticks and passive support frames have no cue.
  if(event==='burn-proc')return payload.effect==='fire'&&payload.amount>0&&row.effects.includes('fire')?'fire':null;
  if(event==='aura-attack')return payload.effect==='fire'||payload.stats?.projectileEffect==='fire'||payload.stats?.type==='fire'||payload.stats?.burnAura>0?row.effects.includes('fire')?'fire':null:null;
  if(event!=='shot')return null;
  const conditional=row.conditions?.find(condition=>condition.event==='shot'&&Array.isArray(condition.ranks)&&condition.ranks.includes(source.tier));
  return conditional?.effect||row.effects[0]||null;
}

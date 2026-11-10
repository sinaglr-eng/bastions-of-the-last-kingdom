const phases=new Set(['build','battle','victory']);
export const RECORDED_ATTACK_TYPES=new Set(['arrow','sword','spear','hammer','runic_bolt','heavy_bolt','stone','charge','toxic_canister','nature','arcane','holy','frost','lightning','fire']);
const supportedAttackTypes=new Set([...RECORDED_ATTACK_TYPES,'electric_arc','storm_spear','musket','gatling','mortar','cannon','grenade_throw','explosive_impact','axe','pickaxe','war_drum','ent_slam','web_spit','claw','fire_breath']);

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
  for(const item of raw.effects){const clip=resolve(item);if(!supportedAttackTypes.has(clip.id)||effects.has(clip.id)||clip.gain!==undefined&&(!Number.isFinite(clip.gain)||clip.gain<=0||clip.gain>16))throw new TypeError('Invalid or duplicate attack effect.');effects.set(clip.id,clip);}
  const defenders=new Map();for(const row of raw.defenders){
    if(typeof row.character_id!=='string'||defenders.has(row.character_id)||!Array.isArray(row.effects)||!row.effects.length||row.effects.some(id=>!effects.has(id)))throw new TypeError('Invalid defender audio binding.');
    if(row.cues!==undefined){
      if(!Array.isArray(row.cues)||!row.cues.length)throw new TypeError('Invalid ranked attack cues.');
      const ranks=new Set(),known=id=>typeof id==='string'&&row.effects.includes(id)&&effects.has(id);
      for(const cue of row.cues){
        if(!Array.isArray(cue.ranks)||!cue.ranks.length||new Set(cue.ranks).size!==cue.ranks.length||cue.ranks.some(rank=>!Number.isInteger(rank)||rank<1||rank>6||ranks.has(rank))||!known(cue.shot))throw new TypeError('Invalid ranked attack cue.');
        for(const rank of cue.ranks)ranks.add(rank);
        for(const key of ['impact','burnProc','auraAttack'])if(cue[key]!==undefined&&!known(cue[key]))throw new TypeError('Unknown ranked cue effect.');
        if(cue.chain!==undefined&&(!cue.chain||typeof cue.chain!=='object'||Array.isArray(cue.chain)||Object.entries(cue.chain).some(([key,id])=>!['lightning','frost'].includes(key)||!known(id))))throw new TypeError('Invalid chain audio cue.');
        if(cue.fireAura&&(!(cue.fireAura.radius>0)||!Number.isFinite(cue.fireAura.radius)||!['physical','magical','holy'].includes(cue.fireAura.damageType)||!known(cue.fireAura.effect)||typeof cue.fireAura.requiresAttackEnabled!=='boolean'))throw new TypeError('Invalid fire aura audio cue.');
      }
    }
    defenders.set(row.character_id,structuredClone(row));
  }
  return {music,effects,defenders,policy:{crossfadeSeconds:1.5,duckGain:.32,...raw.policy}};
}

export function recordedAttackCue(event,payload={},defenders=new Map()){
  const source=payload.source||payload.tower,row=defenders.get(source?.family);if(!row||payload.visible===false)return null;
  if(row.cues){
    const cue=row.cues.find(c=>c.ranks.includes(source.tier));if(!cue)return null;
    if(event==='shot')return cue.shot;
    if(event==='chain')return cue.chain?.[payload.effect]||null;
    if(event==='impact')return cue.impact||null;
    if(event==='burn-proc')return payload.effect==='fire'&&payload.amount>0?cue.burnProc||null:null;
    if(event==='aura-attack')return cue.auraAttack||null;
    if(event==='damage-trace'){
      const aura=cue.fireAura,enemy=payload.enemy;
      if(!aura||!(payload.effectiveDamage>0)||payload.directHit!==false||payload.visible!==true||source.state!=='active'||source.attackPaused||aura.requiresAttackEnabled&&source.disarmed||!enemy||enemy.dead||payload.type!==aura.damageType)return null;
      if(![source.x,source.z,enemy.x,enemy.z].every(Number.isFinite)||Math.hypot(source.x-enemy.x,source.z-enemy.z)>aura.radius)return null;
      return aura.effect;
    }
    return null;
  }
  if(event==='chain')return ['lightning','frost'].includes(payload.effect)&&row.effects.includes(payload.effect)?payload.effect:null;
  // This event is emitted only by the actual successful, positive-damage proc.
  // Ordinary poison/burn ticks and passive support frames have no cue.
  if(event==='burn-proc')return payload.effect==='fire'&&payload.amount>0&&row.effects.includes('fire')?'fire':null;
  if(event==='aura-attack')return payload.effect==='fire'||payload.stats?.projectileEffect==='fire'||payload.stats?.type==='fire'||payload.stats?.burnAura>0?row.effects.includes('fire')?'fire':null:null;
  if(event!=='shot')return null;
  const conditional=row.conditions?.find(condition=>condition.event==='shot'&&Array.isArray(condition.ranks)&&condition.ranks.includes(source.tier));
  return conditional?.effect||row.effects[0]||null;
}

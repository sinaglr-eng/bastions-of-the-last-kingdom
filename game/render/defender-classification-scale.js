import presentationConfig from '../../data/defender-presentation-v3.json' with {type:'json'};
const profiles=new Map(presentationConfig.profiles.map(p=>[`${p.factionId}:${p.family}:${p.tier}`,p]));
export const DEFENDER_BATTLEFIELD_PRESENTATION_SCALE=presentationConfig.globalBattlefieldScale;
export function defenderPresentationProfile(entry){
  if(!entry?.factionAnimation)return null;
  const profile=profiles.get(`${entry.factionId}:${entry.family}:${entry.tier}`);
  return profile&&profile.sourceGlbSha256===entry.sha256?profile:null;
}
export const humanPresentationProfile=entry=>entry?.factionId==='crown'?defenderPresentationProfile(entry):null;
import {championClassification,championAuraLevel} from './champion-classification.js';

// Classification is cosmetic and separate from ordinary equipment ranks,
// champion ascension and the frozen source model's own physical proportions.
export const DEFENDER_CLASSIFICATION_SCALE_STEP=1.1;
export const defenderClassificationMultiplier=family=>
  championClassification(family)?DEFENDER_CLASSIFICATION_SCALE_STEP**championAuraLevel(family):1;

// Keep each creature's authored proportions. The current Elf Baby's native
// height is .2002; Fire Dragon is .7700 after its Intermediate class scale.
// A 3.85 presentation multiplier matches their visible height within .2%.
// The older Human family adjustments remain separate from the V3 Elf roster.
export const DRAGON_PRESENTATION_SCALES=Object.freeze({embercrown:2.3,worldfire:1.25,thunderheart:1.2,phoenix:1.15,el_baby_fire_dragon:3.85});
export const DWARF_BATTLEFIELD_PRESENTATION_SCALE=1.75;
export const defenderPresentationMultiplier=(family,factionId=null)=>factionId==='forge'&&family!=='ladyclaire'?DWARF_BATTLEFIELD_PRESENTATION_SCALE:Object.hasOwn(DRAGON_PRESENTATION_SCALES,family)?DRAGON_PRESENTATION_SCALES[family]:1;

const actorScales=new WeakMap();
// Apply to a private clone before battlefield scaling or preview framing.
// Repeated calls for the same class leave battlefield/idle transforms intact.
export function applyDefenderClassificationScale(actor,family){
  const entry=actor.userData.factionAttackEntry,normalized=defenderPresentationProfile(entry);
  const classification=defenderClassificationMultiplier(family),presentation=normalized?normalized.multiplier/classification:defenderPresentationMultiplier(family,entry?.factionId);
  // Only real V3 defenders carry this marker. Walls, enemies, loading dials
  // and preserved legacy inspection actors keep their own authored sizing.
  const battlefield=entry?.factionAnimation?DEFENDER_BATTLEFIELD_PRESENTATION_SCALE:1;
  const multiplier=classification*presentation*battlefield;
  let state=actorScales.get(actor);
  if(!state){state={base:actor.scale.clone(),multiplier:null};actorScales.set(actor,state);}
  if(state.multiplier!==multiplier){actor.scale.copy(state.base).multiplyScalar(multiplier);state.multiplier=multiplier;}
  actor.userData.defenderBodyNormalization=normalized?{revision:presentationConfig.revision,metric:normalized.metric,target:normalized.battlefieldTarget}:null;
  actor.userData.humanBodyNormalization=entry?.factionId==='crown'?actor.userData.defenderBodyNormalization:null;
  actor.userData.classificationScale=classification;
  actor.userData.defenderPresentationScale=presentation;
  actor.userData.defenderGlobalPresentationScale=battlefield;
  actor.userData.championClassification=championClassification(family);
  return actor;
}

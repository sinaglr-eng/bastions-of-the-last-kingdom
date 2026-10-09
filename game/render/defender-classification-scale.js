import {championClassification,championAuraLevel} from './champion-classification.js';

// Classification is cosmetic and separate from ordinary equipment ranks,
// champion ascension and the frozen source model's own physical proportions.
export const DEFENDER_CLASSIFICATION_SCALE_STEP=1.1;
export const defenderClassificationMultiplier=family=>
  championClassification(family)?DEFENDER_CLASSIFICATION_SCALE_STEP**championAuraLevel(family):1;

// Keep the approved creatures' authored proportions. The Baby was less than
// half a normal defender's height; larger descendants retain their own shapes.
export const DRAGON_PRESENTATION_SCALES=Object.freeze({embercrown:2.3,worldfire:1.25,thunderheart:1.2,phoenix:1.15});
export const defenderPresentationMultiplier=family=>Object.hasOwn(DRAGON_PRESENTATION_SCALES,family)?DRAGON_PRESENTATION_SCALES[family]:1;

const actorScales=new WeakMap();
// Apply to a private clone before battlefield scaling or preview framing.
// Repeated calls for the same class leave battlefield/idle transforms intact.
export function applyDefenderClassificationScale(actor,family){
  const classification=defenderClassificationMultiplier(family),presentation=defenderPresentationMultiplier(family);
  const multiplier=classification*presentation;
  let state=actorScales.get(actor);
  if(!state){state={base:actor.scale.clone(),multiplier:null};actorScales.set(actor,state);}
  if(state.multiplier!==multiplier){actor.scale.copy(state.base).multiplyScalar(multiplier);state.multiplier=multiplier;}
  actor.userData.classificationScale=classification;
  actor.userData.defenderPresentationScale=presentation;
  actor.userData.championClassification=championClassification(family);
  return actor;
}

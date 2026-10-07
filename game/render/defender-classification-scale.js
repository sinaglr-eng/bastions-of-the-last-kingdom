import {championClassification,championAuraLevel} from './champion-classification.js';

// Classification is cosmetic and separate from ordinary equipment ranks,
// champion ascension and the frozen source model's own physical proportions.
export const DEFENDER_CLASSIFICATION_SCALE_STEP=1.1;
export const defenderClassificationMultiplier=family=>
  championClassification(family)?DEFENDER_CLASSIFICATION_SCALE_STEP**championAuraLevel(family):1;

const actorScales=new WeakMap();
// Apply to a private clone before battlefield scaling or preview framing.
// Repeated calls for the same class leave battlefield/idle transforms intact.
export function applyDefenderClassificationScale(actor,family){
  const multiplier=defenderClassificationMultiplier(family);
  let state=actorScales.get(actor);
  if(!state){state={base:actor.scale.clone(),multiplier:null};actorScales.set(actor,state);}
  if(state.multiplier!==multiplier){actor.scale.copy(state.base).multiplyScalar(multiplier);state.multiplier=multiplier;}
  actor.userData.classificationScale=multiplier;
  actor.userData.championClassification=championClassification(family);
  return actor;
}

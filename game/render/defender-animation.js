// The original Secret controller now samples any exported defender armature.
// Keep its legacy exports for archived sources and existing focused audits.
export {
  SECRET_ATTACK_RELEASE as DEFENDER_ATTACK_RELEASE,
  createSecretAnimation as createDefenderAnimation,
  releaseSecretAttack as releaseDefenderAttack,
  secretAttackContext as defenderAttackContext,
  updateSecretAnimation as updateDefenderAnimation,
  resetSecretAnimation as resetDefenderAnimation,
  previewSecretAttack as previewDefenderAttack,
  updateSecretPreview as updateDefenderPreview,
  disposeSecretAnimation as disposeDefenderAnimation,
} from './secret-animation.js';

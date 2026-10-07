// Lord Bernhard now belongs to the hostile roster (wave 50). Historical
// definitions remain available for archived editions; current play excludes
// his former friendly recipe and unit.
import {APPROVED_DEFENDER_NAMES,APPROVED_CHAMPION_DESCRIPTIONS} from './approved-defender-names.js';
// Approved V7/V8 identity copy follows the reconstructed artwork and voices.
// Archived source definitions retain their original names and every gameplay
// property remains the same on the current playable definition.
export const campaignTowers = towers => Object.fromEntries(Object.entries(towers).filter(([id]) => id !== 'lordbernhard').map(([id,definition])=>{
  const name=APPROVED_DEFENDER_NAMES[id];
  return [id,name?{...definition,name,short:name,...(APPROVED_CHAMPION_DESCRIPTIONS[id]?{description:APPROVED_CHAMPION_DESCRIPTIONS[id]}:{})}:definition];
}));
export const campaignRecipes = recipes => recipes.filter(recipe => (recipe.resultFamily || recipe.id) !== 'lordbernhard');
export const campaignWaves = waves => waves.map((wave,index)=>index===49?{...wave,name:'Lord Bernhard, the Black Sorcerer on the Wyvern Queen'}:wave);
export const campaignEnemies = enemies => {
  const name='Lord Bernhard, the Black Sorcerer on the Wyvern Queen',boss=enemies.host_50;
  return {...enemies,host_50:{...boss,name,...(boss.variants?{variants:boss.variants.map(variant=>({...variant,name}))}:{})}};
};

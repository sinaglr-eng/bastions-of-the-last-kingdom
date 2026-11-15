import {recipeFamily} from '../game/core/recipes.js';
// Secret ingredients never appear in public planning or recipe browsers.
// This presentation rule leaves the real combination and combat rules intact.
export const publicRecipe=recipe=>!!recipe&&recipeFamily(recipe)!=='ladyclaire';

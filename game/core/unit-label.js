import {rankLabel} from './recipes.js';

// Each basic class has one distinct letter; the Roman suffix identifies its rank.
export const defenderCode=(stats,tier=1)=>`${stats.unitCode} ${rankLabel(tier)}`;

// This action belongs to the inspected defender, alongside Keep and Downgrade.
export function deepRefitActionMarkup(game,tower=game.selection){
 if(!game.data.fr010||game.phase!=='select'||!tower||tower!==game.selection||tower.state!=='draft'||game.data.towers[tower.family]?.advanced||tower.tier<3||!game.general.level('deep-refit'))return '';
 const cost=game.general.value('deep-refit');
 return `<button type="button" class="text-button fr010-refit" data-action="deep-refit" data-tower-id="${tower.id}" ${game.economy.gold<cost?'disabled':''}>Deep Refit · −2 ranks · ${cost} gold</button>`;
}

// Visual classifications verified against the Gem TD wiki's Towers table.
// These levels identify presentation classes independently of combat buffs and basic ranks.
export const CHAMPION_CLASSIFICATION_SOURCE = 'https://dota2.fandom.com/wiki/Gem_TD#Towers';

export const CLASSIFICATION_LEVELS = Object.freeze({Basic:0, Intermediate:1, Advanced:2, TOP:3, Secret:4});

export const CHAMPION_CLASSIFICATIONS = Object.freeze({
  rimewatch: 'Basic',
  frostblade: 'Intermediate',
  roseguard: 'Intermediate',
  highking: 'Advanced',
  crownofages: 'TOP',
  thornwarden: 'Basic',
  verdantguard: 'Intermediate',
  tempest: 'Intermediate',
  stormcitadel: 'Advanced',
  embercrown: 'Basic',
  worldfire: 'Intermediate',
  starfall: 'Intermediate',
  thunderheart: 'Advanced',
  phoenix: 'TOP',
  greenheart: 'Basic',
  eldergrove: 'Intermediate',
  kingsreach: 'Intermediate',
  sunward: 'Intermediate',
  winterhold: 'Intermediate',
  dawnspire: 'TOP',
  royalmarshal: 'Intermediate',
  stonewarden: 'Intermediate',
  wyvernhunter: 'Basic',
  royalarsenal: 'TOP',
  rangermentor: 'Advanced',
  kingdomprotector: 'Intermediate',
  mothernature: 'TOP',
  royalranger: 'Advanced',
  kingsrangerguard: 'Advanced',
  elvenking: 'TOP',
  fireballista: 'Advanced',
  emeraldgolem: 'Advanced',
  griffinbomber: 'Advanced',
  mechanicalgolem: 'TOP',
  monk: 'Advanced',
  archbishop: 'TOP',
  archangel: 'Advanced',
  ladyclaire: 'Secret',
  lordbernhard: 'Secret'
});

export const championClassification = family => Object.hasOwn(CHAMPION_CLASSIFICATIONS,family) ? CHAMPION_CLASSIFICATIONS[family] : null;
export const championAuraLevel = family => CLASSIFICATION_LEVELS[championClassification(family)] ?? 0;

import {siteUrl} from '../game/site-url.js';

export const homelandArt = name => siteUrl('assets/ui/war-table/homeland/' + name + '.webp');

const factionSigns = {crown:'human', forge:'dwarves', grove:'elves'};
export const woodSignUrl = (id,selected) => homelandArt((factionSigns[id]||id)+(selected?'-ember':'-oak'))+(selected?'?v=engraving':'');
export const woodSign = (id,label,selected) => `<img class="wood-sign" src="${woodSignUrl(id,selected)}" alt="${label}" width="720" height="112" draggable="false">`;

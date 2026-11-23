import {siteUrl} from '../game/site-url.js';

export const homelandArt = name => siteUrl('assets/ui/war-table/homeland/' + name + '.webp');

const factionSigns = {crown:'human', forge:'dwarves', grove:'elves'};
export const enamelSignUrl = (id,selected) => homelandArt((factionSigns[id] || id) + '-enamel-' + (selected ? 'selected' : 'idle'));
export const enamelSign = (id,label,selected) => `<img class="enamel-sign" src="${enamelSignUrl(id,selected)}" alt="${label}" width="${factionSigns[id] ? 920 : 740}" height="202" draggable="false">`;

import {siteUrl} from '../game/site-url.js';

export const commanderArt=name=>siteUrl(`assets/ui/commander-v080/${name==='silhouette'?'silhouette-armed':name}.webp`);
// Utility helpers already return deployment-rooted URLs; catalog art is relative.
export const commanderImageUrl=(src,base=import.meta.env?.BASE_URL||'/')=>src.startsWith('/')?src:siteUrl(src,base);
export const geometricUiArt=id=>siteUrl(`assets/ui/geometric/${id}.svg`);
export const commanderGeneratedArt=id=>siteUrl(`assets/ui/commander-generated/${id}.webp`);
export const commanderSkillArt=id=>commanderGeneratedArt(`skill-${id}`);
const utilities={damage:'skill-blood-wrath',speed:'skill-morale-boost',range:'skill-extended-range',dust:'relic-dust'};
export const commanderUtilityArt=id=>commanderGeneratedArt(utilities[id]||id);
export const emptySlotArtifact={head:'CE-01',neck:'NE-02',chest:'LG-05',weapon:'MO-01',offhand:'MO-02',gloves:'N-14',cloak:'WC-01',feet:'SC-04',ring1:'SK-01',ring2:'NE-10'};

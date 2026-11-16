import {siteUrl} from '../game/site-url.js';

export const commanderArt=name=>siteUrl(`assets/ui/commander-v080/${name}.webp`);
export const commanderSkillArt=id=>commanderArt(`skills/${id}`);
const utilities={equipment:'commander',skills:'basic-defenders',sets:'champions',damage:'champions',speed:'time',range:'recipes',dust:'command-points'};
export const commanderUtilityArt=id=>id==='chests'?commanderArt('chest-3'):siteUrl(`assets/ui/ornate/${utilities[id]||id}.webp`);
export const emptySlotArtifact={head:'CE-01',neck:'NE-02',chest:'LG-05',weapon:'MO-01',offhand:'MO-02',gloves:'N-14',cloak:'WC-01',feet:'SC-04',ring1:'SK-01',ring2:'NE-10'};

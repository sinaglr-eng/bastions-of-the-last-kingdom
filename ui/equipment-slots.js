import {ARTIFACTS} from '../game/core/artifacts.js';
import {commanderImageUrl,emptySlotArtifact} from './commander-art.js';
import {siteUrl} from '../game/site-url.js';

export function equipmentSlotIcon(slot){
 const sample=ARTIFACTS[emptySlotArtifact[slot]||emptySlotArtifact.ring1];
 return `<img class="equipment-slot-icon" src="${commanderImageUrl(sample.art)}" alt="">`;
}
export const backpackIcon=()=>`<img class="backpack-crest" src="${siteUrl('assets/ui/commander-v080/artifacts/hw-02.webp')}" alt="">`;

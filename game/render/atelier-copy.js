// Current gallery copy is English. Recorded source concepts/prompts are linked
// separately and retain their original bytes and language.
export const atelierRankColors=['Blue','Green','Purple','Ivory','Gold','Radiance'];
export const approvedCharacterName=(entry,fallback)=>entry?.name?(entry.reconstruction?.revision==='basic-defenders-v7'?entry.name.replace(/\s+(?:I|II|III|IV|V|VI)$/,''):entry.name):fallback;
export const atelierRankEquipment={
 soldier:['Wooden spear and plain clothing.','Helmet and sword.','Wooden shield.','Steel breastplate.','Full armor and an iron shield.','Closed knight helmet and a longer cape.'],
 archer:['Simple bow and fitted hood.','Shoulder cape and quiver.','Leather vest and curved bow.','Longbow and longer cape.','Shoulder protection and reinforced bow.','Master bow and reinforced vest.'],
 druid:['Wooden staff and a leaf focus.','Layered leaf shoulder cape.','Branching antlers.','Longer cape and forked staff.','Wooden bracers and a green focus.','Broad leaf collar and master staff.'],
 mage:['Pointed wizard hat and simple staff.','Broad wizard hat.','Shoulder cape and larger crystal.','Closed spellbook.','Longer cape and forked staff focus.','Open spellbook and master crystal.'],
 cleric:['Simple hood and a Latin cross.','Miter, ivory stole and cross.','Purple miter with gold edging.','Cape and closed book.','Gold miter and longer cape.','Gold cross and open book.'],
 runebreaker:['Wooden hammer and ruler.','Leather apron and iron hammer.','Work goggles and a bracer.','Longer apron and carpenter hammer.','Steel wrist guards and reinforced apron.','Master hammer and protective plate.'],
 frostwarden:['Fitted hood, winter collar and small ice crystal.','Broad winter collar.','Held ice focus.','Metal bracers and larger crystal.','Large ice shield and layered cape.','Shoulder protection and master ice crystal.'],
 stormcaller:['Geometric hair and a held lightning focus.','Shoulder cape and lightning focus.','Casting bracer and larger lightning focus.','Longer cape and paired wrist guards.','Gold equipment and branching lightning.','Master gloves and enhanced lightning focus.'],
};
export const atelierAuraDescriptions=[
 'Blue aura with rings, sparks and rising light.',
 'Green aura with rings, sparks and rising light.',
 'Purple aura with rings, sparks and rising light.',
 'Gold aura with rings, sparks and rising light.',
 'Secret champion with a gold aura. All three ingredients must be obtained in one round.',
];
export function galleryEnemyProperties(enemy){
 const labels=[];
 if(enemy.resists)labels.push(...Object.entries(enemy.resists).filter(([,value])=>value>0).map(([type,value])=>`${type}: ${Math.round(value*100)}%`));
 for(const [keys,label] of [
  [['blink'],'Teleport'],[['regen'],'Regeneration'],[['refraction'],'Refraction shields'],
  [['cloaked','stealth','cloakDaggers'],'Cloaking'],[['shred'],'Armor shred'],
  [['physicalImmune'],'Physical immunity'],[['magicImmune'],'Magic immunity'],
  [['krakenShell'],'Protective shell'],[['reactiveArmor'],'Reactive armor'],
  [['recharge'],'Health recharge'],[['disarm'],'Disarm'],[['hasteAura'],'Allied haste'],
  [['rush'],'Rush'],[['thief'],'Gold theft'],[['untouchable'],'Defender slowing aura'],
 ])if(keys.some(key=>enemy[key]))labels.push(label);
 if(enemy.evasion)labels.push(`Evasion: ${Math.round(enemy.evasion*100)}%`);
 return labels;
}

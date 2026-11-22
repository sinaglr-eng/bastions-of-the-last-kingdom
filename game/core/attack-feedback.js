// Read-only snapshots for presenting newly applied effects once per contact.
const effects = ['slow', 'freeze', 'stun', 'root', 'petrify', 'burn', 'poison', 'bleed', 'shred', 'healBlock', 'regenReduction'];
export function activeAttackStatuses(enemy) {
  let mask = 0;
  for (let i = 0; i < effects.length; i++) {
    if (enemy.statuses?.[effects[i]]?.time > 0) mask |= 1 << i;
  }
  return mask;
}
export function newAttackStatuses(enemy, before) {
  if (enemy.dead) return [];
  const added = activeAttackStatuses(enemy) & ~before;
  return added ? effects.filter((key, i) => added & (1 << i)) : [];
}

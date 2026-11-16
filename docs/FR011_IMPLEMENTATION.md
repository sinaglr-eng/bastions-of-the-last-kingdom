# FR-011 — Commander armory, current implementation

The current canonical catalog (`data/commander-artifacts.json`, revision 3, combat effects `fr011-v2`) contains **84 artifacts and 11 sets** across ten equipment slots, shared by all three alliances. Commander contains Equipment, Skills, Chests and Sets. Gallery updates remain local only and in English.

Set rarity is independent of an individual artifact’s rarity:

| Set rarity | Sets | Pieces | Item rarities |
| --- | --- | --- | --- |
| Rare | Militia Oath, Scout’s Trail, Steward’s Kit | 2, 4, 4 | Common–Rare |
| Epic | Iron Legion, Stormwing Vanguard, Winter Court, Venom Covenant, Ashen Dragon, Royal Architect | 6 each | Rare, Epic, Legendary |
| Legendary | Celestial, Necromancer | 10 each | Epic, Legendary |

All original artifact IDs and player ownership remain valid. Existing Common/Uncommon pieces in advanced sets are promoted to Rare; the fourth pieces become Epic. New starter pieces use simpler wood, leather, copper and cloth artwork. Every threshold adds to earlier bonuses; pieces in the backpack do not activate a set. Full-set panels show aggregate artifact properties and all set bonuses, with caps applied. Two distinct rings fill the two ring slots without overwriting one another.

## Current complete-set totals

- Iron Legion: +37% army own damage, +12% damage against bosses.
- Stormwing Vanguard: +31% attack speed, **+5 attack range tiles**, +15% disruption resistance.
- Winter Court: **+6 attack range tiles**, +5% damage against slowed/frozen enemies, 12% slow for 2s; 10% freeze chance for 0.8s (half duration on bosses, 6s shared target cooldown).
- Venom Covenant: +2% own damage, +7% damage against poisoned enemies, poison equal to 20% of the originating effective primary hit over 3s; 40% less healing while artifact-poisoned.
- Ashen Dragon: +2% own damage, +10% damage against burning enemies, **+3 attack range tiles**, burn equal to 20% of the originating effective primary hit over 2s, Ember Transfer.
- Royal Architect: **+600 starting gold**, +6 starting CP, +8 starting/current/max keep health, +25% disruption resistance, first boss restores up to 6 keep health once per run.
- Celestial: +40% own damage, +35% attack speed, +6 attack range tiles; cumulative thresholds at 2/4/6/8/10 pieces.
- Necromancer: strongest armor reduction 8 for 2s, 25% slow for 2s, 30% Physical/Magical damage passes through damage immunity; cumulative thresholds at 2/4/6/8/10 pieces. Native status immunity and target restrictions remain unchanged. A stronger native immunity breach takes precedence.
- Militia Oath: +5% own damage.
- Scout’s Trail: +5% attack speed, +2 attack range tiles.
- Steward’s Kit: +100 starting gold, +2 CP, +2 keep health.

Range is a flat tile bonus for new defenses. Aura and splash footprints stay unchanged. Mixed equipment has an overall +8 artifact tile cap; reductions have a −2 tile floor and actual attack range cannot fall below 0.5 tiles. Own damage and attack speed reductions have a −30% floor, with positive caps of +45% and +35%. Starting artifact gold has a +1,000 cap, so the Architect’s +600 is not truncated.

Six new standalone tradeoffs are N-13 through N-18: Heavy Battlemaul (+12% damage, −8% attack speed), Quickstring Gloves (+12% attack speed, −8% damage), Farwatch Lens (+2 range tiles, −6% attack speed), Berserker Crest (+18% damage, −1 range tile), Overclock Ring (+15% attack speed, −10% damage), Oathbreaker Shield (+15% damage, −5% attack speed, −0.5 range tiles). The signs apply to actual combat and appear in the UI and gallery.

## Rewards and saved progress

Every verified boss death grants exactly one chest, identified by run and spawn. It opens after its wave completes or the defense ends. Guest/Developer play does not grant permanent rewards. Tier II guarantees at least Rare within three draws; Tier III guarantees at least Epic within seven draws. Those tiers each draw one item per chest. New pity rules reset only their old incompatible pity counters, once, using a JSON rules marker. Other tiers, owned artifacts, currencies, receipts and account progress remain intact. Durable opening receipts stay idempotent; server-owned rarity draws, duplicate Dust, crafting gates and revision checks remain authoritative.

New runs use `fr011-v2`; existing `fr011-v1` snapshots retain their original percentage range, resource values and frozen equipment. The catalog embeds the minimal legacy effect mappings required to replay those saved runs; it does not preserve an old game release. Save restoration and server health validation derive the correct version. Equipment and skills purchased now affect the next new defense. Existing XP, medals, achievements, historical scores, accounts and active games are preserved. No progression reset or schema migration is introduced.

## Presentation and artwork

A complete set selects its own coherent generated Commander portrait; additional pieces in otherwise unfilled slots are layered over six-piece or starter portraits. Mixed equipment uses the neutral Commander with item overlays. Empty slots use matching engraved SVG slot icons, placed in two columns outside the character’s head. Equipment presets are no longer exposed in the UI; stored presets remain compatible.

Rarity colors fill each image background and label, across equipment, backpack, reward cards and the gallery. Set rarity can be filtered separately. Locked, unowned skills are gray with a prominent exact “Unlock at Level N” line. Eligible purchases appear before owned/medal-shortfall/level-locked entries. The selected skill detail keeps all rank requirements and medal prices visible. The Achievements page title is centered and its “Your next medal” strip is removed.

All eleven complete-set appearances and every artifact are in the existing local gallery, with variable piece counts, complete totals, current values, exact original PNG downloads and exact recorded prompts. Existing review identity remains artifact ID plus original-image SHA256. Source manifests and generated originals are preserved under `artifacts/commander-expansion/`; the current aggregate is `art-manifest.json`. Public delivery contains WebP assets and integrity metadata only. Artwork was produced using built-in `image_gen`; agent review and separate human approval remain distinct.

Validation covers legal set composition, two-ring replacement, rarity pools, exact full effects, signed combat tradeoffs, immunity/status behavior, pity windows, saved-run compatibility, idempotent backend rewards, and UI rendering. Browser QA uses isolated local account fixtures, not production reward grants, and checks iPad landscape/portrait layouts.

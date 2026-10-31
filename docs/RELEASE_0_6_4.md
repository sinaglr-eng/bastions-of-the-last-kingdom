# Forged Alliances TD 0.6.4

Baby Fire Dragon now matches Fire Dragon's displayed native-model height within 0.2%. Its authored shape, animation clips and combat parameters are preserved. Only the private actor's presentation scale changes, from 1 to 3.85; its Basic blue aura remains at the standard class size. Fire Dragon, Mother Fire Dragon and Ancient Dragon Patriarch retain their existing sizes.

The current result screen replaces the previous illustrations with 30 new scenes: five victories and five defeats for each faction. Each of the 30 has a distinct planned central motif, with 45 different champion identities across the set. Every defeat features victorious orcs actively celebrating in the foreground, with faction equipment or defeated champions secondary. Fifteen different approved enemy identities are used across those defeats. Original gallery portraits are identity references; the old faction marching image is not used as a repeated composition template.

The existing presentation-only random bags remain independent by faction and result. Every scene in a group appears before a repeat, immediate cycle-boundary repeats are avoided, and inspecting the same ended run keeps its chosen image. Combat RNG is never used.

## Scene compositions

| Faction | Result | Central motif | Champions |
|---|---|---|---|
| crown | Victory | rooftop-homecoming | Storm Eagle, Royal Scout |
| crown | Victory | artillery-fireworks | Royal Battery, Royal Grenadier |
| crown | Victory | garden-restoration | Nature Spirit, Archdruid |
| crown | Victory | victory-bell | High Priest, Frozen Paladin |
| crown | Victory | royal-victory-council | King, Stormbow Magister |
| crown | Defeat | scavenger-feast | Catapult |
| crown | Defeat | harbor-flag-hoist | Fire Ballista |
| crown | Defeat | mirror-victory-dance | Glacial High Paladin |
| crown | Defeat | stolen-golem-workshop | Golem |
| crown | Defeat | executioner-trophy-procession | Paladin Oathbreaker |
| forge | Victory | boar-victory-race | Boar Warlord, Boar Drummer |
| forge | Victory | world-forge-rekindled | Iron Colossus, Rune Master |
| forge | Victory | griffin-sky-salute | Griffin Commander, Griffin Bomber |
| forge | Victory | mountain-camp-toast | Heavy Sniper, Forge Dwarf |
| forge | Victory | harbor-machines-salute | Fire Furnace, Gatling Golem |
| forge | Defeat | wolf-riders-cannon-race | Siege Cannon |
| forge | Defeat | vault-gold-rain | Rune Guardian |
| forge | Defeat | cavern-rune-ritual | Forge Sentinel |
| forge | Defeat | captured-airship-toast | Dwarf Airship |
| forge | Defeat | orc-victory-drum-circle | Armored Boar Rider |
| grove | Victory | dragon-crater-festival | Ancient Dragon Patriarch, Baby Fire Dragon |
| grove | Victory | phoenix-aurora-flight | Tempest Phoenix, Stormwing Phoenix Rider |
| grove | Victory | moonweb-canyon-revel | Nightweaver Spider Queen, Moonweb Hunter |
| grove | Victory | eagle-waterfall-homecoming | Moonlight Eagle Rider, Moonshadow Huntress |
| grove | Victory | lantern-fen-reclaimed | Eclipse Phantom, Shadow Assassin Master |
| grove | Defeat | hunters-treehouse-revel | Moonlight Ranger Captain |
| grove | Defeat | spell-eater-victory-orb | Moon Banshee |
| grove | Defeat | bat-rider-red-banner-parade | Elven Battlemage Master |
| grove | Defeat | inquisitor-seal-breaking | Stag Bulwark |
| grove | Defeat | executioner-victory-gong | Mother Fire Dragon |

## Asset provenance and validation

Built-in ImageGen generated each image separately from the named individual approved gallery portraits. Exact prompts and reference SHA-256 hashes are saved in output/releases/v0.6.4/outcome-prompts.json. Exact generated PNG originals are retained in outcome-originals/; runtime copies are native-size WebP quality 92 with no cropping, stretching or content editing. The public manifest is public/assets/ui/results/v064/manifest.json. Separate human visual approval has not been recorded. Previous approved images, prompts and releases remain historical evidence.

Native-model size and aura regression tests, all six result cohorts, original/reference/delivery hashes, native delivery dimensions, scene metadata diversity and selection stability are checked automatically. The complete test/build and deployment results are saved under output/releases/v0.6.4. Browser and physical iPad checks remain explicitly waived by the user. The local-only design gallery, combat data and approved model binaries are unchanged.

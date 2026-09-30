# Champion visual classifications

The cosmetic aura follows the **Classification** column of the [Gem TD wiki's Towers table](https://dota2.fandom.com/wiki/Gem_TD#Towers), checked on 30 September 2026. The table was available through the search-rendered wiki page; direct page fetching was restricted. The established `referenceTower` field connects each Bastions champion to its wiki counterpart.

All 37 champions have a corresponding classified tower: **5 Basic, 13 Intermediate, 11 Advanced and 8 TOP**. Royal Storm Arsenal corresponds to Deplemented-Kyparium and is TOP. Archangel is Advanced; Angel is TOP. The wiki writes the final class as `Top`; presentation normalizes that label to `TOP`.

These classes do not change attack damage, range, attack speed, abilities, recipes or ascension ranks. Existing `Mythic` recipe stages remain unchanged; their visual classification is TOP. The eight basic defender families receive no new classification aura. Basic champions retain their existing appearance, Intermediate champions gain a weak aura, Advanced champions a stronger aura and TOP champions a very strong aura.

| Stable family | Bastions champion | Wiki tower | Classification |
| --- | --- | --- | --- |
| rimewatch | Frostbolt Watchmen | Silver | Basic |
| frostblade | Knight | Silver Knight | Intermediate |
| roseguard | Lionheart Champion | Pink Diamond | Intermediate |
| highking | Kingslayer | Huge Pink Diamond | Advanced |
| crownofages | King | Koh-i-noor Diamond | TOP |
| thornwarden | Elven Ranger | Malachite | Basic |
| verdantguard | Elven Elite Warrior | Vivid Malachite | Intermediate |
| tempest | Elemental Mage | Uranium-238 | Intermediate |
| stormcitadel | Elemental Archmage | Uranium-235 | Advanced |
| embercrown | Fire Baby Dragon | Asteriated Ruby | Basic |
| worldfire | Fire Mother Dragon | Volcano | Intermediate |
| starfall | Thunderbird | Bloodstone | Intermediate |
| thunderheart | Dragonrider | Antique Bloodstone | Advanced |
| phoenix | Mage Dragon rider | The Crown Prince | TOP |
| greenheart | Master Druid | Jade | Basic |
| eldergrove | Archdruid | Grey Jade | Intermediate |
| kingsreach | Ballista | Gold | Intermediate |
| sunward | Priest | Chrysoberyl Cat's Eye | Intermediate |
| winterhold | Frost Colossus | Yellow Saphire | Intermediate |
| dawnspire | Angel | Star Sapphire | TOP |
| royalmarshal | Dwarf Firebomber | Paraiba Tourmaline | Intermediate |
| stonewarden | Catapult | Dark Emerald | Intermediate |
| wyvernhunter | Ranger | Quartz | Basic |
| royalarsenal | Royal Storm Arsenal | Deplemented-Kyparium | TOP |
| rangermentor | Bearking | Monkey King Jade | Advanced |
| kingdomprotector | Paladin | Deepsea Pearl | Intermediate |
| mothernature | Mother Nature | Diamond Cullinan | TOP |
| royalranger | Royal Ranger | Lucky Chinese Jade | Advanced |
| kingsrangerguard | King's Ranger Guard | Charming Lazurite | Advanced |
| elvenking | Elven King | Golden Jubilee | TOP |
| fireballista | Fire Ballista | Egypt Gold | Advanced |
| emeraldgolem | Golem | Emerald Golem | Advanced |
| griffinbomber | Dwarf Griffin bomber | Elaborately Carved Tourmaline | Advanced |
| mechanicalgolem | Mechanical Golem | Sapphire Star of Adam | TOP |
| monk | Monk | Red Coral | Advanced |
| archbishop | Archbishop | Carmen-Lucia | TOP |
| archangel | Archangel | Northern Saber's Eye | Advanced |

Runtime source: `game/render/champion-classification.js`. Classification depends on the stable family ID, so ascended copies keep their family classification.

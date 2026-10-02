# Champion visual classifications

The cosmetic aura follows the **Classification** column of the [Gem TD wiki's Towers table](https://dota2.fandom.com/wiki/Gem_TD#Towers), checked again on 1 October 2026. The table was available through the search-rendered wiki page; direct page fetching was restricted. The established `referenceTower` field connects each Bastions champion to its wiki counterpart.

All 37 ordinary champions have a corresponding classified tower: **5 Basic, 13 Intermediate, 11 Advanced and 8 TOP**. Royal Storm Arsenal corresponds to Deplemented-Kyparium and is TOP. Archangel is Advanced; Angel is TOP. The wiki writes the final class as `Top`; presentation normalizes that label to `TOP`.

Version 0.2.8 adds two **Secret** champions, Lady Claire (Fantastic Miss Shrimp) and Lord Bernhard (Diamond Cullinan), with an enhanced gold aura (`#ffd969`, runtime level 4) in art patch 9. Ordinary classifications retain their original equal-size auras; Secret effects use a brighter ground glow and taller light wisps. They use distinct current-round-only recipes; Nature Spirit keeps its existing TOP classification and Diamond Cullinan reference. The full roster has 39 champions.

These classes do not change attack damage, range, attack speed, abilities or recipe ingredients. Fixed recipe stages now use these four classifications directly, including TOP. Every ordinary champion has the same large, strong aura, with three ground rings, eighteen motes and six rising wisps. Only the color varies: Basic blue (`#3989ed`), Intermediate green (`#3eac63`), Advanced purple (`#9555d8`) and TOP gold (`#ffd969`). The eight ordinary basic defender families retain their existing rank appearance.

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
| mothernature | Nature Spirit | Diamond Cullinan | TOP |
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
| ladyclaire | Lady Claire | Fantastic Miss Shrimp | Secret |
| lordbernhard | Lord Bernhard | Diamond Cullinan | Secret |

Runtime source: `game/render/champion-classification.js`. Classification depends on the stable family ID; rendering uses `game/render/champion-aura.js`. The approved roster has 39 fixed champion forms (37 ordinary and two Secret), without additional Ascension recipes.

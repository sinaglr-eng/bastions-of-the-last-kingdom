# Schválené změny vyvážení MVP, ranku VI, kontroly a dosahů

Datum: **18. 10. 2026**. Ověřený základ: **aktuální pracovní verze 0.4.5**. Stav B01–B06: **SCHVÁLENO UŽIVATELEM — NEIMPLEMENTOVÁNO**. Implementace je odložena do chatu Master verze hry. Výjimka ze schválení: Nature Spirit a Mother Nature si ponechají bonus dostřelu +3; Archdruid přejde na +1. Ostatní navržené změny jsou schválené. Tento balík je samostatný od dříve schváleného UI a od balíčku VFX B07, který byl následně také samostatně schválen. Přesné znění souhlasu obsahuje [záznam schválení](../output/design/balance-proposal-20261018-v1/approval.json).

Návrh vychází ze skutečných profilů po campaignTowers a z aktuálního combat/merge kódu, nikoli ze staré galerie nebo samotných historických JSONů. Číselné dopady níže jsou analytické. Nové hodnoty nebyly spuštěny v kampani ani aplikovány do runtime a nelze z nich tvrdit ověřenou dokončitelnost.

## B01 — MVP bez aur, osobní maximum +50 %

| Mechanika | Aktuálně | Návrh |
| --- | --- | --- |
| Maximum MVP | 10 úrovní | 10 úrovní |
| Vlastní poškození | +10 % za úroveň, maximum +100 % | **+5 % za úroveň, maximum +50 %** |
| Bonus spojencům při MVP 10 | +75 % v poloměru 2 políček | **Odstranit** |
| MVP snížení armoru nepřítele | −1 % za úroveň, maximum −10 % v poloměru 2 | **Odstranit** |

Zachovat výběr vítěze kola, přidělování úrovní a dědění nejvyššího MVP při kombinaci/sloučení, nikoli součet. Existující MVP 10 se při načtení interpretuje jako +50 %, nemusí se mazat uložené úrovně. Zmizí související účinky, vizualizace a popisky obou MVP aur; hodnost MVP a osobní bonus zůstanou viditelné. Klasifikační aury šampionů ani nezávislé podpory se tím samy o sobě nemažou.

Maximum +50 % platí pro **příspěvek MVP**, ne pro celkové výsledné poškození po ostatních existujících buffech. Protože současný engine škáluje MVP i poison, burn, aura damage a lightning přes scaleDamageStats, návrh snižuje jejich vlastní MVP násobitel stejným pravidlem; nevytváří výjimku pro DOT.

Samotné maximum přejde z násobitele 2 na 1,5: jde o **25% pokles** osobního výstupu při jinak stejných podmínkách. Obránce s vlastním MVP 10 a cizí MVP 10 aurou dnes používá MVP složku 2,75; nově 1,5, tedy přibližně **45,45% pokles** této složky. Výpočet ještě nezahrnuje ztrátu armor aury, skutečné obrany a čas v dosahu.

## B02 — Rank VI jen ze dvou nových ranků V v jednom draftu

Dnes lze spojit i dvě již ponechané V nebo ponechanou V a současného kandidáta. Návrh tuto výjimku ruší. Pro V → VI musí jít o **dva skutečně vylosované obránce stejné základní rodiny a ranku V v témže aktuálním dokončeném, neuzavřeném pětimístném draftu**. Oba mají skutečná různá ID mezi jeho umístěnými sloty. Sloučení vyřeší volbu tohoto kola.

Nepovolovat pár z předchozích kol, retained + draft, dvě retained jednotky, neaktivní rezervu ani přenesený reserve slot. Rezervace není nový hod v aktuálním draftu. Legální reroll lze použít: dvojice musí současně existovat ve výsledném aktuálním draftu, nejde uchovat jednu V před rerollem a spojit ji s již neexistující předchozí identitou. Nižší ranky a stávající výsledky/pozice po sloučení se tím nemění. Již získané VI v uložených hrách se zpětně nedegradují.

**Dostupnost:** při současném maximálním mastery je V v jednom slotu 20 % a osm rodin má stejnou váhu. U pěti nových nezávislých slotů je pravděpodobnost alespoň jedné shodné V dvojice přibližně **4,72 %**. Pro jednu konkrétní rodinu jen **0,59 %**. Nejde o pravděpodobnost vítězství ani celé kampaně; výpočet nezahrnuje rezervace, forced draws a strategii rerollů.

Zásadní vedlejší dopad: **Dwarship vyžaduje Druid VI i Engineer VI** vedle Dwarf Griffin bomber. Může se výrazně zhoršit dostupnost jeho receptu, i kdyby byl v boji silnější. Změnu receptu zde automaticky nenavrhuji jako schválenou; po ověření dostupnosti může být samostatným rozhodnutím. Mythic nemá být povinnou podmínkou dokončení kampaně.

## B03 — Frozen Celestial pouze proti pozemním

Aktuálně: Holy zásah 60, interval 1 s, dosah 6 a průběžná **75% slow aura**, která dnes není omezena na pozemní cíle. Návrh zachovává Holy a hodnotu zpomalení. Omezí **přímý útok i vlastní slow auru pouze na pozemní jednotky**. V B05 navrhuji útok 5 políček a samostatný poloměr aury 4,5.

Boss obdrží při současném násobiteli 0,5 nominálně 37,5% slow. Physical immunity nadále blokuje zpomalení, přestože přímé poškození je Holy. Jednotka není melee: ground-only filtr musí být samostatná vlastnost; nesmí zkrátit kontakt projektilu ani nechtěně měnit cleave/chain pravidla jiných obránců. Létající cíle nesmějí být zasaženy ani zpomaleny jeho vlastními kanály. Doplňkový návrhový cíl je uvolnit protiletadlovou roli rangerům.

## B04 — Lokální slow aury rangerů

| Obránce | Aktuální obecná slow aura | Návrh aury | Poloměr | Současný anti-air slow ze zásahu |
| --- | --- | --- | --- | --- |
| Master Ranger | Nemá | **25 %** | **3,5** | 40 % / 3 s, zachovat |
| Dark Ranger | Nemá | **30 %** | **3,5** | 50 % / 3 s, zachovat |
| Ranger Oathbreaker | Nemá | **40 %** | **4** | 75 %, současný výchozí čas 2 s, zachovat |

Nové aury budou průběžné v uvedeném okruhu, proti pozemním i létajícím jednotkám při zachování stávající imunity slow. Po opuštění aury nevytvářejí další přetrvávající debuff. Platí **jen nejsilnější zpomalení**, nikoli sčítání ani násobení mezi aurami a zásahy. Pro bossy nadále poloviční síla. Pozastavení útoků zdroje vypne tuto útočnou auru stejně jako dnešní slow aury.

Master Ranger má nižší obecnou kontrolu, protože už poskytuje poison, anti-air a obnovu životů; Dark Ranger má silnější kontrolní specializaci. Oathbreaker má vyšší strop, avšak malý okruh a stále silnější anti-air slow až po zásahu. Jejich současné poison/burn/armor/crit hodnoty zde mimo výslovně uvedené změny neměním. Poloměr slow musí být oddělen od dosahu střelby, jinak by range buffy vytvářely téměř celomapovou kontrolu.

## B05 — Dosahy podle role, nikoli jedno plošné procento

Základní princip: krátký útok zůstane krátký, běžný střelec se musí správně umístit, dělostřelectvo si zachová delší dostřel a drahý Mythic/Top má viditelnou výhodu. Uživatel výslovně zachoval silnou podporu Nature Spirit a Mother Nature: jejich bonus zůstane +3. Pouze Archdruid přejde na +1. Bonusy se nadále nesčítají; použije se nejsilnější dostupný zdroj.

### Základní obránci

Pořadí hodnot je **I / II / III / IV / V / VI**, jednotka je políčko. Soldier záměrně nezkracuji; je už omezený na blízký pozemní boj.

| Rodina | Aktuálně | Návrh |
| --- | --- | --- |
| Soldier | 2,5 / 2,5 / 2,5 / 2,5 / 2,5 / 2,5 | 2,5 / 2,5 / 2,5 / 2,5 / 2,5 / 2,5 |
| Archer | 4 / 4 / 4 / 4 / 4 / 5 | 3,5 / 3,5 / 3,5 / 3,5 / 3,5 / 4,5 |
| Druid | 5 / 5 / 5 / 5 / 5 / 5 | 4,5 / 4,5 / 4,5 / 4,5 / 4,5 / 4,5 |
| Mage | 5 / 5 / 5 / 5 / 5 / 5 | 4,5 / 4,5 / 4,5 / 4,5 / 4,5 / 4,5 |
| Cleric | 5 / 5 / 5 / 5 / 5 / 5 | 4,5 / 4,5 / 4,5 / 4,5 / 4,5 / 4,5 |
| Engineer | 5 / 5 / 5 / 5 / 5 / 5 | 4,5 / 4,5 / 4,5 / 4,5 / 4,5 / 4,5 |
| Frost Warden | 6 / 6 / 6 / 6 / 6 / 6 | 5 / 5 / 5 / 5 / 5 / 5 |
| Stormcaller | 6 / 5 / 5 / 5 / 5 / 12 | 5 / 4,5 / 4,5 / 4,5 / 4,5 / 8 |

### Šampioni

Jde o dosah přímého útoku nebo hlavního útočného kanálu; u draků bez přímého útoku je hlavním kanálem damage aura. Další aury se řídí samostatnou tabulkou níže. Nezměněné siege/anti-air profily jsou úmyslnou rolovou výjimkou.

| Obránce | Aktuálně | Návrh |
| --- | ---: | ---: |
| Frostsword Watchmen | 6 | 5 |
| Frost Knight | 7 | 5,5 |
| Lionheart Champion | 6 | 5 |
| Kingslayer | 10 | 7,5 |
| King | 12 | 9 |
| Elven Ranger | 6 | 5,5 |
| Elven Elite Warrior | 7 | 6 |
| Elven Mage | 7 | 5,5 |
| Elven Archmage | 8 | 6,5 |
| Baby Fire Dragon | 6 | 4,5 |
| Mother Fire Dragon | 6 | 5 |
| Thunderbird | 7 | 6 |
| Elemental Male Dragon | 8 | 6,5 |
| Ancient Dragon Patriarch | 10 | 8 |
| Master Druid | 8 | 6 |
| Archdruid | 8 | 6 |
| Ballista | 6 | 6 |
| Priest | 5 | 4,5 |
| Frozen Celestial | 6 | 5 |
| Archangel | 9 | 7 |
| Dwarf Firebomber | 6 | 5,5 |
| Catapult | 7 | 7 |
| Ranger | 5 | 5 |
| Elven King | 10 | 8 |
| Nature Spirit | 10 | 7 |
| Paladin | 5 | 4,5 |
| Mother Nature | 13 | 9 |
| Master Ranger | 9 | 7 |
| Dark Ranger | 8 | 6,5 |
| Ranger Oathbreaker | 8 | 7,5 |
| Fire Ballista | 7 | 7 |
| Golem | 7 | 5,5 |
| Dwarf Griffin bomber | 7 | 6,5 |
| Dwarship | 8 | 7 |
| High Priest | 5 | 4,5 |
| Archbishop | 5 | 4,5 |
| Angel | 5 | 4,5 |
| Lady Claire | 10 | 8 |

### Oddělené poloměry a range buffy

| Účinek | Aktuálně | Návrh |
| --- | --- | --- |
| Range bonus Archdruid | +3 | **+1** |
| Range bonus Nature Spirit, Mother Nature | +3 | **Ponechat +3**, výslovná výjimka uživatele |
| Poloměr této podpory | Archdruid 8, další dva 6 | **5** |
| Slow aura Frozen Celestial | 6 | **4,5**, pouze pozemní |
| Slow aura Archangel | 9 | **5** |
| Slow aura Angel | 5 | **4** |
| Haste aura Archangel | 6 | **5**, sílu haste neměnit |
| Burn aura Baby/Mother Fire Dragon | 6 / 6 | **4,5 / 5** |
| Burn aura Elemental Male Dragon | 8 | **5,5**, střelba zvlášť 6,5 |
| Burn aura Ancient Dragon Patriarch | 10 | **6,5**, střelba zvlášť 8 |
| Stone Gaze Golem | 10 | **7**, ostatní parametry efektu zachovat |
| Chain range Lady Claire | 10 | **6**, přímé zaměření zvlášť 8 |
| Ostatní běžné ally support aury | Převážně 5 | **Ponechat současných 5** |

Bonus +1 od Archdruid nebo +3 od Nature Spirit/Mother Nature platí pro dosah přímého zaměření; nesmí zároveň natahovat samostatně definované slow/burn/shred/support poloměry. Použije se nejsilnější zdroj, ne součet. Poloměr poskytování podpory je u všech tří schválen na 5 políček; uživatelská výjimka zachovává velikost bonusu +3. Čisté aura jednotky získají ze zvyšování attack range pouze to, co výslovně stanoví jejich profil. Tento rozdíl je schválená budoucí mechanika, nikoli tvrzení o dnešním enginu, kde několik kanálů sdílí stats.range. Náhled v UI musí ukazovat oddělené kruhy/popisky pouze při inspekci.

Pro ilustraci: zmenšení kruhu z 6 na 5 sníží jeho geometrickou plochu o 30,56 %. **Neznamená to automaticky −30,56 % DPS**: rozhoduje skutečný průchod nepřátel, maze, opakované vstupy, projektily a přetrvávající efekty. Po schválené výjimce dosáhne Mother Nature/King s nejsilnějším bonusem +3 na 12 políček; dřívější návrh maxima 10 již neplatí. Dnešní Mother Nature s bonusem dosahuje 16.

## B06 — Silnější armor specializace trpasličí větve

Skutečný řetězec je **Dwarf Firebomber → Dwarf Griffin bomber → Dwarship**. Fire Ballista do této receptové větve nepatří.

**Potvrzený rozsah P1 (18. 10. 2026):** uživatel odpověděl „Pouze armor aura MVP“. Odstranění se týká pouze MVP; armor aury šampionů se zachovají. Následným souhlasem s B01–B06 uživatel schválil i níže uvedené číselné změny varianty A. Implementace v tomto chatu není povolena.

### Platný návrh — odstranit MVP auru, posílit trpasličí aury

| Obránce | Armor aura dnes → návrh | Poloměr dnes → návrh | Zásahový armor debuff |
| --- | --- | --- | --- |
| Dwarf Firebomber | −15 → **−20** | 4 → **4** | Žádný nový |
| Dwarf Griffin bomber | −30 → **−35** | 7 → **4,5** | Žádný nový |
| Dwarship | −30 → **−45** | 12 → **5,5** | **−64 / 4 s ponechat** |

Aura tedy bude silnější v místě nasazení, ale nebude pokrývat velkou část mapy. Nadále platí nejsilnější ploché snížení včetně přímého debuffu, nikoli součet aura + zásah. Armor má dolní hranici nula. Dwarship svůj silnější zásah −64 nezvyšuje jen kvůli číslu: základní armory pozdních profilů jsou zhruba do 48, takže další růst často nepomůže; reaktivní armor a modifikátory se musí posoudit zvlášť.

Při armoru 48 je bez podpory násobitel zásahu 30/(30+48)=0,3846. Snížení 30 dává 0,625; snížení 45 dává 0,9091, tedy **+45,45 % přenosu damage oproti dosavadní auře** v tomto konkrétním případě. Neplatí proti imunitě ani všem dalším vrstvám obrany. Silnější aura tudíž nesmí dostat i velký dosah nebo aditivní stacking.

Původně zvažovaná alternativa odstranění všech armor aur a jejich náhrady zásahovým snížením −20 / −35 / −70 byla po upřesnění uživatele vyřazena. Není součástí aktuálního návrhu ani podkladem pro implementaci.

## Doporučené pořadí ověření před nasazením

Nezavádět celý balík jako jeden neodlišený experiment. Nejdřív izolovat B01 (MVP), pak dostupnost B02 (včetně receptů VI), potom B03/B04 a zvolenou variantu B06. B05 vyhodnotit zvlášť a nakonec ve společné konfiguraci. Tím lze zjistit, zda prohra vzniká z dostupnosti armády, ztráty bonusů nebo skutečné délky střelby.

Před schválením produkčních hodnot ověřit legální draft/merge včetně rerollu a rezerv; více skutečně získatelných Physical/Magical/Holy mixů; pozemní i létající a obě imunitní větve; vlny 10/20/30/38/40/45/49/50, obě varianty kde existují, různé maze a více seedů. TOP lze v této nové revizi samostatně porovnat, ale musí existovat i životaschopné alternativy bez něj. Vložená pozdní armáda není důkaz legální dosažitelnosti. Zaznamenat úniky, HP, čas v dosahu, zdroje účinků a složení získané z draftu, ne jen teoretické DPS.

Regrese musí zahrnout přesný MVP strop/inheritance, žádný zbytkový MVP armor/ally bonus, ground-only direct i aura Frozen Celestial, vstup/výstup ranger aury, strongest-only a boss multiplier, imunitu, oddělené poloměry, armor minimum, staré save hry a nové pravdivé popisky/kruhy/UI. Armor aury šampionů se podle potvrzeného P1 zachovají; hodnoty B06 jsou schválené. Zvlášť ověřit bonusy Archdruid +1, Nature Spirit +3 a Mother Nature +3 a nejsilnější zdroj bez sčítání.

## Evidence a status

- [Aktuální runtime snapshot](../output/design/balance-proposal-20261018-v1/runtime-reference.json) obsahuje všech 86 profilů, recepty, MVP pravidla a pravděpodobnostní předpoklady.
- [Strojově čitelný návrh](../output/design/balance-proposal-20261018-v1/proposals.json) je oddělen od produkční konfigurace.
- [Ověření nezměněných zdrojů](../output/design/balance-proposal-20261018-v1/verification.json) se týká přípravy podkladů, nikoli herní vyváženosti.

Všechny hodnoty B01–B06 jsou schválené s výjimkou zachovaných bonusů +3 od Nature Spirit a Mother Nature, které tento dokument již zapracovává. Recept Dwarship se nemění. Schválení návrhu není implementace ani nasazení; provedení patří do chatu Master verze hry. Schválený vizuální handoff ze dne 16. 10. 2026 zůstává historicky zachovaný. Nový návrh efektů útoků a schopností má samostatný stav schválení.

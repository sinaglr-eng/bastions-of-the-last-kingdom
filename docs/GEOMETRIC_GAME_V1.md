# Geometrická herní edice 0.3.0

Aktivní sada obsahuje 136 postav: osm základních tříd v šesti úrovních, 37 běžných šampionů, Lady Claire a 50 nepřátel. Lord Bernhard je nepřátelský čaroděj na wyverně v 50. vlně. Jeho dřívější přátelská jednotka a recept se v aktuální edici nenabízejí. Historické definice a soubory předchozí edice jsou zachované.

## Soubory a reference

Hra načítá GLB a portréty z `public/assets/geometric/`. Tři manifesty oddělují základní obránce, šampiony a nepřátele. `source-manifest.json` zaznamenává SHA-256 schválených šestipohledových podkladů. Editovatelné scény jsou v `blender/scenes/geometric-game-v1/`; reference jsou zabalené uvnitř scén. Každý model má šest renderů se stejnou geometrií a pózou. Mění se pouze kamera.

Nativní souřadnice: metry, Z nahoru, +Y vpřed, +X anatomická pravá strana. GLB: Y nahoru, −Z vpřed. Lidské měřítko vychází z předchozí nominální výšky 1,8 m; držení zbraní, pokrývky hlavy, křídla a jízdní zvířata mohou zvětšit celkový obal modelu. Rasterové koncepty nemají fyzické kóty a mírně se liší mezi pohledy. Absolutní rozměrová přesnost 1 % ani shoda siluety IoU ≥ 0,97 nejsou certifikované.

## Opravy a pohyb

Soldier VI má uzavřenou přilbu bez skryté kožní hlavy a krku. Kapuce mají skutečnou tloušťku, přední otvor a uzavřený zadní objem. Zakryté části hlavy se kontrolují paprsky proti skutečné geometrii; hlava a její pokrývka sdílejí rigidní kloub, takže se při pohybu nerozejdou.

Útoky používají skutečné klouby paží, zápěstí a drženého vybavení. Příprava, vypuštění a návrat se řídí bojovým cooldownem, podporou a omezeními jednotky. Projektil vzniká z aktuálního bodu zbraně. Runebreaker má úder kladivem a fyzický runový projektil; kopí, meče, luky, hole, dračí dech a obléhací zbraně mají příslušné pohyby. Hra nemění jejich poškození, intervaly, dosah ani receptové statistiky.

Kamenný a ledový golem útočí pěstí. Mechanický golem používá zpětný ráz dvojitého děla a kovový toxický projektil ze skutečné hlavně. Kopí a jízdní lance se při výpadu pohybují předkem modelu; výstupní bod jízdního bojovníka patří jeho zbrani, zatímco dračí dech začíná v tlamě.

Nepřátelé mají pohyb podle anatomie: chůzi dvounožců, diagonální kroky čtyřnožců, pohyb strojů a mávání křídel. Pohyb vychází z uražené vzdálenosti; teleport nezrychluje kroky. Zamrznutí, zkamenění a pauza zastavují příslušný pohyb. Jezdec zůstává v sedle a jeho nohy ve třmenech.

Při smrti stejný model padne na zem. Kontakt se terénem se kontroluje během pádu a zachovává původní měřítko. Tělo zůstává neprůhledné a viditelné do události `wave-complete`, včetně finální vlny. Smrt skrytého nepřítele neprozrazuje jeho polohu.

## Efekty a ověření

Stávající aury hodností, šampionů, nepřátel a skutečně působící podpory zůstávají zapojené. Nové symboly odrážejí aktuální brnění, odolnosti, imunity, refrakci a regeneraci. Teleport zobrazí trhlinu v místě skutečného odchodu a příchodu. Efekty respektují odhalení nepřítele, pauzu a omezený pohyb a při zániku uvolňují vlastní prostředky.

`tests/geometric-game-assets.test.mjs` načítá všech 136 exportů skutečným GLTFLoaderem a kontroluje úplnost, otisky souborů a referencí, geometrii, normály, převod os, portréty a metadata pohybu. `tools/verify-geometric-runtime.mjs` kontroluje importované klouby, nezávislost instancí, fáze útoku, pohyb a zemní kontakt při smrti. Integrační testy ověřují skutečné události teleportu a konec vlny. Tyto technické výsledky nenahrazují porovnání vzhledu s podkladem.

Záznamy `source-six-review.json` obsahují skutečné vizuální porovnání všech 816 párů předloha/render. U každé postavy zaznamenávají otisk GLB, zdroje a všech šesti prohlédnutých renderů. Kontrola se zaměřuje na významnou výstroj, pravou a levou stranu těla, zakrytí hlavy a viditelné průniky. Po opravách byly dotčené šestice prohlédnuty znovu. Balicí skript odmítne změněný model nebo render bez aktuálního záznamu kontroly.

`tools/verify_geometric_native_v1.py` otevře každý nativní soubor přímo v Blenderu a porovná jeho skutečnou geometrii s exportem. Kontroluje také bajty zabalené šestipohledové reference proti jejímu SHA-256. Restart hry uvolňuje vlastněné geometrie, materiály a textury; pozdě dokončené načítání se po zrušení bojiště ihned uvolní.

Optimalizace spojuje pouze neprůhledné části pod stejným kloubem se stejným materiálem. Uchovává názvy, výstupní body, tětivy a samostatné efekty. Testy porovnávají skutečné vrcholy, normály, materiály, útoky a smrt před optimalizací i po ní; statický počet renderovacích volání není měřením FPS.

Atelier `archer.html` poskytuje všech 86 aktivních obranných variant, šest pevně volitelných pohledů a ovládání náhledu útoku. Nasazení používá stávající GitHub Pages a ověřuje vydaný commit, sestavení a nové soubory na veřejné adrese.

Archiv `output/design/geometric-game-v1-complete.zip` obsahuje editovatelné scény, GLB, portréty a kontrolní podklady. Přiložené generátory a ověřovací nástroje se spouštějí v checkoutu hry s jejími závislostmi; archiv není samostatnou distribucí celé hry. Zabalené reference lze prohlížet přímo v jednotlivých scénách Blenderu.

# Opravy podle uživatelských připomínek po vydání 0.3.0

Předchozí archiv `output/design/geometric-game-v1-complete.zip` zůstává zachován. Nové úpravy mají verzi 0.3.1 s novým klíčem mezipaměti. Přiložené screenshoty ukazují skutečné vady; technické počty a dřívější omezená kontrola výstroje nepotvrzují správnou návaznost povrchů.

## Přijaté požadavky

1. a 21. Otočit luky všech Archerů o 90° do roviny směru střelby; odpovídající tětiva, úchop a projektil při útoku.
2. Vyrovnat boty vůči holením a prověřit ostatní postavy v klidu i při pohybu.
3., 4. a 12. Klobouky a čepice musí přiléhat k hlavě, hlava musí navazovat na krk a tělo. Prověřit všechny postavy.
5. Frost Warden I dostane bílý zimní límec také; jde o výslovnou uživatelskou změnu proti předloze.
6. Přepracovat všech šest Stormcallerů: souvislé proporce, členěné vlasy, správné vrstvy a držené blesky.
7. a 11. Lem kapuce musí vycházet ze skutečného obrysu jejího otvoru. Elven Ranger má také správně orientovaný a propracovaný luk.
8. a 9. Knight (`frostblade`) a Lionheart Champion (`roseguard`): skutečná koňská anatomie a přiléhající členěná zbroj podle předloh.
10. Kingslayer (`highking`): správně tvarovaný meč a přilba místo robotické tváře.
13. Fire Baby Dragon (`embercrown`): podrobnější anatomie, hlava, křídla, trup a končetiny podle předlohy.
14. Thunderbird (`starfall`): ptačí proporce, zobák, peří a křídla podle předlohy.
15. Jezdec na drakovi skutečně sedí v sedle, s připojenými stehny a výrazně odlišným materiálem zbroje podle předlohy.
16. Více fyzických segmentů končetin tvorů; správná návaznost kolen, hlezen a tlap.
17. Přilby všech vojáků mají skutečný tvar skořepiny, hledí a nákrčníku bez prosvítající kůže.
18. King's Ranger Guard (`kingsrangerguard`): štít bude na zádech, kuše a ruce zůstanou volné.
19. Zachovat Lady Claire a použít její členité, zakřivené tvary jako standard detailu ostatních postav.
20. Mírně zmenšit postavy na bojišti (počáteční faktor 0,88); zachovat autorské měřítko v Blenderu a Atelieru i výšku hradních platforem.
22. Royal Atelier: přepínač obránci/nepřátelé, všech 50 aktuálních nepřátel, šest pohledů, náhled skutečné chůze/letu, pauza, rychlost, aury a stažení GLB/portrétu. URL musí uchovávat konkrétní postavu a hodnost pro další komentáře.

## Vlastnictví práce

- `defender_models`: autor 48 základních obránců a jejich nativní geometrie.
- `enemy_champion_models`: autor šampionů a nepřátel, jejich společné geometrické pomocné funkce.
- `runtime_motion`: návaznost pohybu, úchop luků a skutečné fyzické kontakty importovaných částí.
- root: Atelier, měřítko bojiště, integrace, nové kontrolní podklady, archiv a publikace.

## Podmínky dokončení

Kontrolovat skutečné povrchy, mezery a překryvy, nikoli pouze konečné souřadnice kloubů. Dotčené modely prohlédnout ze všech šesti pohledů podle předloh a v živém Atelieru při klidu i animaci. Celou sadu prověřit na kontakt klobouk/hlava/krk, přilba/nákrčník a bota/holeň. Zachovat útoky, statistiky, aury, teleporty a neprůhledná těla do konce celé vlny. Před publikací musí projít herní testy, nativní a runtime kontroly; po publikaci ověřit skutečně doručené soubory a veřejný náhled. Rasterové podklady nemají fyzické kóty, takže se necertifikuje absolutní 1% rozměrová přesnost.

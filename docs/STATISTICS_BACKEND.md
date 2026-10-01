# Statistiky hry a žebříček

Od verze **0.2.6 · Guided Kingdoms** hra na GitHub Pages odesílá statistiky samostatné službě [Bastions Statistics](https://bastions-of-last-kingdom-statistics.sinagl-r.chatgpt.site). Její nasazení bylo potvrzeno 1. října 2026; HTTP kontroly ověřily zdraví databáze, veřejný žebříček a chráněný vlastnický report. `backend/worker.js` používá Cloudflare D1; `backend/server.mjs` stejnou logiku spouští lokálně nad trvalou databází SQLite. Samotný statický web databázi nehostuje.

## Lokální spuštění

Použij Node.js 24, který obsahuje `node:sqlite`. Z kořene projektu:

```powershell
node backend/server.mjs
```

Výchozí adresa je `http://127.0.0.1:4180`. Server vytvoří databázi `artifacts/statistics/bastions.sqlite` a soukromý soubor `artifacts/statistics/owner-token.txt`; záznamy přežijí restart serveru. Adaptér zapíná cizí klíče a režim WAL, celé checkpointy ukládá v transakci. Adresář `artifacts/` je ignorovaný Gitem. Databázi zálohuj konzistentní SQLite zálohou, protože běžící WAL databáze může mít další soubory `-wal` a `-shm`.

Proměnné serveru:

| Proměnná | Význam a výchozí hodnota |
|---|---|
| `PORT` | Port API, `4180`. |
| `HOST` | Adresa naslouchání, `127.0.0.1`. |
| `STATISTICS_DATA_DIR` | Adresář databáze a místního vlastnického tokenu, `artifacts/statistics`. |
| `ADMIN_TOKEN` | Vlastnický token; při vynechání server načte nebo vytvoří `owner-token.txt`. |
| `GAME_ORIGINS` | Seznam přesných povolených originů oddělených čárkou. Místní výchozí seznam zahrnuje localhost/127.0.0.1 na portech 4174 a 5173 a `https://sinaglr-eng.github.io`. |

Pro lokální frontend nastav adresu před spuštěním Vite nebo sestavením hry:

```powershell
$env:VITE_STATISTICS_API = 'http://127.0.0.1:4180'
pnpm dev
```

`VITE_STATISTICS_API` je veřejná adresa API zabalená do frontendového sestavení. Záložní adresa je `STATISTICS_API_URL` v `game/statistics-config.js`. Po změně adresy je nutné frontend znovu sestavit. `ADMIN_TOKEN` ani `STATISTICS_ADMIN_TOKEN` nikdy nevkládej do proměnných s prefixem `VITE_`, zdrojů frontendu, GitHub Pages ani veřejného repozitáře.

## Samostatné veřejné API

Veřejná služba používá samostatný projekt Sites s D1 bindingem `DB`. Její databázové migrace vznikají ze schématu `backend/sites-db-schema.ts`; nasazení musí přibalit vygenerované migrace i jejich metadata. Tajný `ADMIN_TOKEN` patří pouze do serverového prostředí. `GAME_ORIGINS` musí obsahovat origin publikované hry. Frontend používá veřejnou HTTPS adresu služby v `game/statistics-config.js`, případně ji lze při sestavení přepsat pomocí `VITE_STATISTICS_API`. Dokud chybí platná adresa, online sběr je vypnutý; samotné lokální záznamy nejsou společnou databází hráčů.

Nesoukromé údaje nasazení a jeho zdrojový commit jsou v `backend/SITES_DEPLOYMENT.json`. Aktuální služba zobrazuje veřejný [žebříček](https://bastions-of-last-kingdom-statistics.sinagl-r.chatgpt.site/) a [vlastnický panel](https://bastions-of-last-kingdom-statistics.sinagl-r.chatgpt.site/owner). Pro panel použij token v místním ignorovaném souboru `artifacts/statistics/sites-owner-token.txt`; token není součástí repozitáře ani frontendového sestavení. Veřejná jsou pouze jména, která hráči sami uloží do žebříčku, a jejich výsledky; podrobné statistiky vyžadují vlastnický token.

Ve Windows může původní Bash balicí pomocník Sites selhat při předávání cest. `tools/package-statistics-site.mjs` používá stejný validátor `prepare-site-build.cjs` ze skillu Sites, balí ověřené `dist/server/index.js`, `.openai/hosting.json` a kompletní Drizzle migrace s metadaty do archivu `dist/`. Přijímá cestu k checkoutu služby, absolutní cestu výsledného `.tar.gz` a cestu k validátoru. Balí existující sestavení; registrace projektu, uložení verze a potvrzené nasazení zůstávají samostatnými kroky Sites. Do archivu nevkládá lokální tokeny.

Alternativně lze stejný Worker provozovat přímo nad Cloudflare D1. Místní SQLite server používá `backend/migrations/0000_statistics.sql`; jeho spouštěč není určen jako nezabezpečený veřejný internetový server.

`GET /api/health` kontroluje dostupnost databáze. Veřejný žebříček je `GET /api/leaderboard?mode=10&version=0.2.6`; režim může být `10` nebo `50`. Volitelný `id` vrátí také umístění konkrétní pojmenované hry. Úvodní stránka služby `/` nabízí veřejný žebříček; stránka `/owner` vyžaduje zadání vlastnického tokenu před načtením chráněných statistik. Token se na této stránce neukládá do úložiště prohlížeče.

## Životní cyklus a odolnost zápisů

Každá hra dostane náhodné UUID v4 a náhodný zápisový token. Server ukládá pouze SHA-256 hash zápisového tokenu. `POST /api/runs` registruje hru; totožná registrace může být opakovaná. První checkpoint vzniká po první skutečně umístěné věži, další při dokončení vlny, výhře, prohře a pravidelně během hry. Odchod ze stránky nebo nová hra odešle rozpracovaný stav jako `abandoned`. Poslední checkpoint nemusí při zavření prohlížeče stihnout dorazit.

Checkpoint má rostoucí `sequence`. Starší doručené zprávy nemohou přepsat novější uložené vlny; dokončená historie se nesmí změnit a skóre ani počet dokončených vln nesmí klesnout. Výsledek `won` nebo `lost` je konečný. Opakované odeslání stejného konečného výsledku je úspěšné a uložený výsledek se nepřepisuje. Doba hry se po konci zmrazí, takže čekání na výsledkové obrazovce nepřidává čas.

Frontend uchovává v `localStorage` frontu nejvýše 20 her pro aktuální adresu API. Za každou hru drží nejnovější checkpoint, při obnovení připojení opakuje doručení a průběžně zpracuje i stav přidaný během právě probíhajícího odesílání. Když prohlížeč blokuje přístup k úložišti nebo zápisy selžou, klient spravuje frontu v paměti a odstraňuje potvrzené zprávy i bez úspěšného zápisu na disk. Nemůže tak nekonečně odesílat starý checkpoint ze zaplněného úložiště. Paměťové údaje nejsou trvalé a mohou se ztratit při nové hře nebo zavření stránky. Fronta obsahuje zápisové tokeny, proto je součástí místních soukromých dat prohlížeče.

## Ukládané údaje

| Oblast | Údaje |
|---|---|
| Hra | UUID, verze, režim kampaně, seed, výsledek, skóre, dokončené vlny, čas v milisekundách, zbývající životy, kingdom level, zlato; po uložení skóre také jméno. |
| Umístěné tahy (`draws`) | ID, rodina, rank, souřadnice a vlna při skutečném umístění věže. Neumístěné karty nejsou zaznamenány jako tah. |
| Rozhodnutí (`decisions`) | Stejné údaje a akce `keep` nebo `combine`. Záznam kombinace identifikuje výsledného obránce; nepředstavuje úplný seznam jeho spotřebovaných ingrediencí. |
| Vlna | Index, boss flag, dokončení, životy před/po, součet poškození uniklými nepřáteli, počty spawnů/zabití/boss killů/úniků, čas boje, délka cesty, kingdom level, construction mastery. |
| Typy nepřátel | Počet spawnů, zabití a úniků každého typu v dané vlně. |
| Výkon obránců | Rodina, rank, ID, pozice, zásahy, výstřely, skutečně odebrané HP, připsaná zabití, `controlSeconds` a `supportSeconds`. |
| Efekty | Vzorkovaný součet aktivních status-sekund podle typu; jde o nepřátelské sekundy, které mohou přes více nepřátel přesáhnout délku vlny. |

`durationMs` celé hry je čas podle hodin prohlížeče od vytvoření hry, včetně stavění a pauz. `durationMs` vlny je simulovaný čas boje, který respektuje rychlost hry. `healthLost` je součet síly úniků, nikoli nutně rozdíl mezi počátečními a konečnými životy: poškození se na nule ořízne a některé schopnosti mohou životy obnovovat.

Kontrola a podpora se vzorkují přibližně po 250 ms simulovaného času. U jednoho nepřítele dostane `controlSeconds` v daném vzorku jediný účinný zdroj: petrifikace či freeze, jinak nejsilnější slow nebo slow aura. Slabší překryté zpomalení další kredit nezíská; poškození jedem nebo hořením se za kontrolu nepovažuje. Jde o čas účinku, nikoli přesně vypočítanou vzdálenost, kterou zpomalení ušetřilo. `supportSeconds` zaznamenává dobu přijatého aktivního bonusu na příjemci, nikoli příspěvek konkrétního Clerica. Pauza čas těchto ukazatelů nezvyšuje. Frontend spuštěný s vývojovým debug režimem neposílá online výsledky.

## Žebříček a jména

Skóre je na serveru znovu vypočítáno z historie: v každé vlně její index násobí 10 bodů za běžné zabití, 500 za bosse a bonus 100 za dokončení plus dalších 200 za boss vlnu. Kampaně o 10 a 50 vlnách i jednotlivé verze mají oddělené žebříčky. Shodné skóre řadí dřívější dokončení, potom ID hry. API vrací nejlepších 10 a případně vlastní pozici.

Jméno lze uložit pouze pro dokončenou výhru nebo prohru. Server používá Unicode NFKC, ořízne okraje, sjednotí vícenásobné mezery a dovolí 1–24 Unicode znaků: písmena, diakritická znaménka, čísla, mezery, tečky, podtržítka a pomlčky; jméno musí obsahovat písmeno nebo číslo. HTML a řídicí znaky neprojdou. Zvolené jméno je konečné; opakování stejného požadavku je možné, změna již uloženého jména se odmítne.

## Limity a bezpečnost

Tělo požadavku má limit 500 000 bajtů, včetně chunkovaných přenosů. Backend připouští nejvýše 250 tahů, 750 rozhodnutí, 250 obránců na vlnu, unikátní ID a ranky I–VI na poli 37 × 37. Ověřuje známé rodiny, typy nepřátel a počty podle definice vln, návaznost životů, konečný výsledek, součty killů a skóre. Přebytečná pole se neukládají. Číselné hodnoty mají konečné rozsahy a dokončené vlny mají nezměnitelný prefix. Celý standardní 50vlnový checkpoint v regresním testu má přibližně 198 kB.

Worker podle důvěryhodné hlavičky Cloudflare `CF-Connecting-IP` omezuje vytvoření nových her na 30 za hodinu, checkpointy na 240 za minutu a ukládání jména na 15 za minutu. Opakovaná registrace již existující hry se za novou hru nepočítá. Bez této hlavičky se tento omezovač nepoužije; místní Node server není sám o sobě veřejně zabezpečený rate-limit proxy.

SQL používá vázané parametry. CORS dovoluje nastavené originy; není to ověření člověka ani ochrana před přímým HTTP klientem. Vlastnický endpoint vyžaduje `Authorization: Bearer <ADMIN_TOKEN>`. Veřejné odpovědi neobsahují vlastnický token ani zápisové tokeny. Nasazení má používat HTTPS a chránit soukromou databázi i vlastnický token.

Statistiky pocházejí z klienta. Kontrola prokazuje jejich vnitřní konzistenci s pravidly a limity, nikoli to, že hráč skutečně odehrál popsané souboje. Počty i výkon lze v upraveném klientu podvrhnout; služba nemá autoritativní simulaci ani anti-cheat. Pro ladění používej více her a kontroluj odlehlé hodnoty.

## Report pro ladění

`GET /api/admin/statistics` vrací agregované skupiny `runs`, `waves`, `defenders`, `draws` a `decisions` rozdělené podle verze a režimu. Účast ve vlně je počítána také u rozpracované a neúspěšné vlny; dokončení má samostatný ukazatel. Výkon obránců se agreguje podle rodiny a ranku, ne podle konkrétní receptury. Obsahuje také součet zásahů a `receivedSupportSeconds`, tedy podpory přijaté danou rodinou. Počet účastí ve vlnách není počet unikátních postavených obránců; tahy a volby se sledují zvlášť.

Bez běžícího HTTP serveru lze číst místní databázi:

```powershell
node tools/statistics-report.mjs
```

Skript načte soukromý `owner-token.txt` a použije stejný vlastnický endpoint nad lokální databází. Nevytváří prázdnou databázi, pokud dosud žádná neexistuje. Pro vzdálenou službu nastav `API_URL` na základní adresu API a `STATISTICS_ADMIN_TOKEN` na vlastnický token v prostředí a spusť stejný příkaz. `STATISTICS_DATA_DIR` vybírá jiný místní adresář databáze. Token se neukládá do reportů ani netiskne do výstupu.

Výstup je `artifacts/statistics-reports/<čas>/statistics.json` a pět CSV souborů: `runs.csv`, `waves.csv`, `defenders.csv`, `draws.csv`, `decisions.csv`. CSV mají UTF-8 BOM, čárkový oddělovač a ochranu textových buněk proti interpretaci jako vzorce. V Excelu je možné zvolit import UTF-8 a oddělovač čárka. Reporty jsou ignorované Gitem.

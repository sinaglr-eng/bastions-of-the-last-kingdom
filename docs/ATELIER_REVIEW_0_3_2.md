# Shoda s návrhem a druhá kontrola anatomie

Připomínky po vydání 0.3.1 stanovují novou kontrolu identity, proporcí a výstroje. Kontakty dílů samy o sobě neprokazují věrnost návrhu. Každý změněný model musí mít šest skutečných nových renderů porovnaných s původní šestipohledovou předlohou; u výslovných změn uživatele se zaznamená nová požadovaná podoba.

## Přijaté změny

1. Engineer: celá hlava a čepice přímo nad trupem; prověřit všech 48 hlav, odlišit celou lebku od mělké viditelné tváře v otvoru kapuce. Opravit prokazatelné předsazení i u dalších základních obránců.
2. Stormcaller I–VI: přirozené nízké vlasy, přiléhající blesková koruna rozlišená podle hodnosti a skutečná souvislá lomená silueta drženého blesku. Jde o výslovnou změnu proti původním vlasům na obrázcích.
3. Rimewatch: přední ruka podpírá pažbu, zadní drží spoušť; oba úchopy zůstanou spojeny s kuší i při zpětném rázu.
4. Knight a společná koňská anatomie: hledí je součástí přilby jezdce, koňský čenich, nohy, kopyta a přiléhající výstroj odpovídají předloze.
5. Baby Dragon, Mother Dragon a draci s jezdci: skutečná široká hlava, krátký čenich, souvislý členěný krk a břišní pláty, tvar křídel, končetin i ocasu podle všech šesti pohledů. Rytíř na fialovém drakovi má celou zbroj barevně odlišnou od draka, sedí v sedle a má viditelná stehna a třmeny.
6. Griffin: orlí hlava, zahnutý zobák, plný bílý límec, vrstvená široká křídla a dlouhé lví čtyřnohé tělo; podsaditý trpaslík s brýlemi a bombami podle návrhu.
7. BearKing: mohutná široká medvědí hlava, krátký světlý čenich, široký černý nos, zaoblené uši, nízké robustní tělo a zelená výstroj se zlatým lemem podle návrhu.
8. Greenheart: hlavice hole, větvení a list mají skutečné napojení na drženou násadu.
9. Nature Spirit: duchovní listová maska a světelné oči místo lidské tváře; výslovná změna uživatele.
10. Royal Ranger: kuše se dvěma správnými úchopy místo luku; výslovná změna uživatele.
11. Hrací zdi: horní plošina do výšky hlavy a uší skutečného goblina druhé vlny při herním měřítku 0,88. Kopí se do výšky postavy nezapočítává. Obránci stojí na horní ploše a diagonální spoj nepřevyšuje jejich plošinu.

## Dodatečná kontrola

Proporční kontrola používá konkrétní anatomické body předlohy a skutečně importované vrcholy GLB. Ručně odečtené pixely mají zaznamenanou nejistotu a odlišnou perspektivu. Tolerantní poměry odhalují velké regresní rozdíly; nepředstavují automatické schválení celého vzhledu. Samostatně se kontroluje identita výstroje, materiálový kontrast jezdce, anatomická osa hlavy a skutečné přední/zadní úchopy v animaci. Vizualita zůstává posouzena otevřením a porovnáním všech šesti pohledů.

Původní kontroly povrchů, zakrytí hlavy, kloubů, terénu, pohybu, útoků, aury a zachování těl do konce celé vlny zůstávají povinné. Ověření se váže na aktuální SHA souborů. Nezměněné modely musí být byteově shodné s již kontrolovanou sadou; staré záznamy se mohou převzít jen s tímto důkazem a označením původu.

Schválené vnější části Lady Claire, všech 50 nepřátel a herní statistiky se zachovají. Archivy vydání 0.3.0 a 0.3.1 se nepřepisují. Nové nativní modely a důkazy patří do samostatné sady `geometric-game-v3` a publikovaná změna dostane nový klíč mezipaměti.

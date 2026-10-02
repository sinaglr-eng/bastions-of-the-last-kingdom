# Obránci Hooded Ranger — revize V3

Tato revize nahrazuje 48 základních herních modelů novými editovatelnými konstrukcemi pro Blender 5.2.2 LTS. Používá osm aktuálních listů varianty B a jejich konstrukční poznámky. Poslední uživatelský pokyn navíc výslovně zahrnuje integraci a publikaci, přestože původní uložený modelovací prompt tyto kroky vylučoval.

## Skutečný výsledek

- 48 GLB, osm `.blend` scén se šesti variantami a přibalenou referencí.
- 192 ortografických renderů, 48 pohledů ze tří čtvrtin, 48 prezentací s efekty a 48 portrétů.
- 48/48 zpětných importů se shodnými počty trojúhelníků, hierarchií a mezemi; maximální chyba mezí 5,9605 × 10⁻⁸.
- Nezávislé srovnání nativních scén s importovanými GLB všech 48 modelů prošlo i podle skutečných bodů a barev jejich povrchů. Maximální vzdálenost bodů je 3,9199 × 10⁻⁷; odchylka kanálů základních barev materiálů je nulová. Porovnání zachovává orientaci, měřítko i podstavec.
- Nezávislá kontrola 48/48 jednotek: 1 143/1 143 kontrol, 1 783 fyzických sítí, 63 520 trojúhelníků. Žádné neplatné souřadnice, degenerované trojúhelníky ani otevřené či nemanifoldní hrany; uzavřené díly mají kladný orientovaný objem.
- Exporty mají 964–1 864 trojúhelníků. Materiál látky odpovídá předepsaným šesti barvám, každá jednotka má dvě ruce a výbavu předepsanou pro úroveň.
- Všech 338 testů hry a produkční sestavení prošly.

Technická správnost nepotvrzuje přesnou vizuální rekonstrukci. Skutečná průměrná IoU ze 192 porovnání je **0,634620**; rozsah **0,360272–0,795568**. Žádný pohled nesplnil cíl 0,97. Anatomické body referencí nejsou nezávisle anotované, takže tolerance do 1 % H **není ověřená**. Rozměry konstrukce a skutečná měření sítí jsou ve specifikaci jasně oddělené od rasterových pozorování a odhadů skrytých částí.

Zbývají rozdíly v proporcích hlavy a oděvu, tvarech pokrývek hlavy, záhybech plášťů, póze a křivkách výbavy. U trpaslíka se liší šířka těla a bot, u Frost Wardena límec a fasety ledové výbavy. Některé kreslené profily ukazují stejnou širokou přední plochu luku, listů, kříže či blesku z více stran; modely mají jednu pevnou skutečnou orientaci. Tato nejednoznačnost nevysvětluje všechny naměřené odchylky.

Obecná automatická kontrola průniků vrstev nebyla provedena. Složení oděvu, zakryté díly a prostorové pohledy prošly vizuální kontrolou; nejde o důkaz nulových průniků.

## Závazné rozdíly tříd

Cleric I–VI drží dřevěnou hůl se zlatým latinským křížem. Frost Warden má jeden propojený ledový díl násady, úchopu a hrotu bez dřevěného či kovového spoje. Mage sleduje schválený list. Stormcaller VI má malý stříbrný hřbetní plát rukavice podle textové výjimky a IV–VI mají skutečné dva cípy pláště. Soldier V/VI má látku přes zachovaný kovový prsní plát. Archer má jeden pravý zadní toulec, levý luk a volnou pravou ruku; tětiva je v klidu rovná a při útoku se skutečná ruka zvedne k nátahu.

Barevné kruhy a VI zlatý měkký svit s osmi částicemi vytváří `game/render/ranks.js`. Nativní prezentace má samostatné kolekce `PREVIEW FX ONLY`, které se neexportují. Její tenká zlatá aura přibližuje herní aditivní sprite. Kontrolní geometrické rendery neobsahují efekty ani technický podstavec.

## Opakování a výstupy

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python blender/scripts/author_defender_turnarounds_v3.py -- --publish-assets
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python tools/check_defender_turnarounds_v3.py
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python tools/verify_defender_roundtrip_v3.py
python tools/analyze_defender_turnarounds_v3.py
pnpm test
pnpm build
```

Generátor bez `--publish-assets` ukládá ověřené GLB pouze do stagingu. Identifikátory, recepty a statistiky hry zůstávají zachované; Engineer má runtime ID `runebreaker`. Blender používá +Y vpřed, +X vlastní pravou stranu a Z vzhůru. GLB má Y vzhůru a -Z vpřed; samostatný podstavec zvedá tělo o 0,12.

Reference a jejich poznámky: `blender/references/hooded-turnarounds-v3/`. Generátor a konfigurace: `blender/scripts/defender_turnarounds_v3/`. Scény: `blender/scenes/hooded-turnarounds-v3/`. Rendery: `blender/renders/hooded-turnarounds-v3/`.

Podrobné výsledky všech 48 jednotek, skutečné rozměry a materiály, 192 překryvů, nejistoty segmentace a souhrn testů jsou v `output/design/hooded-turnarounds-v3/` a ve veřejném `model-review/`. Porovnání dovoluje pouze posun a jednotné měřítko celého obrázku; nepoužívá lokální deformace. Registrace vychází z celkové viditelné siluety a chodidel, nikoli z nezávisle anotované holé anatomické výšky H. Proto tato měření nelze vydávat za splnění anatomické tolerance z promptu.

Po úspěšném Pages workflow ověří `tools/verify_defender_turnarounds_production.mjs --sha <commit>` nasazený commit a SHA-256 všech 48 GLB a 48 portrétů přímo z produkce.

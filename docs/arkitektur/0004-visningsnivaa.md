# 0004 — Visningsnivå, og en meny å velge det i

**Status:** valgt · **Dato:** 2026-09-30 · **Endret:** 2026-10-06, menyen har
en synlig vei inn, og fargemodus står i den

## Kontekst

Svaret har vist alt assistenten gjorde, for alle. Over kortet står
tenkepanelet med «Tenkte i 7 sekunder», stegene, søkestrengene og detaljene
under hvert steg. Inne i kortet står «Fremgangsmåte» med «10 treff i 3
dokumenter» og nøkkelordene.

To lesere vil ha hver sin del av det. Issue 88 i
`digdir/kunnskapsassistenten` ber om «Fremgangsmåte» over svaret, og enklere
tenkesteg uten tekniske detaljer. Meldt 30.09: det tekniske i svarene kan være
nyttig for utviklere som vil ha verbose eller debug-aktig tilbakemelding på
hva som skjer akkurat nå.

Begge har rett for sin leser, og de kan ikke være riktige samtidig på samme
skjerm. Bestilt 30.09: et valg som ikke tar plass, hentet fram fra adressen,
i samme design som resten og uten å gjøre mye ut av seg.

Det finnes én innstilling i klienten fra før, mørk modus, og den har ingen
meny i det hele tatt. Den er en konsollkommando, `window.ka.colorScheme.set`,
fordi ingen knapp var tegnet (`src/layout/colorScheme.ts`). Det er en
innstilling for én person som vet at den finnes. Visningsnivået er ikke det:
Begge lesergruppene skal kunne velge, og en bryter for lys og mørk er allerede
bestilt som issue 85.

## Beslutning

Svaret har to visningsnivåer, `standard` og `detaljert`, lagret per nettleser
under `ka.display-level`. Standard tegner ett panel over svaret,
«Fremgangsmåte», etter skissen i issue 113: stegenes egne setninger under
«Tenkte», en linje, og søkeordene under «Nøkkelord som ble brukt i søket».
Detaljert tegner nøyaktig det som ble vist før. Nivået velges i en modal
Designsystemet-dialog som bare finnes i siden mens adressen slutter med
`#innstillinger`.

Grunnen til at det er et nivå og ikke en bryter per panel, er at det er én
avgjørelse leseren tar én gang: «vis meg maskineriet, eller ikke». Tre brytere
for tre paneler er tre spørsmål om det samme.

Grunnen til at det er en meny og ikke en konsollkommando, er at menyen skal
kunne bli synlig senere uten å bygges om. Mørk modus skal inn i den samme
menyen når #85 kommer, og da er det plasseringen som endres, ikke innholdet.

Grunnen til at panelet åpner seg selv over 774 px og ikke under, er målt.
Åpent med fire steg og fem nøkkelord er det 450 px av et vindu på 900 ved 1440,
487 av 1024 ved 768, 783 av 956 ved 440 og 965 av 844 ved 390. 774 er der
kolonnen slutter å være en lesebredde mellom to skinner og blir hele vinduet
(67 + 640 + 67, samme sum som `drawerMaxViewport`). Over den står svarets
første overskrift på skjermen under panelet; under den ER fremgangsmåten
skjermen. Designet tegner det åpent på desktop, og der er det åpent.

## Endret 2026-10-06: menyen er ikke skjult lenger

Dette er det ADR-en over pekte på: «menyen skal kunne bli synlig senere uten å
bygges om … og da er det plasseringen som endres, ikke innholdet».

Fargemodus (lys, mørk, auto) sto som eneste kontroll i foten av
navigasjonspanelet. Den er en innstilling som visningsnivået og fotvalget, så
den står i menyen nå, som en egen gruppe. I stedet har foten en lenke
«Innstillinger» der velgeren sto. Dermed har menyen en vei inn for alle, og
visningsnivået og fotvalget blir synlige med den.

Menyen mountes i skallet og ikke i chatvisningen. Foten tegnes på alle rutene,
også de tre sidene om prosjektet, og der finnes ingen chatvisning: sto menyen
der, åpnet lenka ingenting på de sidene. Menyen for funksjonsflagg flyttet
samme vei, siden den åpnes av adressen på samme måte.

Hashen står som før, og grunnene under gjelder fortsatt: lenka skriver bare
hashen, så menyen åpnes over den sida leseren står på.

Målt 2026-10-06 i mock: foten er 145 px mot 163 px før, på både 1440 × 900 og
390 × 844. Lenka er 24 px der velgeren var 42. axe gir 0 brudd i lys og mørk
på begge bredder, for foten og for menyen åpen.

Grunnen til hash og ikke spørring:

- En hash når aldri serveren, så tynnserveren og BFF-en ser den ikke.
- Den bytter ikke rute, så React Router trenger ingen ny rute og ingen ny
  regel om hva adressen betyr.
- Den følger ikke med en lenke noen limer inn i et issue. `?innstillinger`
  ville fulgt med adressen til en tråd og gitt neste leser en dialog de ikke
  ba om.

## Konsekvenser

- **Standard sier mindre enn før.** Tidene, det hvert steg målte,
  søkestrengene per steg og «10 treff i 3 dokumenter» er borte for den som ikke
  har valgt detaljert. Treffene teller biter, og en «bit» er ikke noe en leser
  har sett.
- **Det som gjorde svaret etterprøvbart, ble stående.** Nøkkelordene var
  argumentet for at «Fremgangsmåte» sto åpent inne i kortet (`RetrievalPanel`,
  svar 11), og de følger med opp. Derfor åpner panelet seg selv der det er
  plass: det som gjør et svar etterprøvbart skal ikke ligge bak et klikk.
- **På telefon ligger det likevel bak ett klikk.** Det er prisen for at svaret
  skal være det første på skjermen der skjermen er liten. Navnet står, og ett
  trykk åpner det.
- **E2E-suiten må si hvilket nivå den måler.** Fjorten påstander i
  `tests/e2e/` leser «Tenkte i N sekunder», «Fremgangsmåte» med treff, eller
  `.ka-thinking__*`. De måler det detaljerte nivået og må be om det.
- **Menyen er udokumentert i grensesnittet.** **Endret 2026-10-06:** her sto
  det at ingen knapp peker på menyen, og at den derfor sto i README-en i
  stedet. Lenka «Innstillinger» i foten av navigasjonspanelet peker på den nå.
  Se «Endret 2026-10-06» over.
- **Nivået er per nettleser, ikke per bruker.** Samme valg som mørk modus, og
  det holder så lenge det ikke finnes en innlogget profil å henge det på.

## Hva som ville endret beslutningen

- **En synlig innstillingsknapp blir tegnet** (skjedde 06.10, se over). Da
  åpner knappen den samme dialogen, og hashen kan bli stående eller forsvinne.
  Ingenting annet endres. Den ble stående: lenka skriver hashen.
- **Nivået skal gjelde flere flater enn svaret.** Da flytter `displayLevel.ts`
  fra `src/views/chat/` til `src/layout/`, som er der delt tilstand bor. Det
  er én fil og fire importsteder.
- **Det kommer et tredje nivå**, for eksempel et som viser tenkestegene men
  ikke tidene. Radioknappene tar det uten å endre form; det er derfor de er
  radioknapper og ikke en bryter.
- **Panelet ønskes åpent på telefon også.** Da er `ROOM_TO_STAND_OPEN` i
  `ProcedurePanel.tsx` én linje å fjerne, og målingene over er det som må veies
  mot ønsket.

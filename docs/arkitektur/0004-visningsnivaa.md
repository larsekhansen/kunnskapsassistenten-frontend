# 0004 — Visningsnivå, og en skjult meny å velge det i

**Status:** valgt · **Dato:** 2026-09-30

## Kontekst

Svaret har vist alt assistenten gjorde, for alle. Over kortet står
tenkepanelet med «Tenkte i 7 sekunder», stegene, søkestrengene og detaljene
under hvert steg. Inne i kortet står «Fremgangsmåte» med «10 treff i 3
dokumenter» og nøkkelordene.

To lesere vil ha hver sin del av det. Simen, i issue 88 i
`digdir/kunnskapsassistenten`: «Fremgangsmåte» over svaret, og enklere
tenkesteg uten tekniske detaljer. Lars, 30.09: «Det tekniske i svarene kan være
nyttig for feks meg eller andre utviklere som ønsker "verbose" eller
"debug"-aktige tilbakemeldinger på hva som skjer akkurat nå.»

Begge har rett for sin leser, og de kan ikke være riktige samtidig på samme
skjerm. Lars ba om et valg, og om at det ikke skal ta plass: «kanskje egentlig
bare at jeg kan skrive noe i urlen for å få opp en settings-meny … lag den i
det samme type designet, men ikke gjør for mye ut av det heller.»

Det finnes én innstilling i klienten fra før, mørk modus, og den har ingen
meny i det hele tatt. Den er en konsollkommando, `window.ka.colorScheme.set`,
fordi ingen knapp var tegnet (`src/layout/colorScheme.ts`). Det er en
innstilling for én person som vet at den finnes. Visningsnivået er ikke det:
Simen og Lars skal begge kunne velge, og en bryter for lys og mørk er allerede
bestilt som Simens issue 85.

## Beslutning

Svaret har to visningsnivåer, `standard` og `detaljert`, lagret per nettleser
under `ka.display-level`. Standard tegner ett panel over svaret,
«Fremgangsmåte», med stegenes egne setninger og én linje om hva svaret bygger
på; detaljert tegner nøyaktig det som ble vist før. Nivået velges i en modal
Designsystemet-dialog som bare finnes i siden mens adressen slutter med
`#innstillinger`.

Grunnen til at det er et nivå og ikke en bryter per panel, er at det er én
avgjørelse leseren tar én gang: «vis meg maskineriet, eller ikke». Tre brytere
for tre paneler er tre spørsmål om det samme.

Grunnen til at det er en meny og ikke en konsollkommando, er at menyen skal
kunne bli synlig senere uten å bygges om. Mørk modus skal inn i den samme
menyen når #85 kommer, og da er det plasseringen som endres, ikke innholdet.

Grunnen til hash og ikke spørring:

- En hash når aldri serveren, så tynnserveren og BFF-en ser den ikke.
- Den bytter ikke rute, så React Router trenger ingen ny rute og ingen ny
  regel om hva adressen betyr.
- Den følger ikke med en lenke noen limer inn i et issue. `?innstillinger`
  ville fulgt med adressen til en tråd og gitt neste leser en dialog de ikke
  ba om.

## Konsekvenser

- **Standard sier mindre enn før.** Søkestrengene, treffene og tidene er borte
  for den som ikke har valgt detaljert. Det ene tallet som blir igjen, er hvor
  mange dokumenter svaret bygger på, fordi de samme dokumentene står i
  kildepanelet. En «bit» er ikke noe en leser har sett.
- **Det som gjorde svaret etterprøvbart, flyttet seg.** Nøkkelordene i
  «Fremgangsmåte» var argumentet for at panelet sto åpent (`RetrievalPanel`).
  Nå er kildepanelet det som bærer etterprøvbarheten på standard, og
  søkeordene er ett valg unna.
- **E2E-suiten må si hvilket nivå den måler.** Fjorten påstander i
  `tests/e2e/` leser «Tenkte i N sekunder», «Fremgangsmåte» med treff, eller
  `.ka-thinking__*`. De måler det detaljerte nivået og må be om det.
- **Menyen er udokumentert i grensesnittet.** Ingen knapp peker på den, så den
  står i README-en i stedet. Det er med vilje: «Standard er standard. Uten
  adressen ser ingen at menyen finnes.»
- **Nivået er per nettleser, ikke per bruker.** Samme valg som mørk modus, og
  det holder så lenge det ikke finnes en innlogget profil å henge det på.

## Hva som ville endret beslutningen

- **En synlig innstillingsknapp blir tegnet.** Da åpner knappen den samme
  dialogen, og hashen kan bli stående eller forsvinne. Ingenting annet endres.
- **Nivået skal gjelde flere flater enn svaret.** Da flytter `displayLevel.ts`
  fra `src/views/chat/` til `src/layout/`, som er der delt tilstand bor. Det
  er én fil og fire importsteder.
- **Det kommer et tredje nivå**, for eksempel et som viser tenkestegene men
  ikke tidene. Radioknappene tar det uten å endre form; det er derfor de er
  radioknapper og ikke en bryter.

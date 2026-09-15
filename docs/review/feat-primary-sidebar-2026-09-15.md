# PR #19 og #22, navigasjonspanelet

2026-09-15, anmelderen (KA CC). `feat/primary-sidebar` (dokumentlista) og
`feat/primary-sidebar-brukerblikk` (funn 3, 7, 8, 12, 13, 16). Fasit:
`rolle-2b-dokumentliste.md`, `rolle-2c-brukerblikk.md`.

**Begge klare. Ingen blokkerende i noen av dem.**

## Portene

|                                | #19       | #22       |
| ------------------------------ | --------- | --------- |
| build / lint / format / tokens | OK        | OK        |
| `npm test`                     | 138       | 141       |
| `npm run test:e2e`             | 56 grønne | 56 grønne |
| axe, 1440, lys og mørk         | 0 brudd   | 0 brudd   |

## PR #19: dokumentlista «Fra Kudos»

Målt etter et svar: lista fylles med de tre dokumentene svaret bygger på,
hver med tittel og «Årsrapport · Nasjonal kommunikasjonsmyndighet · 2022»
under.

- **Lenkene peker til Kudos** med `target="_blank"` og `rel="noreferrer"`, og
  sier det i ord: `<span class="ds-sr-only"> (åpnes i ny fane)</span>`.
  Kommentaren forklarer hvorfor det er ord og ikke et ikon, og viser til
  Designsystemet. `noreferrer` impliserer `noopener` i alle nettlesere som
  gjelder, så paret er dekket.
- **Et dokument uten URL blir tekst, ikke lenke.** Målt: 2021-rapporten har
  ingen `href` og er en `Paragraph`. Riktig — en lenke som ikke går noe sted
  er verre enn ingen lenke.
- **«Vis flere dokumenter» kan ikke nås i mock**, fordi svaret gir tre
  dokumenter og terskelen er fem. Den er dekket av enhetstest i stedet, og
  det er den rette: «lists five of seven, and counts the rest», «shows the
  rest, drops the button, and leaves focus on the list». Den siste er den som
  betyr noe — en knapp som avmonterer seg selv mister fokus, og det er
  mønsteret som ga fire funn i PR #3.
- **`useId` og ikke en modulkonstant** for overskrifts-id-en, med begrunnelsen
  at to filtervisninger i hver sin plass ellers ville delt id. Det er
  layoutmodellen tatt på alvor.

## PR #22: de seks brukerblikk-funnene

Alle seks målt:

| Funn                                  | Før                                                 | Etter                                                                                    |
| ------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **3** «Alle valgt» uansett            | urørt felt og alt-valgt leste ordrett likt          | urørt: **«Ingen avgrensning»**, alt valgt: **«Alle 6 valgt»**                            |
| **7** klippet nederst                 | siste tekst flush mot kanten, kuttet midt i setning | `padding-block-end` under innholdet; siste tekst slutter 32 px over bunnen av rulleflata |
| **8** trådtitler så ikke klikkbare ut | mørk brødtekst uten understrek                      | `text-decoration: underline`, `rgb(0, 93, 177)`, `cursor: pointer`                       |
| **12** to `h4` i ulik størrelse       | 18 og 21 px                                         | begge **18 px**; stigen er 24 / 21 / 18                                                  |
| **13** «Ny» på noe ubygd              | merket sto over «Opplasting er ikke klar ennå»      | borte                                                                                    |
| **16** tre like «Søk»                 | «Søk», «Søk», «Søk»                                 | «Søk i dokumenttyper», «Søk i virksomheter», «Søk i år»                                  |

Funn 3 er den beste av dem. Den løser ikke bare ordlyden, den løser
_forholdet_: «Velg alle» ved siden av «Ingen avgrensning» er nå et tilbud om
noe som faktisk ikke er gjort, mens «Tøm» ved siden av «Alle 6 valgt» er det
samme andre veien. Knappen og tilstanden er enige igjen.

**Funn 7 er delt med #5, og delingen er riktig gjort.** #2 legger luft under
det siste elementet; kommentaren sier rett ut at «the scrolling region itself
belongs to the slot, not to the view», og den strukturelle halvdelen ligger i
#31, der jeg målte at hodet står stille og innholdsregionen ruller. To
arbeidere, én sak, ingen overlapp.

## Endringen i `tests/e2e/primary-sidebar.spec.ts`

#2 måtte endre påstanden min, siden ordlyden den låste på var selve funnet.
Den er minimal og bedre enn det den erstattet:

```ts
await expect(panel.getByText('Ingen avgrensning').first()).toBeVisible();
await expect(panel.getByText('Alle 6 valgt')).toHaveCount(0);
```

Den negative påstanden er tilføyd av #2 og er det som faktisk låser funnet:
at en urørt side ikke kan si «alle valgt». Ingen innvending — det er slik en
endring i en annens fil skal se ut.

## Til dirigenten

1. **Begge klare for Lars.**
2. Ingenting å følge opp. Den eneste tingen jeg ville notert er at «Vis flere
   dokumenter» aldri vises i mock-modus, så den lever bare i enhetstestene
   til korpuset i #33 gir svar med mer enn fem dokumenter.

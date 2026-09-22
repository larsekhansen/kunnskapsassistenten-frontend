# Todo

Saker som er avgjort at skal vente, med hvem som avgjorde og hvorfor. Ikke en
backlog: en sak står her fordi noen har sett den og sagt «ikke nå».

- [ ] **«Kopier lenke til tråden» i live lover deling som ikke virker.**
      Lenken virker bare i nettleseren som lagde den, fordi identiteten er en
      tilfeldig verdi i `localStorage` under `ka.user.v1` og `/api/conversations`
      lister bare tråder med den id-en. Målt i brukerblikk 7: en fersk
      nettleserprofil får «Fant ikke tråden» på en lenke appen selv skrev.
      Lars 22.09: vent med skjuling, avklares når UI-et fikses.

# Todo

Saker som er avgjort at skal vente, med hvem som avgjorde og hvorfor. Ikke en
backlog: en sak står her fordi noen har sett den og sagt «ikke nå».

- [ ] **«Kopier lenke til tråden» i live lover deling som ikke virker.**
      Lenken virker ikke i det hele tatt i live — heller ikke i nettleseren som
      lagde den. Målt i brukerblikk 8: adressen bærer en id klienten fant på,
      mens backenden lagret samtalen under sin egen, så gjenåpning gir 404.
      Identiteten i `localStorage` (`ka.user.v1`) er en egen begrensning på
      toppen av det: en annen nettleser ser uansett ikke tråden.
      Lars 22.09: vent med skjuling, avklares når UI-et fikses. Skrives om
      igjen når id-en er rettet — da er det bare identiteten som står igjen.

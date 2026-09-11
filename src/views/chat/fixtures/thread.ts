import type { RetrievalDetails, Thread } from '../types';
import { DEMO_SOURCES } from './content';

/**
 * The question the curated Figma frames show, and the answer they show.
 *
 * The answer text is the designer's dummy answer from «Svaret som vises»
 * (1530:44994 and 1502:97622), kept word for word. The one change is the
 * citations: Figma has them as plain text in parentheses, and answer 19 says
 * to implement them as numbered markers that point at a source. So
 * «(Årsrapport Nkom 2021)» is `[1]` here, and the document title lives in
 * DEMO_SOURCES where the marker's accessible name can reach it.
 */
export const DEMO_QUESTION = 'Oppsummer og sammenlign hva som skrives om måloppnåelse';

export const DEMO_ANSWER = `I årsrapportene fra Nasjonal kommunikasjonsmyndighet (Nkom) for 2021, 2022 og 2023 er det en gjennomgående fokus på måloppnåelse og ressursbruk. Her er en oppsummering og sammenligning av hva som skrives om måloppnåelse i disse rapportene:

## 2021

### Ressursbruk og måloppnåelse:

Nkoms totale utgiftsbevilgning for 2021 var på 594,2 millioner kroner, inkludert overføringer fra 2020. Det ble lagt vekt på å gjøre Norge 5G-klart, med økte bevilgninger på post 01. Bevilgningen på post 45 og post 70 ble redusert, da ekstraordinære tiltak ble faset ut. [1]

## 2022

### Internkontroll og risikovurdering:

Nkom følger opp mål i tildelingsbrevet gjennom målstyring og har etablert en virksomhetsplan som fortløpende vurderer risiko for ikke å nå mål. Risikovurderingen skal også fungere som grunnlag for prioriteringer og bidra til tverrfaglig arbeid. [2]

## 2023

### Strategiske prioriteringer:

Nkom viderefører arbeidet med digital transformasjon og sikker elektronisk kommunikasjon, og rapporterer på måloppnåelse per hovedmål i tildelingsbrevet. [3]

Disse rapportene viser hvordan Nkom arbeider systematisk med måloppnåelse gjennom risikostyring, ressursbruk og strategiske prioriteringer, med en tydelig utvikling mot digital transformasjon og 5G-teknologi.`;

/**
 * «Fremgangsmåte» data (answers 11, 12, 13). Frontend placeholder: a hit is
 * one relevant chunk in a document, and the keywords are not clickable.
 * The five keywords are the designer's, straight from the blackbox component.
 */
export const DEMO_RETRIEVAL: RetrievalDetails = {
  hitCount: 10,
  documentCount: 3,
  keywords: [
    'Datadeling kunstig intelligens',
    'Infrastruktur kunstig intelligens',
    'Anbefalinger for datadeling AI',
    'Eksempler på AI infrastruktur',
    'Utfordringer med datadeling AI',
  ],
};

/** A finished thread, for the route that shows one conversation. */
export const demoThread: Thread = {
  id: 'nkom-maaloppnaaelse',
  title: 'NKOM måloppnåelse',
  messages: [
    { id: 'm1', role: 'user', text: DEMO_QUESTION },
    {
      id: 'm2',
      role: 'assistant',
      text: DEMO_ANSWER,
      sources: DEMO_SOURCES,
      retrieval: DEMO_RETRIEVAL,
    },
  ],
};

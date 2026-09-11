/**
 * View-begrepet, bare abstraksjonen.
 *
 * Lars sin visjon (design/visjon-og-beslutninger.md) er en VS Code-lignende
 * struktur der brukeren på sikt kan endre bredden på panelene, velge hvilke
 * ting som ligger i hvilken region, og bytte mellom ulike *views*.
 *
 * Svarene 10 og 48 i design/skal-dette-implementeres.md sier: legg inn
 * abstraksjonen nå, GUI-et senere. Grunnen er at panelinnhold, panelbredde,
 * dokumentvisning og modusvekslingen i begge paneler er samme problem.
 * Løses det som ett view-begrep, forsvinner fire spørsmål; løses det ad hoc
 * fire steder, må alt rives.
 *
 * Denne fila er derfor bevisst liten. Den inneholder
 *   - typene for et view
 *   - ett standardview, som skallet leser bredder og regioner fra
 *
 * Den inneholder IKKE, og skal ikke ennå:
 *   - noe GUI for å bytte view
 *   - dra-håndtak for bredde
 *   - lagring i localStorage eller på server
 */

/**
 * Regionene heter det de er til, ikke hvor de står. Grunnen er at panelene
 * skal kunne flyttes: «venstre» i en aria-label lyver for en skjermleserbruker
 * den dagen panelet står til høyre.
 */
export type RegionId = 'navigasjonspanel' | 'hovedkolonne' | 'kildepanel';

/** Hva et panel kan inneholde. Utvides etter hvert som panelene får innhold. */
export type PanelInnhold = 'trader' | 'filter' | 'kilder' | 'verktoy';

export type Region = {
  id: RegionId;
  /** Rekkefølge i flex-raden. Lav verdi først. */
  rekkefolge: number;
  /**
   * Innhold panelet kan vise. Mer enn ett betyr at panelet har modi som
   * brukeren veksler mellom. Hovedkolonnen har ingen, den er samtalen.
   */
  kanVise: PanelInnhold[];
  /** Hvilket innhold som vises nå. */
  viser?: PanelInnhold;
  /** Er panelet kollapset til bare en knapp? */
  kollapset: boolean;
};

export type View = {
  id: string;
  navn: string;
  regioner: Record<RegionId, Region>;
};

/**
 * Standardvisningen, som er den designet viser i dag.
 *
 * En førstegangsbruker lander på filtrering, ikke på trådlista (svar 1).
 * Kildepanelet starter kollapset og åpnes når samtalen har skapt behov for
 * kildehenvisning.
 */
export const standardView: View = {
  id: 'standard',
  navn: 'Standard',
  regioner: {
    navigasjonspanel: {
      id: 'navigasjonspanel',
      rekkefolge: 1,
      kanVise: ['filter', 'trader'],
      viser: 'filter',
      kollapset: false,
    },
    hovedkolonne: {
      id: 'hovedkolonne',
      rekkefolge: 2,
      kanVise: [],
      kollapset: false,
    },
    kildepanel: {
      id: 'kildepanel',
      rekkefolge: 3,
      // Verktøymeny og notater kommer som modi her senere, i samme panel
      // som kilder (svarene 22, 49 og 52). Ikke i første versjon.
      kanVise: ['kilder'],
      viser: 'kilder',
      kollapset: true,
    },
  },
};

/** Regionene i den rekkefølgen viewet vil ha dem. */
export function regionerIRekkefolge(view: View): Region[] {
  return Object.values(view.regioner).sort((a, b) => a.rekkefolge - b.rekkefolge);
}

/**
 * Designsystemet lar deg dempe sine egne konsoll-advarsler i produksjon ved å
 * sette window.dsWarnings = false. Deklarasjonen finnes i
 * @digdir/designsystemet-web, men den pakka er en indirekte avhengighet, så vi
 * gjentar den her for å være sikre på at den er i typeomfanget.
 * Se packages/web/src/utils/utils.ts i Designsystemet.
 */
declare global {
  interface Window {
    dsWarnings?: boolean;
  }
}

export {};

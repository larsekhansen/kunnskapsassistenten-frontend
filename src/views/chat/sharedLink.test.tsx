import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnswerActions } from './AnswerActions';

/**
 * digdir/kunnskapsassistenten#119: adressen til en tråd åpner tråden bare i
 * nettleseren den ble laget i. Leseren huskes per nettleser, og backenden gir
 * ut samtalene som hører til den leseren, så den samme adressen et annet sted
 * svarer «Fant ikke tråden».
 *
 * Til innlogging finnes, sier knappen det selv. Her er grensen en beskrivelse
 * og ikke en del av navnet: navnet er hva knappen gjør, og raden beholder
 * høyden sin der svarkolonnen er smal. Det som holdes fast er at setningen
 * finnes tre steder — i beskrivelsen en skjermleser leser, i tooltipen, og i
 * kvitteringen, som er øyeblikket før adressen limes inn et sted.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

function show() {
  return render(<AnswerActions content="Et svar." createdAt="2026-10-06T21:00:00Z" />);
}

const copyLink = () => screen.getByRole('button', { name: 'Kopier lenke til tråden' });

describe('lenken til tråden', () => {
  it('har det knappen gjør som navn, og grensen som beskrivelse', () => {
    show();

    const button = copyLink();
    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      'Virker bare for deg, i denne nettleseren.',
    );
  });

  it('sier det samme i tooltipen, som er den synlige halvdelen', () => {
    show();

    expect(copyLink().getAttribute('data-tooltip')).toBe(
      'Virker bare for deg, i denne nettleseren',
    );
  });

  it('sier begge halvdelene i kvitteringen: for deg, i denne nettleseren', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    show();
    fireEvent.click(copyLink());

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(
      await screen.findByText(
        'Lenken til tråden er kopiert. Virker bare for deg, i denne nettleseren.',
      ),
    ).toBeTruthy();
  });

  it('kopierer fortsatt adressen leseren står på', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    show();
    fireEvent.click(copyLink());

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
  });
});

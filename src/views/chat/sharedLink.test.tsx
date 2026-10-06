import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnswerActions } from './AnswerActions';

/**
 * digdir/kunnskapsassistenten#119: adressen til en tråd åpner tråden bare i
 * nettleseren den ble laget i. Leseren huskes per nettleser, og backenden gir
 * ut samtalene som hører til den leseren, så den samme adressen et annet sted
 * svarer «Fant ikke tråden».
 *
 * Til innlogging finnes, sier knappen det selv. Det som holdes fast her er at
 * grensen står to steder: i navnet på knappen, før leseren kopierer, og i
 * kvitteringen, som er øyeblikket før de limer den inn et sted.
 */
afterEach(() => {
  vi.unstubAllGlobals();
});

function show() {
  return render(<AnswerActions content="Et svar." createdAt="2026-10-06T21:00:00Z" />);
}

const copyLink = () => screen.getByRole('button', { name: /^Kopier lenke til tråden/u });

describe('lenken til tråden', () => {
  it('sier i knappens navn at den bare virker for leseren', () => {
    show();

    expect(copyLink().textContent).toContain('virker bare for deg');
  });

  it('sier begge halvdelene i kvitteringen: for deg, i denne nettleseren', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    show();
    fireEvent.click(copyLink());

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(
      await screen.findByText(
        'Lenken til tråden er kopiert. Den virker bare for deg, i denne nettleseren.',
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

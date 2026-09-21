import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetUploadClientForTest } from '../api/uploadFactory';
import { resetUserDocumentsForTest } from '../api/userDocuments';
import { useUserDocuments } from './useUserDocuments';

/**
 * React-enden av dokumentbutikken. Selve butikken og klientene måles i
 * src/api/upload.test.ts og src/api/userDocuments.test.ts; her måles at en
 * endring utenfor React når fram til komponenten, og at de tre halvdelene tre
 * ulike views trenger, er de riktige.
 */
function Probe() {
  const { documents, ready, uploading, upload } = useUserDocuments();

  return (
    <>
      <output data-testid="alle">{documents.length}</output>
      <output data-testid="klare">{ready.length}</output>
      <output data-testid="laster">{String(uploading)}</output>
      <button
        type="button"
        onClick={() => {
          const file = new File(['x'], 'Rapport.pdf');
          void upload(file);
        }}
      >
        Last opp
      </button>
    </>
  );
}

const read = (id: string) => screen.getByTestId(id).textContent;

beforeEach(() => {
  localStorage.clear();
  resetUserDocumentsForTest();
  resetUploadClientForTest();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useUserDocuments', () => {
  it('tegner på nytt når butikken endrer seg utenfor React', async () => {
    render(<Probe />);
    expect(read('alle')).toBe('0');

    act(() => screen.getByRole('button', { name: 'Last opp' }).click());

    // Rada er der med en gang, før klienten er ferdig: det er det som gjør
    // ventinga lesbar.
    expect(read('alle')).toBe('1');
    expect(read('laster')).toBe('true');
    expect(read('klare')).toBe('0');

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(read('laster')).toBe('false');
    expect(read('klare')).toBe('1');
  });

  it('skiller det som er klart fra det som bare står i lista', async () => {
    // «Dine dokumenter» (#2) tegner alt, avviste filer inkludert, for en
    // avvist fil må si hvorfor. Det som kan knyttes til et spørsmål, er bare
    // de klare.
    render(<Probe />);

    await act(async () => {
      const { uploadUserDocument } = await import('../api/userDocuments');
      const refused = new File(['x'], 'Skjermbilde.png');
      await uploadUserDocument(refused);
    });

    expect(read('alle')).toBe('1');
    expect(read('klare')).toBe('0');
    expect(read('laster')).toBe('false');
  });
});

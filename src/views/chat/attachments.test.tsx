import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AskParams, ChatClient } from '../../api';
import { resetUserDocumentsForTest } from '../../api/userDocuments';
import { AnswerSourcesContext, inertAnswerSources } from '../../layout/answerSourcesContext';
import { CitationContext } from '../../layout/citationContext';
import { FilterContext } from '../../layout/filterContext';
import { MainScrollContext } from '../../layout/scrollContext';
import { ThreadContext } from '../../layout/threadContext';
import { emptyFilterSelection, threadFromQuestion, type StreamEvent } from '../../model';
import { uploadErrorText } from './attachmentText';
import { ChatView } from './ChatView';

/**
 * Vedlegg i skrivefeltet (rolle-3l).
 *
 * Kjører mot den ekte mock-opplastingsklienten, ikke mot en stand-in: hele
 * poenget er at chipen følger dokumentet fra 0 % til klart eller mislykket, og
 * en klient som svarer med én gang tester ikke den veien i det hele tatt.
 * Mocken bruker 1,5 s på en fil, så ventetidene her er romslige med vilje.
 */

const asked: AskParams[] = [];

function client(events: StreamEvent[] = []): ChatClient {
  return {
    async *ask(params) {
      asked.push(params);
      for (const event of events) yield event;
    },
    listThreads: async () => [],
    getThread: async () => null,
    listFacets: async () => [],
  };
}

const answer: StreamEvent[] = [
  { type: 'token', text: 'Svaret.' },
  { type: 'done', messageId: 'm1', conversationId: 'c1' },
];

function Shell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLElement | null>(null);
  return (
    <MemoryRouter>
      <MainScrollContext value={scrollRef}>
        <CitationContext value={{ activeCitation: undefined, showCitation: () => {} }}>
          <AnswerSourcesContext value={inertAnswerSources}>
            <ThreadContext value={{ startThread: (question) => threadFromQuestion(question) }}>
              <FilterContext value={{ selection: emptyFilterSelection, setSelection: () => {} }}>
                {children}
              </FilterContext>
            </ThreadContext>
          </AnswerSourcesContext>
        </CitationContext>
      </MainScrollContext>
    </MemoryRouter>
  );
}

function show(events: StreamEvent[] = []) {
  return render(
    <Shell>
      <ChatView client={client(events)} />
    </Shell>,
  );
}

const file = (name: string, size = 1024) => {
  const made = new File(['x'], name, { type: 'application/pdf' });
  Object.defineProperty(made, 'size', { value: size });
  return made;
};

function pick(...files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files } });
}

const field = () => screen.getByRole('textbox', { name: 'Spørsmål til Kunnskapsassistenten' });
/* `toBeDisabled` er jest-dom, som dette repoet ikke bruker. */
const sendButton = () =>
  screen.getByRole('button', { name: 'Send spørsmålet' }) as HTMLButtonElement;
const waitForReady = () =>
  waitFor(() => expect(sendButton().disabled).toBe(false), { timeout: 8000 });

function ask(question: string) {
  fireEvent.change(field(), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: 'Send spørsmålet' }));
}

beforeEach(() => {
  asked.length = 0;
  localStorage.clear();
  resetUserDocumentsForTest();
});

afterEach(() => {
  localStorage.clear();
  resetUserDocumentsForTest();
});

describe('vedlegg i skrivefeltet', { timeout: 20000 }, () => {
  it('legger ved en fil, fra laster opp til klar', async () => {
    show();

    pick(file('rapport.pdf'));

    // Chipen er der med en gang, før filen er ferdig: en leser som nettopp
    // valgte en fil skal se at noe skjedde. Prosenten er hvordan den sier at
    // den holder på.
    const chip = () => screen.getByRole('button', { name: /Fjern vedlegget rapport\.pdf/u });
    expect(chip().textContent).toMatch(/%/u);

    // Og den slutter å si det når filen er klar.
    await waitFor(() => expect(chip().textContent).not.toMatch(/%/u), { timeout: 8000 });
    expect(chip().textContent).toContain('rapport.pdf');
  });

  it('venter med å sende til filen er klar', async () => {
    /*
     * Bare klare dokumenter sendes, så et spørsmål sendt midt i opplastinga
     * ville droppet nettopp den filen leseren la ved — stille, som er det ene
     * et vedlegg aldri skal gjøre.
     */
    show();
    fireEvent.change(field(), { target: { value: 'Hva står i rapporten?' } });
    pick(file('rapport.pdf'));

    expect(sendButton().disabled).toBe(true);

    await waitForReady();
  });

  it('sender id-ene med spørsmålet, og navnene står på meldingen', async () => {
    show(answer);

    pick(file('rapport.pdf'));
    fireEvent.change(field(), { target: { value: 'Hva står i rapporten?' } });
    await waitForReady();

    ask('Hva står i rapporten?');

    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0].attachments).toHaveLength(1);
    expect(screen.getByText('Med vedlegg: rapport.pdf')).toBeTruthy();
  });

  it('tømmer vedleggene når spørsmålet er sendt', async () => {
    show(answer);

    pick(file('rapport.pdf'));
    fireEvent.change(field(), { target: { value: 'Hva står i rapporten?' } });
    await waitForReady();
    ask('Hva står i rapporten?');

    // Chipen hører til spørsmålet som ble skrevet, ikke til det neste.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Fjern vedlegget/u })).toBeNull(),
    );
  });

  it('sier hvorfor en fil ble avvist, og tilbyr å prøve igjen', async () => {
    // Mocken lar en fil som heter «feil…» mislykkes, så feilstien kan nås på
    // bestilling i stedet for å kreve en 21 MB PDF.
    show();

    pick(file('feil-rapport.pdf'));

    await waitFor(() => expect(screen.getByText(uploadErrorText('failed'))).toBeTruthy(), {
      timeout: 6000,
    });
    expect(
      screen.getByRole('button', { name: /Prøv å laste opp feil-rapport\.pdf på nytt/u }),
    ).toBeTruthy();
  });

  it('sender ikke en fil som mislyktes', async () => {
    show(answer);

    pick(file('feil-rapport.pdf'));
    await waitFor(() => expect(screen.getByText(uploadErrorText('failed'))).toBeTruthy(), {
      timeout: 6000,
    });

    ask('Hva står i rapporten?');
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0].attachments).toBeUndefined();
    expect(screen.queryByText(/Med vedlegg/u)).toBeNull();
  });

  it('avviser en filtype vi ikke tar, uten å spørre klienten', async () => {
    show();

    pick(file('bilde.png'));

    // Med en gang, ikke etter halvannet sekund: vi vet svaret uten å prøve.
    expect(screen.getByText(uploadErrorText('wrong-type'))).toBeTruthy();
    // Og ingen vei videre, for filen er den samme neste gang.
    expect(screen.queryByRole('button', { name: /Prøv å laste opp/u })).toBeNull();
  });

  it('lar leseren ta et vedlegg av igjen', async () => {
    show();

    pick(file('rapport.pdf'));
    const chip = screen.getByRole('button', { name: /Fjern vedlegget rapport\.pdf/u });
    fireEvent.click(chip);

    expect(screen.queryByRole('button', { name: /Fjern vedlegget/u })).toBeNull();
  });

  it('tar imot flere filer om gangen', async () => {
    show();

    pick(file('en.pdf'), file('to.pdf'));

    expect(screen.getAllByRole('button', { name: /Fjern vedlegget/u })).toHaveLength(2);
  });
});

import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ChatClient } from '../../api';
import { messagesFromApi } from '../../api/live/conversations';
import type { Message, SourceDocument, StreamEvent } from '../../model';
import { MessageList } from './MessageList';
import { NO_HITS_FILTERED, NO_HITS_WHOLE_CORPUS, NO_SOURCES_WARNING } from './text';
import { useChat } from './useChat';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const document: SourceDocument = {
  id: 'doc-1',
  title: 'Årsrapport 2024',
  excerpts: [{ id: 'doc-1-1', text: 'Et utdrag.', relevance: 'high', citationNumber: 1 }],
};

const answer: Message = {
  id: 'a1',
  role: 'assistant',
  content: 'Nkom måler måloppnåelse mot målene i tildelingsbrevet.',
  createdAt: '2026-10-06T09:00:00Z',
  citations: [],
  status: 'complete',
};

function show(message: Message) {
  return render(
    <MessageList
      foundNothing={() => false}
      messages={[message]}
      onRegenerate={() => {}}
      onSelectSource={() => {}}
    />,
  );
}

function warning() {
  return screen.queryByText(NO_SOURCES_WARNING);
}

describe('advarselen når svaret ikke har kilder', () => {
  it('har samme tekst som den eksisterende klienten', () => {
    expect(NO_SOURCES_WARNING).toBe(
      'Svaret har ingen kilder fra dokumentgrunnlaget. Kontroller det mot originaldokumentene før du bruker det.',
    );
  });

  it('står i svarkortet, over svaret, når et ferdig svar ikke har kilder', () => {
    const { container } = show({ ...answer, sources: [] });

    const alert = warning()?.closest('.ds-alert');
    expect(alert).toBeTruthy();
    expect(alert?.getAttribute('data-color')).toBe('warning');
    expect(alert?.closest('.ka-answer-card')).toBeTruthy();
    // Before the answer in the reading order, as in the existing client.
    const text = screen.getByText(answer.content);
    expect(alert!.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('.ds-alert')).toHaveLength(1);
  });

  it('står også når kildene aldri kom, ikke bare når de kom tomme', () => {
    show(answer);
    expect(warning()).toBeTruthy();
  });

  it('står ikke under et svar med kilder', () => {
    show({ ...answer, sources: [document] });
    expect(warning()).toBeNull();
  });

  it('står ikke når svaret viser til utdrag som ikke ble lagret', () => {
    // Read back from a store that keeps the text and not the chunks: the
    // markers are on screen, and the sources panel says they were not stored.
    show({ ...answer, content: 'Målene står i tildelingsbrevet [1][2].', citationCount: 2 });
    expect(warning()).toBeNull();
  });

  it('står ikke før svaret er ferdig, eller når det ikke ble et svar', () => {
    for (const status of ['streaming', 'aborted', 'error', 'needs-clarification'] as const) {
      const { unmount } = show({ ...answer, status });
      expect(warning(), status).toBeNull();
      unmount();
    }
  });

  it('står ikke over klientens egen melding om at søket ikke fant noe', () => {
    // That message is not an answer to check against the documents: it says
    // nothing was found, and the warning would say the same thing again.
    for (const content of [NO_HITS_WHOLE_CORPUS, NO_HITS_FILTERED]) {
      const { unmount } = show({ ...answer, content, sources: [] });
      expect(warning()).toBeNull();
      unmount();
    }
  });

  it('står etter ny innlasting fra live og bff, som bruker samme lesing', () => {
    const [, restored] = messagesFromApi([
      { id: 'q', role: 'user', text: 'Hva er måloppnåelse?', created: 1 },
      { id: 'a', role: 'assistant', text: answer.content, created: 2 },
    ]);
    show(restored as Message);
    expect(warning()).toBeTruthy();
  });

  it('står ikke etter ny innlasting når svaret har markører og kildene ikke er lagret', () => {
    const [, restored] = messagesFromApi([
      { id: 'q', role: 'user', text: 'Hva er måloppnåelse?', created: 1 },
      { id: 'a', role: 'assistant', text: 'Målene står i tildelingsbrevet [1].', created: 2 },
    ]);
    show(restored as Message);
    expect(warning()).toBeNull();
  });
});

/** A client that streams the given frames for any question. */
function scriptedClient(frames: StreamEvent[]): ChatClient {
  return {
    async *ask() {
      yield* frames;
    },
    listThreads: async () => [],
    getThread: async () => null,
    listFacets: async () => [],
  };
}

describe('det skjermleseren hører når svaret er ferdig', () => {
  it('sier fra om advarselen når svaret ikke har kilder', async () => {
    const client = scriptedClient([
      { type: 'token', text: 'Svaret.' },
      {
        type: 'sources',
        documents: [],
        citations: [],
        retrieval: { hitCount: 0, documentCount: 0, keywords: [] },
      },
      { type: 'done', messageId: 'm1', conversationId: 'c1' },
    ]);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.announcement).toBe(`Svaret er ferdig. ${NO_SOURCES_WARNING}`);
  });

  it('sier bare at svaret er ferdig når det har kilder', async () => {
    const client = scriptedClient([
      { type: 'token', text: 'Svaret [1].' },
      {
        type: 'sources',
        documents: [document],
        citations: [],
        retrieval: { hitCount: 1, documentCount: 1, keywords: [] },
      },
      { type: 'done', messageId: 'm1', conversationId: 'c1' },
    ]);
    const { result } = renderHook(() => useChat(client));

    act(() => result.current.send('Hva er måloppnåelse?'));

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.announcement).toBe('Svaret er ferdig.');
  });
});

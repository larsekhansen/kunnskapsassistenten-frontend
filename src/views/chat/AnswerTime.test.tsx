import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../model';
import { AnswerMessage } from './AnswerMessage';
import { AnswerTime } from './AnswerTime';
import { MessageList } from './MessageList';

/** A Tuesday at 14:00, so «i går» and the weekday cases are not the same day. */
const NOW = new Date(2026, 8, 15, 14, 0, 0);
const at = (...args: [number, number, number, number?, number?]) => new Date(...args).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function stamp(createdAt: string) {
  const { container } = render(<AnswerTime createdAt={createdAt} />);
  return container.querySelector('time');
}

describe('AnswerTime', () => {
  it('skriver tiden i et <time> med maskindato og hele datoen', () => {
    const iso = at(2026, 8, 15, 14, 32);
    const time = stamp(iso);

    expect(time).not.toBeNull();
    expect(time?.getAttribute('datetime')).toBe(iso);
    expect(time?.getAttribute('title')).toBe('15. september 2026 kl. 14:32');
  });

  it('bruker samme korte format som trådlista', () => {
    // Klokka i dag, «i går», ukedagen, dag og kort måned, dag og måned: det
    // trådlista skriver på raden, skrevet på svaret.
    expect(stamp(at(2026, 8, 15, 14, 32))?.textContent).toContain('14:32');
    expect(stamp(at(2026, 8, 14, 9, 5))?.textContent).toContain('i går');
    expect(stamp(at(2026, 8, 11, 9, 5))?.textContent).toContain('fredag');
    expect(stamp(at(2026, 7, 28, 9, 5))?.textContent).toContain('28. aug.');
    expect(stamp(at(2025, 4, 12, 9, 5))?.textContent).toContain('12. mai');
  });

  it('leses opp med hele datoen, som det korte formatet ikke sier', () => {
    // «12. mai» sier ikke hvilket år. I trådlista står året i
    // gruppeoverskriften over raden; her står det ingenting over svaret, og
    // `title` er et musepeker-tips ingen skjermleser leser.
    const time = stamp(at(2025, 4, 12, 9, 5));

    expect(time?.querySelector('[aria-hidden="true"]')?.textContent).toBe('12. mai');
    expect(time?.querySelector('.ds-sr-only')?.textContent).toBe(
      'Svaret kom 12. mai 2025 kl. 09:05',
    );
  });

  it('tier heller enn å skrive «Invalid Date»', () => {
    expect(stamp('ikke en dato')).toBeNull();
  });

  it('viser tiden svaret ble gitt, ikke tiden det ble lastet', () => {
    // Et gjenopprettet svar bærer sin egen `createdAt`. Skrev det seg om til
    // lastetiden, ville det vært «Tenkte i 2 sekunder»-feilen om igjen i et
    // annet felt.
    const answered = at(2026, 8, 11, 9, 5);
    const answer: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Nkom måler måloppnåelse mot målene i tildelingsbrevet.',
      createdAt: answered,
      citations: [],
      status: 'complete',
    };

    render(
      <ol>
        <AnswerMessage
          canScrollToBottom={false}
          message={answer}
          onRegenerate={() => {}}
          onScrollToBottom={() => {}}
          onSelectSource={() => {}}
        />
      </ol>,
    );

    // Lastet i dag klokka 14:00, men svaret kom fredag.
    const time = screen.getByText('fredag').closest('time');
    expect(time?.getAttribute('datetime')).toBe(answered);
    expect(time?.getAttribute('title')).toBe('11. september 2026 kl. 09:05');
  });

  it('står utenfor knappene i handlingsraden, ikke inni en av dem', () => {
    // Inni ville tiden blitt en del av knappens tilgjengelige navn, og
    // «Kopier svaret 14:32» er et navn som endrer seg med klokka. Samme grunn
    // som at trådlista holder tiden utenfor lenka.
    const answer: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Et ferdig svar.',
      createdAt: at(2026, 8, 15, 14, 32),
      citations: [],
      status: 'complete',
    };

    const { container } = render(
      <ol>
        <AnswerMessage
          canScrollToBottom={true}
          message={answer}
          onRegenerate={() => {}}
          onScrollToBottom={() => {}}
          onSelectSource={() => {}}
        />
      </ol>,
    );

    const times = container.querySelectorAll('time');
    expect(times).toHaveLength(1);
    expect(times[0].closest('button')).toBeNull();
    expect(times[0].closest('a')).toBeNull();

    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent).not.toContain('14:32');
    }
  });

  it('står også under et svar som ble stoppet', () => {
    // Et stoppet svar er fortsatt et svar leseren kan vise tilbake til.
    const answer: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Måloppnåelse er ',
      createdAt: at(2026, 8, 15, 14, 32),
      citations: [],
      status: 'aborted',
    };

    const { container } = render(
      <ol>
        <AnswerMessage
          canScrollToBottom={false}
          message={answer}
          onRegenerate={() => {}}
          onScrollToBottom={() => {}}
          onSelectSource={() => {}}
        />
      </ol>,
    );

    expect(container.querySelectorAll('time')).toHaveLength(1);
    expect(screen.getByText('14:32')).toBeDefined();
  });

  it('gir spørsmålet over svaret ingen egen tid', () => {
    // Ett stempel per svar. Spørsmålet står rett over og er det svaret
    // svarer på; to tider på samme utveksling er én for mye.
    const question: Message = {
      id: 'q1',
      role: 'user',
      content: 'Hva er måloppnåelse?',
      createdAt: at(2026, 8, 15, 14, 31),
      citations: [],
      status: 'complete',
    };
    const answer: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Et ferdig svar.',
      createdAt: at(2026, 8, 15, 14, 32),
      citations: [],
      status: 'complete',
    };

    const { container } = render(
      <ol>
        {[question, answer].map((message) =>
          message.role === 'user' ? (
            <li key={message.id}>{message.content}</li>
          ) : (
            <AnswerMessage
              canScrollToBottom={false}
              key={message.id}
              message={message}
              onRegenerate={() => {}}
              onScrollToBottom={() => {}}
              onSelectSource={() => {}}
            />
          ),
        )}
      </ol>,
    );

    expect(container.querySelectorAll('time')).toHaveLength(1);
  });
  it('stempler også en tur som spurte tilbake, med de samme ordene', () => {
    /*
     * En avklaring er ikke et svar, men den er det assistenten svarte med, og
     * den kom på et tidspunkt leseren kan vise tilbake til. Uten stempel fikk
     * en gjenopprettet samtale som endte i en avklaring et hull, når hver
     * eneste rad i trådlista sier når (dirigenten, 2026-09-16).
     */
    const spurte: Message = {
      id: 'a1',
      role: 'assistant',
      content: 'Mener du målene i tildelingsbrevet, eller måloppnåelsen i årsrapporten?',
      createdAt: at(2026, 8, 11, 9, 5),
      citations: [],
      status: 'needs-clarification',
    };

    const { container } = render(
      <MessageList
        canScrollToBottom={false}
        messages={[spurte]}
        onRegenerate={() => {}}
        onScrollToBottom={() => {}}
        onSelectSource={() => {}}
      />,
    );

    const times = container.querySelectorAll('time');
    expect(times).toHaveLength(1);
    expect(times[0].getAttribute('datetime')).toBe(spurte.createdAt);
    expect(times[0].querySelector('.ds-sr-only')?.textContent).toBe(
      'Svaret kom 11. september 2026 kl. 09:05',
    );
    expect(times[0].closest('button')).toBeNull();
  });

  it('gir en gjenopprettet samtale ett stempel per tur assistenten tok', () => {
    // Spørsmål, svar, oppfølging, avklaring: to turer fra assistenten, to
    // stempler. Leserens egne spørsmål teller ikke med.
    const messages: Message[] = [
      {
        id: 'q1',
        role: 'user',
        content: 'Hva er måloppnåelse?',
        createdAt: at(2026, 8, 11, 9, 0),
        citations: [],
        status: 'complete',
      },
      {
        id: 'a1',
        role: 'assistant',
        content: 'Et svar.',
        createdAt: at(2026, 8, 11, 9, 5),
        citations: [],
        status: 'complete',
      },
      {
        id: 'q2',
        role: 'user',
        content: 'Og i Digdir?',
        createdAt: at(2026, 8, 11, 9, 10),
        citations: [],
        status: 'complete',
      },
      {
        id: 'a2',
        role: 'assistant',
        content: 'Mener du 2025 eller 2026?',
        createdAt: at(2026, 8, 11, 9, 12),
        citations: [],
        status: 'needs-clarification',
      },
    ];

    const { container } = render(
      <MessageList
        canScrollToBottom={false}
        messages={messages}
        onRegenerate={() => {}}
        onScrollToBottom={() => {}}
        onSelectSource={() => {}}
      />,
    );

    expect([...container.querySelectorAll('time')].map((t) => t.getAttribute('datetime'))).toEqual([
      at(2026, 8, 11, 9, 5),
      at(2026, 8, 11, 9, 12),
    ]);
  });
});

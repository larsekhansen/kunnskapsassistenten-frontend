import { Heading } from '@digdir/designsystemet-react';
import { useMemo, useRef, useState } from 'react';
import { createChatClient, type ChatClient } from '../../api';
import { ErrorState } from '../../components';
import { useCitation } from '../../layout/useCitation';
import { useMainScroll } from '../../layout/useMainScroll';
import type { ThreadDetail } from '../../model';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { useAtBottom } from './useAtBottom';
import { useChat } from './useChat';
import { Welcome } from './Welcome';
import './chat.css';

export type ChatViewProps = {
  /** The signed-in user's first name, for the greeting before the first question. */
  userName?: string;
  /** The thread to show. Absent means a new conversation. */
  thread?: ThreadDetail;
  /** Which backend to talk to. Defaults to whatever `createChatClient` picks. */
  client?: ChatClient;
};

let fallbackClient: ChatClient | undefined;
function defaultClient(): ChatClient {
  fallbackClient ??= createChatClient();
  return fallbackClient;
}

function ChatSession({ userName, thread, client }: ChatViewProps) {
  const chatClient = useMemo(() => client ?? defaultClient(), [client]);
  const { messages, status, error, announcement, send, cancel, retry } = useChat(
    chatClient,
    thread?.messages ?? [],
  );

  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // The main slot owns the scroll, and the shell hands it over. A view must
  // not go looking for it: the day chat is moved to another slot, a search up
  // the DOM finds the wrong element or nothing.
  const { ref: scrollRef, scrollToBottom } = useMainScroll();
  const atBottom = useAtBottom(scrollRef, rootRef);

  // Activating a `[n]` marker is the shell's business: it opens the sources
  // panel and tells it which excerpt to show. Neither view knows the other.
  const { showCitation } = useCitation();

  const hasAnswer = messages.some(
    (message) => message.role === 'assistant' && message.status === 'complete',
  );

  function submit(question: string) {
    send(question);
    setDraft('');
  }

  return (
    <div className="ka-chat" ref={rootRef}>
      {thread ? (
        <Heading data-size="lg" level={2}>
          {thread.title}
        </Heading>
      ) : null}

      {messages.length === 0 ? (
        <Welcome
          onPickKickstarter={(question) => {
            // Fills the field, does not send (answer 40). The caret goes with
            // it, so the reader can edit before asking.
            setDraft(question);
            fieldRef.current?.focus();
          }}
          userName={userName}
        />
      ) : (
        <MessageList
          canScrollToBottom={!atBottom}
          messages={messages}
          onScrollToBottom={() => scrollToBottom()}
          onSelectSource={showCitation}
          status={status}
        />
      )}

      {/*
        Mounted whether or not there is an error: an alert region only
        announces content that appears inside a region already in the page.
        See src/components/ErrorState.tsx.
      */}
      <ErrorState message={error ?? undefined} onRetry={retry} title="Svaret kom ikke fram" />

      <Composer
        fieldRef={fieldRef}
        onCancel={cancel}
        onChange={setDraft}
        onFollowUp={submit}
        onSubmit={() => submit(draft)}
        showFollowUps={hasAnswer}
        status={status}
        value={draft}
      />

      {/*
        How the answer is coming along, for a screen reader. Polite, never
        assertive: an answer being written is not an interruption. It carries
        whole paragraphs rather than tokens, because a region updated per
        token stutters, and the finished answer is in the page anyway.
      */}
      <p aria-live="polite" className="ds-sr-only">
        {announcement}
      </p>
    </div>
  );
}

/**
 * The chat: the greeting, the conversation and the compose field.
 *
 * Mounted in the `main` slot by the shell. It is a view, so it is named after
 * its content and could sit in another slot the day the layout lets a reader
 * move it. It expects the route around it to carry the page's level 1
 * heading, as Figma draws it: «Kunnskapsassistenten» on top, the thread title
 * under it.
 *
 * The session is keyed on the thread, so moving between threads starts from
 * that thread's messages instead of carrying the previous conversation across.
 */
export function ChatView(props: ChatViewProps) {
  return <ChatSession key={props.thread?.id ?? 'new'} {...props} />;
}

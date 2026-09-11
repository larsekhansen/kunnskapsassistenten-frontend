import { Heading } from '@digdir/designsystemet-react';
import { useMemo, useRef, useState } from 'react';
import { createChatClient, type ChatClient } from '../../api';
import type { ThreadDetail } from '../../model';
import { Composer } from './Composer';
import { EmptyState } from './EmptyState';
import { MessageList } from './MessageList';
import { useChat } from './useChat';
import { useScrollToBottom } from './useScrollToBottom';
import './chat.css';

export type ChatViewProps = {
  /** The signed-in user's first name, for the greeting on the empty state. */
  userName?: string;
  /** The thread to show. Absent means a new conversation. */
  thread?: ThreadDetail;
  /** Which backend to talk to. Defaults to whatever `createChatClient` picks. */
  client?: ChatClient;
  /**
   * Opens source `n` in the sources panel when a `[n]` marker is activated
   * (answer 19). Without it the markers still render and are announced, they
   * just do not move the sources panel.
   */
  onSelectSource?: (citationNumber: number) => void;
};

let fallbackClient: ChatClient | undefined;
function defaultClient(): ChatClient {
  fallbackClient ??= createChatClient();
  return fallbackClient;
}

function ChatSession({ userName, thread, client, onSelectSource }: ChatViewProps) {
  const chatClient = useMemo(() => client ?? defaultClient(), [client]);
  const { messages, status, error, announcement, send, cancel, retry } = useChat(
    chatClient,
    thread?.messages ?? [],
  );

  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const { atBottom, scrollToBottom } = useScrollToBottom(rootRef);

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
        <EmptyState
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
          error={error}
          messages={messages}
          onRetry={retry}
          onScrollToBottom={scrollToBottom}
          onSelectSource={onSelectSource}
          status={status}
        />
      )}

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
 * The chat: the empty state, the conversation and the compose field.
 *
 * Mounted in the `main` slot by the shell. It is a view, so it is named after
 * its content and could sit in another slot the day the layout lets a reader
 * move it.
 *
 * The session is keyed on the thread, so moving between threads starts from
 * that thread's messages instead of carrying the previous conversation's
 * state across.
 */
export function ChatView(props: ChatViewProps) {
  return <ChatSession key={props.thread?.id ?? 'new'} {...props} />;
}

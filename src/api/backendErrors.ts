import { chatErrorCode } from '../model';
import type { ChatError } from '../model';

/**
 * What an HTTP status says about the turn, and what it does not.
 *
 * Only what the status actually establishes. A 5xx means the backend broke;
 * it does not say whether the language model was down or the search was, and
 * the two want opposite things from the reader — so it is `unknown` and says
 * so, rather than guessing at a code the reader would act on
 * (API-bestilling A16 asks the backend for the missing half).
 *
 * The status number stays in the text: it is the one thing anyone debugging
 * this from a screenshot has to go on.
 */
export function errorFromStatus(status: number): ChatError {
  switch (status) {
    case 401:
    case 403:
      return { code: 'unauthorized' };
    case 408:
    case 504:
      return { code: 'timeout' };
    case 429:
      return { code: 'rate-limited' };
    default:
      return { code: 'unknown', message: `Kunnskapsassistenten svarte med feil (${status}).` };
  }
}

/**
 * The backend's own snake_case codes, as it sends them today in `_meta.code`
 * and in a JSON-RPC error's `data.code` (digdir/mcp/tools.clj). Only the ones
 * that say something the reader's text depends on; the rest — an agent or a
 * mode that does not exist, a dataset scope nobody set — are the operator's
 * to fix and read as `unknown`.
 */
const BACKEND_CODES: Record<string, ChatError> = {
  agent_not_authorized: { code: 'unauthorized' },
  mode_not_authorized: { code: 'unauthorized' },
  dataset_not_authorized: { code: 'unauthorized' },
};

/**
 * Texts the backend and the BFF are known to send, and what each one is.
 * First match wins, so the order matters where two could match.
 *
 * Only the failing half is read off the text, never the reader's next step:
 * that is the view's, from the code. Where the text names the language model
 * («LLM request failed …», which is how the agent loop reports every failed
 * model call — digdir/skills/builtin/agent/loop.clj), that is the backend
 * saying which half it was, not this client guessing.
 */
const KNOWN_TEXTS: { pattern: RegExp; error: (match: RegExpMatchArray) => ChatError }[] = [
  // The BFF's wording for a status from the backend: the status says what it
  // can, the same as when it reaches this client directly.
  { pattern: /^Backend svarte (\d{3})\b/u, error: (match) => errorFromStatus(Number(match[1])) },
  // The BFF's wording for a stream that ended without an answer. Same case,
  // same sentence as when this client sees the stream end by itself.
  {
    pattern: /^Forbindelsen til backend ble brutt/u,
    error: () => ({ code: 'unknown', message: 'Forbindelsen brøt sammen mens svaret kom.' }),
  },
  // The BFF's own check on the question, the one refusal the reader can do
  // something about.
  {
    pattern: /for langt \(maks (\d+) tegn\)/u,
    error: (match) => ({
      code: 'question-too-long',
      message: `Spørsmålet er lengre enn de ${match[1]} tegnene tjenesten tar imot.`,
    }),
  },
  // The model's stream went quiet (digdir/llm/openai.cljc). That is the model
  // not answering, not the question being too big, so the reader is told the
  // question can go again as it stands. Named on its own rather than left
  // to the «LLM request failed» entry at the end, so it keeps its code if the
  // watchdog's text ever reaches this client without the agent loop's prefix.
  {
    pattern: /no event received for \d+ ?ms|stream stalled/iu,
    error: () => ({ code: 'model-unavailable' }),
  },
  {
    pattern: /\(status 429\)|rate.?limit|too many requests/iu,
    error: () => ({ code: 'rate-limited' }),
  },
  {
    pattern: /\(status (?:408|504)\)|timed out|\btimeout\b/iu,
    error: () => ({ code: 'timeout' }),
  },
  {
    pattern: /API key (?:cannot|is not allowed)|is not allowed to access/iu,
    error: () => ({ code: 'unauthorized' }),
  },
  // Every other failed model call: a 400, a broken TLS session, a missing
  // secret. The reader cannot tell them apart and does not need to.
  { pattern: /^LLM request failed/iu, error: () => ({ code: 'model-unavailable' }) },
];

/**
 * A failure the backend or the BFF described in its own words, as a code.
 *
 * Their text is English, technical and written for whoever runs the service
 * («LLM request failed at iteration 2: LLM streaming: no event received for
 * 30000ms …»), and it never goes on screen: the view writes both sentences
 * from the code. It goes to the console instead, where the person debugging
 * a screenshot of «Assistenten svarte ikke» can find what the backend said.
 *
 * A code, when there is one, is read before the text, because it is what the
 * backend says on purpose: first the A16 set this app already knows, then the
 * backend's own codes. Then the known texts. Anything else is `unknown`.
 */
export function errorFromBackend(text: string | undefined, code?: unknown): ChatError {
  if (text || code) {
    console.warn('KA: tjenesten svarte med feil.', { code, text });
  }

  const known = chatErrorCode(code);
  if (known !== 'unknown') return { code: known };
  if (typeof code === 'string' && Object.hasOwn(BACKEND_CODES, code)) return BACKEND_CODES[code];

  for (const { pattern, error } of KNOWN_TEXTS) {
    const match = text?.match(pattern);
    if (match) return error(match);
  }
  return { code: 'unknown' };
}

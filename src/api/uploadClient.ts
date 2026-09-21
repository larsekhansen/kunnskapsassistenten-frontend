import type { UserDocument } from '../model';

/** Reports how far an upload has come, 0–100. */
export type UploadProgress = (percent: number) => void;

/**
 * Everything the frontend needs to manage the reader's own documents.
 *
 * Same shape as {@link ChatClient}: one interface, a mock that does the whole
 * thing and a live client that says honestly that it cannot. Nothing above
 * this layer knows which one it has.
 *
 * `upload` RESOLVES for a rejected file rather than throwing. A file that is
 * too large or of the wrong type is not an exception, it is a document with
 * `status: 'failed'` and a code — and it has to appear in the list, because a
 * reader who dropped a 40 MB file needs to see which file was refused and
 * why. Only an abort throws, the way `fetch` does.
 *
 * backend: mangler, se API-bestilling A3.
 */
export interface UploadClient {
  /**
   * Take one file. Reports progress while it runs and resolves with the
   * finished document, ready or failed.
   *
   * Throws only on abort, with the signal's reason.
   */
  upload(file: File, onProgress?: UploadProgress, signal?: AbortSignal): Promise<UserDocument>;
  /** Forget a document. Removing one that is not there is not an error. */
  remove(id: string): Promise<void>;
  /** Everything the reader has uploaded, newest last. */
  list(): Promise<UserDocument[]>;
}

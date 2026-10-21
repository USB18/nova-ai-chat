import ReactNativeBlobUtil from 'react-native-blob-util';
import { GEMINI_BASE_URL, GEMINI_API_VERSION, LIMITS } from '../../config/env';
import { toPath } from '../media/files';
import { GeminiError, errorFromHttp } from './errors';
import { apiUrl, authHeaders, getJson, sleep } from './http';

interface UploadedFile {
  name: string; // "files/abc123"
  uri: string;
  mimeType: string;
  state?: 'PROCESSING' | 'ACTIVE' | 'FAILED' | 'STATE_UNSPECIFIED';
  error?: { message?: string };
}

/**
 * Upload a local file with the Gemini Files API (resumable protocol), then wait
 * until it is ACTIVE (videos need server-side processing). Used for videos and
 * anything too large to inline. Returns the fileUri to reference in `fileData`.
 */
export async function uploadToFilesApi(opts: {
  apiKey: string;
  localUri: string;
  mimeType: string;
  sizeBytes: number;
  displayName: string;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}): Promise<{ fileUri: string; expiresAt: number }> {
  const {
    apiKey,
    localUri,
    mimeType,
    sizeBytes,
    displayName,
    signal,
    onProgress,
  } = opts;

  // 1) Start a resumable session.
  let startRes: Response;
  try {
    startRes = await fetch(
      `${GEMINI_BASE_URL}/upload/${GEMINI_API_VERSION}/files`,
      {
        method: 'POST',
        signal,
        headers: {
          ...authHeaders(apiKey),
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(sizeBytes),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file: { display_name: displayName.slice(0, 120) },
        }),
      },
    );
  } catch {
    throw signal?.aborted
      ? new GeminiError('Aborted', 'aborted')
      : new GeminiError('Upload failed: network error', 'network');
  }
  if (!startRes.ok) {
    throw errorFromHttp(startRes.status, await startRes.text());
  }
  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new GeminiError('Upload failed: no upload URL returned', 'server');
  }

  // 2) Stream the bytes straight from disk (no base64 in JS memory).
  const task = ReactNativeBlobUtil.fetch(
    'POST',
    uploadUrl,
    {
      'Content-Length': String(sizeBytes),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': mimeType,
    },
    ReactNativeBlobUtil.wrap(toPath(localUri)),
  );
  task.uploadProgress({ interval: 250 }, (sent, total) =>
    onProgress?.(total ? Number(sent) / Number(total) : 0),
  );
  const onAbort = () => task.cancel();
  signal?.addEventListener('abort', onAbort);

  let file: UploadedFile;
  try {
    const res = await task;
    const status = res.info().status;
    const text = res.text() as string;
    if (status < 200 || status >= 300) {
      throw errorFromHttp(status, text);
    }
    file = (JSON.parse(text) as { file: UploadedFile }).file;
  } catch (e) {
    if (signal?.aborted) {
      throw new GeminiError('Aborted', 'aborted');
    }
    throw e instanceof GeminiError
      ? e
      : new GeminiError('Upload failed', 'network');
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }

  // 3) Poll until processed.
  const deadline = Date.now() + 5 * 60_000;
  let delay = 1_000;
  while (file.state === 'PROCESSING') {
    if (Date.now() > deadline) {
      throw new GeminiError('File processing took too long', 'timeout');
    }
    await sleep(delay, signal);
    delay = Math.min(delay * 1.5, 5_000);
    file = await getJson<UploadedFile>(apiUrl(file.name), apiKey, signal);
  }
  if (file.state === 'FAILED') {
    throw new GeminiError(
      file.error?.message ?? 'File processing failed',
      'bad_request',
    );
  }
  onProgress?.(1);
  return { fileUri: file.uri, expiresAt: Date.now() + LIMITS.fileApiTtlMs };
}

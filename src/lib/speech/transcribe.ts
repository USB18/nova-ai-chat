import { streamGenerateContent } from '../gemini/client';
import { GeminiError, toGeminiError } from '../gemini/errors';
import { modelChain } from '../gemini/modelRouter';
import { deleteFile, readBase64 } from '../media/files';
import type { Recording } from './recorder';

const TRANSCRIBE_PROMPT = `Transcribe the speech in this audio exactly as spoken, in its original language.
Output ONLY the transcript text: no quotes, labels, timestamps or commentary.
Add normal punctuation. If there is no intelligible speech, output nothing.`;

/**
 * Speech-to-text with a Gemini audio-capable model. The transcript streams in
 * (onPartial receives the full text so far) so the composer fills as it arrives.
 */
export async function transcribe(opts: {
  apiKey: string;
  recording: Recording;
  signal?: AbortSignal;
  onPartial?: (text: string) => void;
}): Promise<string> {
  const { apiKey, recording, signal, onPartial } = opts;
  try {
    if (recording.durationSecs < 0.4) {
      return '';
    }
    const data = await readBase64(recording.uri);
    let lastError: GeminiError | undefined;

    for (const model of modelChain('transcribe')) {
      let text = '';
      try {
        await streamGenerateContent(
          apiKey,
          model,
          {
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType: recording.mimeType, data } },
                  { text: TRANSCRIBE_PROMPT },
                ],
              },
            ],
            generationConfig: { temperature: 0 },
          },
          {
            onText: d => {
              text += d;
              onPartial?.(text.trim());
            },
          },
          signal,
        );
        return text.trim();
      } catch (e) {
        const err = toGeminiError(e);
        lastError = err;
        if (!err.canFallback || text) {
          throw err;
        }
      }
    }
    throw (
      lastError ??
      new GeminiError('No transcription model available', 'not_found')
    );
  } finally {
    deleteFile(recording.uri); // recordings are never kept
  }
}

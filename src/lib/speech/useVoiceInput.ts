import { useCallback, useEffect, useRef, useState } from 'react';
import { LIMITS } from '../../config/env';
import { GeminiError, toGeminiError } from '../gemini/errors';
import { ensureMicPermission, recorder } from './recorder';
import { transcribe } from './transcribe';

export type VoiceState = 'idle' | 'recording' | 'transcribing';

/**
 * Tap-to-record → tap-to-stop → AI transcription (streamed).
 * `onTranscript(text, final)` receives the full transcript so far.
 */
export function useVoiceInput(opts: {
  apiKey: string;
  onTranscript: (text: string, final: boolean) => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<VoiceState>('idle');
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const stateRef = useRef<VoiceState>('idle');
  const set = (s: VoiceState) => {
    stateRef.current = s;
    setState(s);
  };

  const stop = useCallback(async () => {
    if (stateRef.current !== 'recording') {
      return;
    }
    set('transcribing');
    setLevel(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const recording = await recorder.stop();
      if (!recording) {
        set('idle');
        return;
      }
      const text = await transcribe({
        apiKey: optsRef.current.apiKey,
        recording,
        signal: controller.signal,
        onPartial: t => optsRef.current.onTranscript(t, false),
      });
      optsRef.current.onTranscript(text, true);
      if (!text) {
        optsRef.current.onError(
          "Didn't catch that — try speaking a little longer or closer to the mic.",
        );
      }
    } catch (e) {
      const err = toGeminiError(e);
      if (err.kind !== 'aborted') {
        optsRef.current.onError(`Transcription failed: ${err.userMessage}`);
      }
    } finally {
      abortRef.current = null;
      set('idle');
    }
  }, []);

  const start = useCallback(async () => {
    if (stateRef.current !== 'idle') {
      return;
    }
    if (!optsRef.current.apiKey) {
      optsRef.current.onError(new GeminiError('', 'auth').userMessage);
      return;
    }
    if (!(await ensureMicPermission())) {
      optsRef.current.onError(
        'Microphone permission is required for voice input.',
      );
      return;
    }
    try {
      setElapsed(0);
      set('recording');
      await recorder.start((lvl, secs) => {
        setLevel(lvl);
        setElapsed(secs);
        if (secs >= LIMITS.maxRecordingSecs) {
          stop();
        }
      });
    } catch (e) {
      set('idle');
      optsRef.current.onError(
        `Couldn't start recording: ${(e as Error).message}`,
      );
    }
  }, [stop]);

  const cancel = useCallback(async () => {
    abortRef.current?.abort();
    if (stateRef.current === 'recording') {
      await recorder.cancel();
    }
    setLevel(0);
    set('idle');
  }, []);

  // Release the mic if the component unmounts mid-recording.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      recorder.cancel();
    },
    [],
  );

  return { state, level, elapsed, start, stop, cancel };
}

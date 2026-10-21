import { PermissionsAndroid, Platform } from 'react-native';
import Sound, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  OutputFormatAndroidType,
  type AudioSet,
} from 'react-native-nitro-sound';
import { RECORDING_DIR, ensureDir, toUri } from '../media/files';

export interface Recording {
  uri: string;
  mimeType: string;
  durationSecs: number;
}

/**
 * Speech-optimised capture: 16 kHz mono.
 *  - Android: AAC in an ADTS stream (.aac → audio/aac)
 *  - iOS: 16-bit linear PCM WAV (.wav → audio/wav)
 * Both are formats the Gemini API accepts directly.
 */
const FORMAT = Platform.select({
  android: { ext: 'aac', mimeType: 'audio/aac' },
  default: { ext: 'wav', mimeType: 'audio/wav' },
});

const AUDIO_SET: AudioSet = Platform.select<AudioSet>({
  android: {
    AudioSourceAndroid: AudioSourceAndroidType.VOICE_RECOGNITION,
    OutputFormatAndroid: OutputFormatAndroidType.AAC_ADTS,
    AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
    AudioSamplingRate: 16000,
    AudioChannels: 1,
    AudioEncodingBitRate: 48000,
  },
  default: {
    AVFormatIDKeyIOS: 'lpcm',
    AVSampleRateKeyIOS: 16000,
    AVNumberOfChannelsKeyIOS: 1,
    AVModeIOS: 'spokenAudio',
  },
});

export async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true; // iOS prompts on first use using NSMicrophoneUsageDescription
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone access',
      message: 'NovaChat needs the microphone to turn your voice into text.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

class Recorder {
  private active = false;
  private startedAt = 0;

  get isRecording() {
    return this.active;
  }

  /** @param onLevel normalised 0..1 input level for the UI meter */
  async start(
    onLevel?: (level: number, elapsedSecs: number) => void,
  ): Promise<void> {
    if (this.active) {
      return;
    }
    await ensureDir(RECORDING_DIR);
    const path = `${RECORDING_DIR}/rec_${Date.now()}.${FORMAT.ext}`;
    Sound.addRecordBackListener(meta => {
      // currentMetering is dBFS (-160..0); map ~-60..0 to 0..1
      const db = meta.currentMetering ?? -60;
      const level = Math.max(0, Math.min(1, (db + 60) / 60));
      onLevel?.(level, meta.currentPosition / 1000);
    });
    await Sound.startRecorder(path, AUDIO_SET, true);
    this.active = true;
    this.startedAt = Date.now();
  }

  async stop(): Promise<Recording | null> {
    if (!this.active) {
      return null;
    }
    this.active = false;
    Sound.removeRecordBackListener();
    const uri = await Sound.stopRecorder();
    return {
      uri: toUri(uri),
      mimeType: FORMAT.mimeType,
      durationSecs: (Date.now() - this.startedAt) / 1000,
    };
  }

  /** Stop and discard. */
  async cancel(): Promise<void> {
    if (!this.active) {
      return;
    }
    this.active = false;
    Sound.removeRecordBackListener();
    try {
      await Sound.stopRecorder();
    } catch {
      // ignore
    }
  }
}

export const recorder = new Recorder();

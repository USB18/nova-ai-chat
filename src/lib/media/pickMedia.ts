import { PermissionsAndroid, Platform } from 'react-native';
import {
  type Asset,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import { LIMITS } from '../../config/env';
import type { Attachment, AttachmentKind } from '../../types/chat';
import { uid } from '../utils/id';
import { fileSize, persistFile } from './files';

export class PickError extends Error {}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  '3gp': 'video/3gpp',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
};

/** Gemini-supported image types; anything else is rejected with a clear message. */
const SUPPORTED =
  /^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|mpeg|quicktime|x-msvideo|x-flv|webm|3gpp|x-matroska|mpg|wmv))$/;

function mimeOf(asset: Asset): string {
  if (asset.type && asset.type !== 'application/octet-stream') {
    return asset.type === 'image/jpg' ? 'image/jpeg' : asset.type;
  }
  const ext =
    (asset.fileName ?? asset.uri ?? '').split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

async function toAttachment(asset: Asset): Promise<Attachment> {
  if (!asset.uri) {
    throw new PickError('The selected file could not be read.');
  }
  const mimeType = mimeOf(asset);
  if (!SUPPORTED.test(mimeType)) {
    throw new PickError(
      `Unsupported file type (${mimeType}). Use JPEG, PNG, WebP, HEIC or common video formats.`,
    );
  }
  const kind: AttachmentKind = mimeType.startsWith('video/')
    ? 'video'
    : 'image';
  const fileName = asset.fileName ?? `${kind}_${Date.now()}`;
  const localUri = await persistFile(asset.uri, fileName);
  const sizeBytes = asset.fileSize ?? (await fileSize(localUri));
  if (kind === 'video' && sizeBytes > LIMITS.maxVideoBytes) {
    throw new PickError(
      `Video is too large (max ${Math.round(
        LIMITS.maxVideoBytes / 1048576,
      )} MB).`,
    );
  }
  return {
    id: uid('att_'),
    kind,
    mimeType,
    localUri,
    fileName,
    sizeBytes,
    width: asset.width,
    height: asset.height,
    durationSecs: asset.duration,
  };
}

const COMMON = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.8 as const,
  videoQuality: 'medium' as const,
  formatAsMp4: true,
  includeBase64: false,
};

export async function pickFromLibrary(
  remaining: number,
): Promise<Attachment[]> {
  if (remaining <= 0) {
    throw new PickError(
      `You can attach up to ${LIMITS.maxAttachments} files per message.`,
    );
  }
  const res = await launchImageLibrary({
    ...COMMON,
    mediaType: 'mixed',
    selectionLimit: remaining,
  });
  return handle(res.didCancel, res.errorCode, res.errorMessage, res.assets);
}

async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const r = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export async function captureWithCamera(
  mode: 'photo' | 'video',
): Promise<Attachment[]> {
  if (!(await ensureCameraPermission())) {
    throw new PickError(
      'Camera permission is required. Enable it in system settings.',
    );
  }
  const res = await launchCamera({
    ...COMMON,
    mediaType: mode,
    durationLimit: 60,
    saveToPhotos: false,
  });
  return handle(res.didCancel, res.errorCode, res.errorMessage, res.assets);
}

async function handle(
  didCancel?: boolean,
  errorCode?: string,
  errorMessage?: string,
  assets?: Asset[],
) {
  if (didCancel) {
    return [];
  }
  if (errorCode) {
    throw new PickError(
      errorCode === 'permission'
        ? 'Permission denied. Enable photo/camera access in system settings.'
        : errorCode === 'camera_unavailable'
        ? 'Camera is not available on this device.'
        : errorMessage ?? 'Could not open the picker.',
    );
  }
  return Promise.all((assets ?? []).map(toAttachment));
}

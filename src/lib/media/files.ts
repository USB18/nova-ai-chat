import ReactNativeBlobUtil from 'react-native-blob-util';

const fs = ReactNativeBlobUtil.fs;

/** Strip the file:// scheme (and URL-encoding) for native fs calls. */
export function toPath(uri: string): string {
  const stripped = uri.replace(/^file:\/\//, '');
  try {
    return decodeURIComponent(stripped);
  } catch {
    return stripped;
  }
}

export const toUri = (path: string) =>
  path.startsWith('file://') ? path : `file://${path}`;

export const ATTACHMENT_DIR = `${fs.dirs.DocumentDir}/attachments`;
export const RECORDING_DIR = `${fs.dirs.CacheDir}/recordings`;

export async function ensureDir(dir: string): Promise<void> {
  if (!(await fs.exists(dir))) {
    await fs.mkdir(dir);
  }
}

/**
 * Copy a picked file into app storage so it survives OS cache cleanup and can be
 * re-sent on later turns (or re-uploaded after a Files API upload expires).
 */
export async function persistFile(
  srcUri: string,
  fileName: string,
): Promise<string> {
  await ensureDir(ATTACHMENT_DIR);
  const safe = fileName.replace(/[^\w.-]+/g, '_').slice(-80) || 'file';
  const dest = `${ATTACHMENT_DIR}/${Date.now()}_${safe}`;
  await fs.cp(toPath(srcUri), dest);
  return toUri(dest);
}

export async function fileExists(uri: string): Promise<boolean> {
  try {
    return await fs.exists(toPath(uri));
  } catch {
    return false;
  }
}

export async function fileSize(uri: string): Promise<number> {
  const stat = await fs.stat(toPath(uri));
  return Number(stat.size) || 0;
}

export function readBase64(uri: string): Promise<string> {
  return fs.readFile(toPath(uri), 'base64');
}

export async function deleteFile(uri: string): Promise<void> {
  try {
    const p = toPath(uri);
    if (await fs.exists(p)) {
      await fs.unlink(p);
    }
  } catch {
    // best effort
  }
}

/** Remove every persisted attachment (used by "Clear chat"). */
export async function clearAttachmentDir(): Promise<void> {
  try {
    if (await fs.exists(ATTACHMENT_DIR)) {
      await fs.unlink(ATTACHMENT_DIR);
    }
  } catch {
    // best effort
  }
}

import { LIMITS } from '../../config/env';
import type { Attachment, ChatMessage } from '../../types/chat';
import type { Content, Part } from '../../types/gemini';
import { fileExists, readBase64 } from '../media/files';
import { uploadToFilesApi } from './filesApi';

/** Media older than this many messages is replaced by a text placeholder to save bandwidth. */
const MEDIA_WINDOW = 6;

export interface BuildOptions {
  apiKey: string;
  signal?: AbortSignal;
  /** Persist Files API references so the next turn can reuse them. */
  onAttachmentUploaded?: (messageId: string, attachment: Attachment) => void;
  onUploadProgress?: (attachment: Attachment, fraction: number) => void;
}

/** Trim history to a window that starts with a user message. */
export function windowMessages(
  messages: ChatMessage[],
  max = LIMITS.historyMaxMessages,
): ChatMessage[] {
  let slice = messages.slice(-max);
  const firstUser = slice.findIndex(m => m.role === 'user');
  slice = firstUser >= 0 ? slice.slice(firstUser) : [];
  return slice;
}

export function historyHasRecentMedia(messages: ChatMessage[]): boolean {
  return messages
    .slice(-MEDIA_WINDOW)
    .some(m => m.role === 'user' && m.attachments.length > 0);
}

/** Merge consecutive same-role contents (e.g. after a failed assistant turn). */
export function normalizeContents(contents: Content[]): Content[] {
  const out: Content[] = [];
  for (const c of contents) {
    if (!c.parts.length) {
      continue;
    }
    const last = out[out.length - 1];
    if (last && last.role === c.role) {
      last.parts = [...last.parts, ...c.parts];
    } else {
      out.push({ role: c.role, parts: [...c.parts] });
    }
  }
  return out;
}

/** Convert UI messages into Gemini `contents`, resolving attachments to parts. */
export async function buildContents(
  messages: ChatMessage[],
  opts: BuildOptions,
): Promise<Content[]> {
  const windowed = windowMessages(messages);
  const contents: Content[] = [];
  const budget = { inlineBytes: 0 };

  for (let i = 0; i < windowed.length; i++) {
    const msg = windowed[i];
    const recent = i >= windowed.length - MEDIA_WINDOW;

    if (msg.role === 'user') {
      const parts: Part[] = [];
      for (const att of msg.attachments) {
        parts.push(
          recent
            ? await attachmentPart(msg.id, att, budget, opts)
            : placeholder(att, 'shared earlier'),
        );
      }
      if (msg.text.trim()) {
        parts.push({ text: msg.text });
      } else if (!parts.length) {
        continue;
      }
      contents.push({ role: 'user', parts });
    } else if (msg.turnContents.length) {
      // Replayed verbatim: keeps thought signatures + function call/response pairing.
      contents.push(
        ...msg.turnContents.map(c => ({ role: c.role, parts: c.parts })),
      );
    }
  }
  return normalizeContents(contents);
}

function placeholder(att: Attachment, why: string): Part {
  return { text: `[${att.kind} "${att.fileName}" ${why}]` };
}

async function attachmentPart(
  messageId: string,
  att: Attachment,
  budget: { inlineBytes: number },
  opts: BuildOptions,
): Promise<Part> {
  if (att.remote && att.remote.expiresAt > Date.now()) {
    return {
      fileData: { mimeType: att.mimeType, fileUri: att.remote.fileUri },
    };
  }
  if (!(await fileExists(att.localUri))) {
    return placeholder(att, 'is no longer available on this device');
  }

  const mustUpload =
    att.kind === 'video' ||
    att.sizeBytes > LIMITS.inlineMaxBytes ||
    budget.inlineBytes + att.sizeBytes > LIMITS.inlineTotalMaxBytes;

  if (mustUpload) {
    const remote = await uploadToFilesApi({
      apiKey: opts.apiKey,
      localUri: att.localUri,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
      displayName: att.fileName,
      signal: opts.signal,
      onProgress: f => opts.onUploadProgress?.(att, f),
    });
    opts.onAttachmentUploaded?.(messageId, { ...att, remote });
    return { fileData: { mimeType: att.mimeType, fileUri: remote.fileUri } };
  }

  budget.inlineBytes += att.sizeBytes;
  return {
    inlineData: {
      mimeType: att.mimeType,
      data: await readBase64(att.localUri),
    },
  };
}

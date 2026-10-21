import type { Content } from './gemini';

export type AttachmentKind = 'image' | 'video' | 'audio';

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  mimeType: string;
  /** Persistent local copy (file:// URI) inside the app's documents dir. */
  localUri: string;
  fileName: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSecs?: number;
  /** Files API reference, if the attachment was uploaded rather than inlined. */
  remote?: { fileUri: string; expiresAt: number };
}

export type ToolCallStatus = 'running' | 'success' | 'error';

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
  startedAt: number;
  durationMs?: number;
}

export type MessageStatus =
  | 'pending'
  | 'streaming'
  | 'done'
  | 'error'
  | 'stopped';

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
  attachments: Attachment[];
  createdAt: number;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  text: string;
  status: MessageStatus;
  toolCalls: ToolCallRecord[];
  model?: string;
  error?: string;
  createdAt: number;
  usage?: { promptTokens?: number; outputTokens?: number };
  /**
   * The exact API contents produced during this turn (model parts incl. thought
   * signatures, function calls and function responses). Replayed verbatim in later
   * requests so multi-step tool use stays valid.
   */
  turnContents: Content[];
}

export type ChatMessage = UserMessage | AssistantMessage;

export type ModelMode = 'auto' | string; // 'auto' or a concrete model id

export interface Settings {
  modelMode: ModelMode;
  temperature: number;
}

export const DEFAULT_SETTINGS: Settings = {
  modelMode: 'auto',
  temperature: 0.7,
};

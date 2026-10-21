/** Minimal typings for the Gemini REST API (v1beta) surface this app uses. */

export interface InlineData {
  mimeType: string;
  data: string; // base64
}

export interface FileData {
  mimeType: string;
  fileUri: string;
}

export interface FunctionCall {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
}

export interface FunctionResponse {
  id?: string;
  name: string;
  response: Record<string, unknown>;
}

/** A content part. `thoughtSignature` must be echoed back verbatim on later turns. */
export interface Part {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  inlineData?: InlineData;
  fileData?: FileData;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}

export interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

export type SchemaType =
  | 'STRING'
  | 'NUMBER'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'ARRAY'
  | 'OBJECT';

export interface Schema {
  type: SchemaType;
  description?: string;
  enum?: string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: Schema;
}

export interface GenerateContentRequest {
  contents: Content[];
  systemInstruction?: { parts: Part[] };
  tools?: { functionDeclarations: FunctionDeclaration[] }[];
  toolConfig?: { functionCallingConfig: { mode: 'AUTO' | 'ANY' | 'NONE' } };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    thinkingConfig?: {
      thinkingLevel?: 'low' | 'medium' | 'high';
      includeThoughts?: boolean;
    };
  };
}

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
}

export interface GenerateContentResponse {
  candidates?: {
    content?: { role?: string; parts?: Part[] };
    finishReason?: string;
    safetyRatings?: unknown[];
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: UsageMetadata;
  modelVersion?: string;
  error?: GeminiErrorBody['error'];
}

export interface GeminiErrorBody {
  error: { code: number; message: string; status?: string };
}

export interface GeminiModelInfo {
  name: string; // "models/gemini-3.8-flash"
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
}

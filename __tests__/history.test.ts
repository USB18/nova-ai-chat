import { buildContents, normalizeContents, windowMessages } from '../src/lib/gemini/history';
import { pickRole } from '../src/lib/gemini/modelRouter';
import { errorFromHttp } from '../src/lib/gemini/errors';
import type { AssistantMessage, Attachment, ChatMessage, UserMessage } from '../src/types/chat';

const user = (id: string, text: string, attachments: Attachment[] = []): UserMessage => ({
  id, role: 'user', text, attachments, createdAt: 0,
});
const assistant = (id: string, text: string): AssistantMessage => ({
  id, role: 'assistant', text, status: 'done', toolCalls: [], createdAt: 0,
  turnContents: [{ role: 'model', parts: [{ text, thoughtSignature: `sig-${id}` }] }],
});
const image: Attachment = {
  id: 'i1', kind: 'image', mimeType: 'image/jpeg', localUri: 'file:///docs/a.jpg', fileName: 'a.jpg', sizeBytes: 1000,
};

it('builds contents with inline media and replays assistant turns verbatim', async () => {
  const msgs: ChatMessage[] = [user('u1', 'hi'), assistant('a1', 'hello'), user('u2', 'what is this?', [image])];
  const contents = await buildContents(msgs, { apiKey: 'k' });
  expect(contents).toEqual([
    { role: 'user', parts: [{ text: 'hi' }] },
    { role: 'model', parts: [{ text: 'hello', thoughtSignature: 'sig-a1' }] },
    { role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'BASE64DATA' } }, { text: 'what is this?' }] },
  ]);
});

it('reuses a non-expired Files API upload', async () => {
  const remote = { ...image, remote: { fileUri: 'https://files/abc', expiresAt: Date.now() + 60_000 } };
  const contents = await buildContents([user('u1', '', [remote])], { apiKey: 'k' });
  expect(contents[0].parts[0]).toEqual({ fileData: { mimeType: 'image/jpeg', fileUri: 'https://files/abc' } });
});

it('merges consecutive same-role contents and drops empty ones', () => {
  expect(
    normalizeContents([
      { role: 'user', parts: [{ text: 'a' }] },
      { role: 'model', parts: [] },
      { role: 'user', parts: [{ text: 'b' }] },
    ]),
  ).toEqual([{ role: 'user', parts: [{ text: 'a' }, { text: 'b' }] }]);
});

it('windows history so it always starts with a user message', () => {
  const msgs: ChatMessage[] = [user('u1', '1'), assistant('a1', '1'), user('u2', '2'), assistant('a2', '2')];
  expect(windowMessages(msgs, 3)[0].id).toBe('u2');
});

it('routes by need', () => {
  expect(pickRole({ text: 'hi', attachments: [], historyHasMedia: false, mode: 'auto' })).toBe('fast');
  expect(pickRole({ text: 'hi', attachments: [image], historyHasMedia: false, mode: 'auto' })).toBe('multimodal');
  expect(pickRole({ text: 'please debug this', attachments: [], historyHasMedia: false, mode: 'auto' })).toBe('multimodal');
});

it('maps HTTP errors to actionable kinds', () => {
  expect(errorFromHttp(429, '{"error":{"message":"quota"}}').kind).toBe('rate_limit');
  expect(errorFromHttp(400, '{"error":{"message":"API key not valid"}}').kind).toBe('auth');
  expect(errorFromHttp(404, '').canFallback).toBe(true);
  expect(errorFromHttp(503, '').isTransient).toBe(true);
});

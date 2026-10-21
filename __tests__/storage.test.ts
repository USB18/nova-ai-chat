import {
  loadMessages,
  loadSettings,
  saveMessages,
  saveSettings,
} from '../src/lib/storage/chatStore';
import { storage } from '../src/lib/storage/mmkv';
import type { ChatMessage } from '../src/types/chat';
import { DEFAULT_SETTINGS } from '../src/types/chat';

beforeEach(() => storage.clearAll());

it('round-trips messages through MMKV and marks interrupted turns as stopped', () => {
  const msgs: ChatMessage[] = [
    { id: 'u1', role: 'user', text: 'hi', attachments: [], createdAt: 0 },
    {
      id: 'a1',
      role: 'assistant',
      text: 'part',
      status: 'streaming',
      createdAt: 0,
      turnContents: [],
      toolCalls: [
        {
          id: 't1',
          name: 'calculate',
          args: {},
          status: 'running',
          startedAt: 0,
        },
      ],
    },
  ];
  saveMessages(msgs, true);
  const loaded = loadMessages();
  expect(loaded[0]).toEqual(msgs[0]);
  expect(loaded[1]).toMatchObject({
    status: 'stopped',
    toolCalls: [{ status: 'error', error: 'Interrupted' }],
  });
});

it('returns an empty list for missing or corrupt data', () => {
  expect(loadMessages()).toEqual([]);
  storage.set('nova.messages.v1', '{not json');
  expect(loadMessages()).toEqual([]);
});

it('merges stored settings over defaults', () => {
  expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  saveSettings({ ...DEFAULT_SETTINGS, temperature: 0.2 });
  expect(loadSettings().temperature).toBe(0.2);
});

import { GEMINI_API_KEY } from '../src/config/env';
import { isPlausibleKey, loadApiKey } from '../src/lib/storage/secureKey';

it.each([
  'AIzaSyA1234567890abcdefghijklmnopqrstuv',
  'AQ.FakeKeyForTests0000000000000000000000000',
  '  AQ.FakeKeyForTests0000000000000000000000000  ',
])('accepts key format %s', key => {
  expect(isPlausibleKey(key)).toBe(true);
});

it.each([
  '',
  'short',
  'YOUR_GEMINI_API_KEY_GOES_HERE_PLEASE',
  'has spaces inside the key value here',
  undefined,
])('rejects %p', key => {
  expect(isPlausibleKey(key)).toBe(false);
});

it('never exposes the real .env key to tests', async () => {
  expect(GEMINI_API_KEY).toBe('');
  await expect(loadApiKey()).resolves.toEqual({ key: '', source: 'none' });
});

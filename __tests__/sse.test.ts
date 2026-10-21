import { SSEParser } from '../src/lib/gemini/sse';
import { mergePart } from '../src/lib/gemini/client';
import type { Part } from '../src/types/gemini';

describe('SSEParser', () => {
  it('emits events split across arbitrary chunk boundaries', () => {
    const out: string[] = [];
    const p = new SSEParser(d => out.push(d));
    const stream = 'data: {"a":1}\r\n\r\ndata: {"b":2}\n\n: keep-alive\n\ndata: {"c":3}\n\n';
    for (const ch of stream) {
      p.push(ch);
    }
    expect(out).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });

  it('handles cumulative responseText and a trailing unterminated event', () => {
    const out: string[] = [];
    const p = new SSEParser(d => out.push(d));
    p.pushCumulative('data: one\n\nda');
    p.pushCumulative('data: one\n\ndata: two');
    p.pushCumulative('data: one\n\ndata: two'); // no new bytes
    p.end();
    expect(out).toEqual(['one', 'two']);
  });

  it('joins multi-line data fields', () => {
    const out: string[] = [];
    const p = new SSEParser(d => out.push(d));
    p.push('data: line1\ndata: line2\n\n');
    expect(out).toEqual(['line1\nline2']);
  });
});

describe('mergePart', () => {
  it('concatenates streamed text and keeps the final thought signature', () => {
    const parts: Part[] = [];
    mergePart(parts, { text: 'Hel' });
    mergePart(parts, { text: 'lo' });
    mergePart(parts, { text: '', thoughtSignature: 'SIG' });
    expect(parts).toEqual([{ text: 'Hello', thoughtSignature: 'SIG' }]);
  });

  it('never merges function calls and keeps their signatures verbatim', () => {
    const parts: Part[] = [];
    mergePart(parts, { text: 'Checking…' });
    mergePart(parts, { functionCall: { name: 'a', args: {} }, thoughtSignature: 'S1' });
    mergePart(parts, { functionCall: { name: 'b', args: {} } });
    expect(parts).toHaveLength(3);
    expect(parts[1]).toEqual({ functionCall: { name: 'a', args: {} }, thoughtSignature: 'S1' });
  });
});

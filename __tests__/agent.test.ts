import { AgentError, runAgent, sanitizeTurn } from '../src/lib/agent/runAgent';
import * as client from '../src/lib/gemini/client';
import { GeminiError } from '../src/lib/gemini/errors';
import type { Content, GenerateContentRequest } from '../src/types/gemini';

jest.mock('../src/lib/gemini/client', () => ({
  ...jest.requireActual('../src/lib/gemini/client'),
  streamGenerateContent: jest.fn(),
}));
const mockStream = client.streamGenerateContent as jest.MockedFunction<typeof client.streamGenerateContent>;

const callbacks = () => ({
  onText: jest.fn(),
  onModel: jest.fn(),
  onToolStart: jest.fn(),
  onToolEnd: jest.fn(),
});

const baseInput = (cb = callbacks()) => ({
  apiKey: 'k',
  contents: [{ role: 'user', parts: [{ text: 'What is 6*7?' }] }] as Content[],
  modelChain: ['model-a', 'model-b'],
  toolsEnabled: true,
  temperature: 0.5,
  signal: new AbortController().signal,
  callbacks: cb,
});

beforeEach(() => mockStream.mockReset());

it('runs a tool round trip and replays thought signatures verbatim', async () => {
  const requests: GenerateContentRequest[] = [];
  mockStream
    .mockImplementationOnce(async (_k, _m, req) => {
      requests.push(JSON.parse(JSON.stringify(req)));
      return { parts: [{ functionCall: { id: 'c1', name: 'calculate', args: { expression: '6*7' } }, thoughtSignature: 'SIG_A' }] };
    })
    .mockImplementationOnce(async (_k, _m, req, h) => {
      requests.push(JSON.parse(JSON.stringify(req)));
      h.onText?.('It is ');
      h.onText?.('42.');
      return { parts: [{ text: 'It is 42.', thoughtSignature: 'SIG_B' }], usage: { candidatesTokenCount: 5 } };
    });

  const cb = callbacks();
  const res = await runAgent(baseInput(cb));

  expect(res.text).toBe('It is 42.');
  expect(res.model).toBe('model-a');
  // 2nd request contains the model's function call WITH its signature, then the response.
  const second = requests[1].contents;
  expect(second[1]).toEqual({ role: 'model', parts: [expect.objectContaining({ thoughtSignature: 'SIG_A' })] });
  expect(second[2].parts[0].functionResponse).toEqual({ id: 'c1', name: 'calculate', response: { result: { expression: '6*7', result: 42 } } });
  expect(cb.onToolStart).toHaveBeenCalledTimes(1);
  expect(cb.onToolEnd).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  expect(res.turnContents).toHaveLength(3);
});

it('falls back to the next model when the first is unavailable', async () => {
  mockStream
    .mockRejectedValueOnce(new GeminiError('not found', 'not_found', 404))
    .mockResolvedValueOnce({ parts: [{ text: 'hi' }] });
  const res = await runAgent(baseInput());
  expect(res.model).toBe('model-b');
  expect(mockStream.mock.calls.map(c => c[1])).toEqual(['model-a', 'model-b']);
});

it('reports unknown tools back to the model as errors instead of crashing', async () => {
  mockStream
    .mockResolvedValueOnce({ parts: [{ functionCall: { name: 'nope', args: {} } }] })
    .mockResolvedValueOnce({ parts: [{ text: 'Sorry.' }] });
  const res = await runAgent(baseInput());
  const fr = res.turnContents[1].parts[0].functionResponse!;
  expect(fr.response).toEqual({ error: 'Unknown tool "nope"' });
});

it('does not retry auth errors and surfaces them', async () => {
  mockStream.mockRejectedValue(new GeminiError('bad key', 'auth', 401));
  await expect(runAgent(baseInput())).rejects.toBeInstanceOf(AgentError);
  expect(mockStream).toHaveBeenCalledTimes(1);
});

it('drops an unanswered function call from a stopped turn', () => {
  const turn: Content[] = [
    { role: 'model', parts: [{ functionCall: { name: 'x' } }] },
    { role: 'user', parts: [{ functionResponse: { name: 'x', response: {} } }] },
    { role: 'model', parts: [{ functionCall: { name: 'y' }, thoughtSignature: 's' }] },
  ];
  expect(sanitizeTurn(turn)).toHaveLength(2);
});

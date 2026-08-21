import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { openSse } from '../src/utils/sse.js';

// vi.hoisted, not a bare const: vi.mock is hoisted above the module body, so a
// factory closing over a plain const captures it before it is initialised.
const { answerAndPersist } = vi.hoisted(() => ({ answerAndPersist: vi.fn() }));
vi.mock('../src/services/chatService.js', () => ({
  answerAndPersist,
  getChatHistory: async () => [],
}));
vi.mock('../src/middleware/auth.js', () => ({
  requireAuth: (req, _res, next) => { req.auth = { phone: '+919999900000' }; next(); },
  requireAdmin: (_req, _res, next) => next(),
}));

const { default: app } = await import('../src/server.js');

// SSE frames are `data: {json}\n\n`; parse them back into objects.
const events = (text) => text.split('\n\n')
  .map((b) => b.split('\n').find((l) => l.startsWith('data: ')))
  .filter(Boolean)
  .map((l) => JSON.parse(l.slice(6)));

const BODY = { messages: [{ role: 'user', content: 'How is my career?' }], factSheet: 'x' };
const post = () => request(app).post('/api/chat/stream').set('Authorization', 'Bearer test').send(BODY);

describe('POST /chat/stream', () => {
  beforeEach(() => answerAndPersist.mockReset());

  it('relays every delta in order and closes with the balance', async () => {
    // Once, not mockImplementation: this impl is only valid for the single call
    // the request makes, and asserting the call count below is what proves it.
    answerAndPersist.mockImplementationOnce(async (_args, onChunk) => {
      for (const p of ['Your ', 'tenth ', 'house']) onChunk(p);
      return { content: 'Your tenth house', balance: 185 };
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    // nginx buffers proxied responses by default — without this the stream
    // arrives as one lump at the end, which is not a stream at all.
    expect(res.headers['x-accel-buffering']).toBe('no');

    expect(answerAndPersist).toHaveBeenCalledTimes(1);

    const evts = events(res.text);
    expect(evts.filter((e) => e.delta).map((e) => e.delta)).toEqual(['Your ', 'tenth ', 'house']);
    expect(evts.at(-1)).toEqual({ done: true, balance: 185, blocked: false });
  });

  it('sends an off-topic refusal as a delta so the client renders it identically', async () => {
    answerAndPersist.mockResolvedValue({ content: 'I can only speak to…', balance: 200, blocked: true });

    const evts = events((await post()).text);

    expect(evts.filter((e) => e.delta).map((e) => e.delta)).toEqual(['I can only speak to…']);
    expect(evts.at(-1)).toMatchObject({ done: true, blocked: true, balance: 200 });
  });
});

// The error path is unit-tested rather than driven through a rejecting service
// mock: once the SSE headers are out, express's error handler can no longer
// produce a JSON body, so what actually matters is that close() frames the
// failure with the same { message, code } the REST envelope carries — that is
// what lets the client reuse its INSUFFICIENT_CREDITS handling unchanged.
describe('openSse', () => {
  const fakeRes = () => {
    const chunks = [];
    return {
      chunks, headers: null, ended: false, writableEnded: false,
      writeHead(_s, h) { this.headers = h; },
      write(c) { chunks.push(c); },
      end() { this.ended = true; this.writableEnded = true; },
    };
  };

  it('frames an error like the REST envelope and ends the response', () => {
    const res = fakeRes();
    openSse(res).close({ error: 'Not enough credits', code: 'INSUFFICIENT_CREDITS' });

    expect(events(res.chunks.join(''))).toEqual([
      { error: 'Not enough credits', code: 'INSUFFICIENT_CREDITS' },
    ]);
    expect(res.ended).toBe(true);
  });

  it('stops the heartbeat on close so the process can exit', () => {
    vi.useFakeTimers();
    const res = fakeRes();
    const sse = openSse(res);
    vi.advanceTimersByTime(16_000);
    expect(res.chunks.join('')).toContain(': ping');

    sse.close();
    const after = res.chunks.length;
    vi.advanceTimersByTime(60_000);
    expect(res.chunks.length).toBe(after);
    vi.useRealTimers();
  });

  it('never writes to an already-ended response', () => {
    const res = fakeRes();
    const sse = openSse(res);
    sse.close({ done: true });
    sse.send({ delta: 'too late' });

    expect(res.chunks.join('')).not.toContain('too late');
  });
});

// Server-Sent Events helper.
//
// Why SSE and not a WebSocket: this is one-way, one-shot text for the duration
// of a single answer. A socket would mean connection state to manage on a
// server that currently has none.
//
// Framing is one JSON object per event so the client never has to guess whether
// a raw text chunk was a delta or an error:
//   {"delta":"…"}                 incremental text
//   {"done":true, "balance":n}    final, carries whatever the buffered JSON did
//   {"error":"…", "code":"…"}     failed; same shape as the REST error envelope
export function openSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // nginx buffers proxied responses by default, which holds every chunk until
    // the response ends — i.e. silently un-streams the stream.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const send = (obj) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };
  // Proxies and mobile radios drop a connection that goes quiet. Gemini can
  // think for many seconds before the first token, so hold it open with a
  // comment line (ignored by every SSE parser).
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 15_000);

  return {
    send,
    close(obj) {
      if (obj) send(obj);
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
    },
  };
}

// In-flight request dedupe — if two requests for the same key arrive while
// the first is still generating (e.g. user clicks tabs / refreshes mid-call),
// the second awaits the same promise instead of triggering another AI call.
//
// NOTE: in-process only. When scaling to multiple instances, swap this for a
// Redis-backed implementation with the same { dedupe(key, worker) } signature.

const inFlight = new Map();

export function dedupe(key, worker) {
  if (inFlight.has(key)) return inFlight.get(key);
  const p = worker().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

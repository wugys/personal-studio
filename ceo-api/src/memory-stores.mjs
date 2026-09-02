export function createMemoryIdempotencyStore() {
  const records = new Map();
  return {
    durable: false,
    async claim(keyHash, requestDigest) {
      const existing = records.get(keyHash);
      if (!existing) {
        records.set(keyHash, { state: 'in_progress', requestDigest });
        return { outcome: 'claimed' };
      }
      if (existing.requestDigest !== requestDigest) return { outcome: 'conflict' };
      if (existing.state === 'in_progress') return { outcome: 'in_progress' };
      return { outcome: 'replay', record: structuredClone(existing) };
    },
    async complete(keyHash, record) {
      records.set(keyHash, { state: 'complete', ...structuredClone(record) });
    }
  };
}

export function createMemoryAuditSink() {
  const events = [];
  return {
    durable: false,
    async write(event) { events.push(structuredClone(event)); },
    events
  };
}

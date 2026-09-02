export async function toWebRequest(incoming, { protocol = 'https', maxBytes = 16384 } = {}) {
  let body;
  if (incoming.method !== 'GET' && incoming.method !== 'HEAD') {
    if (incoming.body !== undefined) {
      body = typeof incoming.body === 'string' || Buffer.isBuffer(incoming.body)
        ? incoming.body
        : JSON.stringify(incoming.body);
    } else {
      const chunks = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > maxBytes) throw Object.assign(new Error('request_too_large'), { status: 413 });
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    if (Buffer.byteLength(body || '', 'utf8') > maxBytes) throw Object.assign(new Error('request_too_large'), { status: 413 });
  }
  const host = incoming.headers.host || 'localhost';
  return new Request(`${protocol}://${host}${incoming.url}`, { method: incoming.method, headers: incoming.headers, body });
}

export async function sendWebResponse(outgoing, result) {
  outgoing.statusCode = result.status;
  for (const [name, value] of result.headers.entries()) outgoing.setHeader(name, value);
  outgoing.end(Buffer.from(await result.arrayBuffer()));
}

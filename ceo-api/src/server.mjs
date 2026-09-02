import http from 'node:http';
import { createSafeConsoleAuditSink } from './audit-sink.mjs';
import { createCeoApi } from './handler.mjs';
import { sendWebResponse, toWebRequest } from './node-request.mjs';

const host = '127.0.0.1';
const port = Number(process.env.KEVIN_CEO_PORT || 3180);
const api = createCeoApi({ auditSink: createSafeConsoleAuditSink() });

const server = http.createServer(async (incoming, outgoing) => {
  try {
    await sendWebResponse(outgoing, await api(await toWebRequest(incoming, { protocol: 'http' })));
  } catch (error) {
    const status = error?.status === 413 ? 413 : 500;
    outgoing.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    outgoing.end(JSON.stringify({ ok: false, error: status === 413 ? 'request_too_large' : 'request_failed' }));
  }
});

server.listen(port, host, () => {
  // Never print tokens, headers, request bodies, or environment values.
  console.log(`Kevin CEO API listening on http://${host}:${port}`);
});

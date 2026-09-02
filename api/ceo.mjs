import { createSafeConsoleAuditSink } from '../ceo-api/src/audit-sink.mjs';
import { createCeoApi } from '../ceo-api/src/handler.mjs';
import { sendWebResponse, toWebRequest } from '../ceo-api/src/node-request.mjs';

const api = createCeoApi({ env: process.env, auditSink: createSafeConsoleAuditSink() });

export default async function handler(request, response) {
  try {
    const result = await api(await toWebRequest(request));
    await sendWebResponse(response, result);
  } catch (error) {
    const status = error?.status === 413 ? 413 : 500;
    response.statusCode = status;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.end(JSON.stringify({ ok: false, error: status === 413 ? 'request_too_large' : 'request_failed' }));
  }
}

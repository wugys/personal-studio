import { API_PATH, CONTRACT_VERSION, ContractError, PROJECT_ID, assertOperationResult, parseEnvelope, publicCapabilities } from './contract.mjs';
import { digestHex, requireServerConfig, requireServiceToken, verifyProjectToken } from './security.mjs';

const headers = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
});

const response = (status, body) => new Response(JSON.stringify(body), { status, headers });
const safeCode = error => error instanceof ContractError ? error.code : 'operation_failed';
const safeStatus = error => error instanceof ContractError ? error.status : 500;

async function parseJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new ContractError(415, 'json_required');
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 16384) throw new ContractError(413, 'request_too_large');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > 16384) throw new ContractError(413, 'request_too_large');
  try { return JSON.parse(text); }
  catch { throw new ContractError(400, 'invalid_json'); }
}

function idempotencyKey(request) {
  const value = request.headers.get('idempotency-key') || '';
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(value)) throw new ContractError(400, 'idempotency_key_required');
  return value;
}

async function withTimeout(fn, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => fn(controller.signal)),
      new Promise((_, reject) => { timer = setTimeout(() => { const error = new ContractError(504, 'operation_timeout'); controller.abort(error); reject(error); }, timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}

export function createCeoApi({ env = process.env, appAdapter = null, idempotencyStore = null, auditSink = null, now = () => Date.now() } = {}) {
  const writesEnabled = () => String(env.KEVIN_CEO_WRITES_ENABLED).toLowerCase() === 'true';
  const adapterReady = () => Boolean(appAdapter?.supportsAbort === true && appAdapter?.snoozeAlert && appAdapter?.unsnoozeAllAlerts);
  const audit = async event => {
    if (!auditSink?.write) return false;
    try {
      await auditSink.write({ at: new Date(now()).toISOString(), projectId: PROJECT_ID, ...event });
      return true;
    } catch { return false; }
  };

  return async function handle(request) {
    let envelope = null;
    let grant = null;
    try {
      const url = new URL(request.url);
      if (url.pathname !== API_PATH) return response(404, { ok: false, error: 'not_found' });
      if (request.method !== 'POST') return response(405, { ok: false, error: 'method_not_allowed' });
      if (request.headers.has('origin')) throw new ContractError(403, 'browser_requests_forbidden');
      const { timeoutMs } = requireServerConfig(env);
      requireServiceToken(request.headers.get('x-kevin-service-token'), env.KEVIN_CEO_SERVICE_TOKEN);
      envelope = parseEnvelope(await parseJson(request));
      grant = verifyProjectToken(request.headers.get('authorization'), env.KEVIN_CEO_PROJECT_TOKEN_SECRET, envelope.operation.scope, now());
      const safeReadAudit = { requestId: envelope.requestId, operation: envelope.operation.id, scope: envelope.operation.scope, subjectHash: digestHex(grant.subject).slice(0, 16), result: 'success' };

      if (envelope.operation.id === 'system.health') {
        if (!await audit(safeReadAudit)) throw new ContractError(503, 'audit_unavailable');
        return response(200, { ok: true, requestId: envelope.requestId, operation: envelope.operation.id, result: { service: PROJECT_ID, contractVersion: CONTRACT_VERSION, appVersion: '16.75', status: 'ok' } });
      }
      if (envelope.operation.id === 'system.capabilities') {
        const writeInfrastructureReady = adapterReady() && idempotencyStore?.durable === true && auditSink?.durable === true;
        if (!await audit(safeReadAudit)) throw new ContractError(503, 'audit_unavailable');
        return response(200, { ok: true, requestId: envelope.requestId, operation: envelope.operation.id, result: { operations: publicCapabilities({ writesEnabled: writesEnabled(), adapterReady: writeInfrastructureReady }) } });
      }

      if (!writesEnabled() || !adapterReady() || !idempotencyStore?.durable || !auditSink?.durable) throw new ContractError(503, 'writes_unavailable');
      const rawKey = idempotencyKey(request);
      const keyHash = digestHex(rawKey);
      const requestDigest = digestHex(JSON.stringify({ operation: envelope.operation.id, input: envelope.input }));
      const safeAuditBase = { requestId: envelope.requestId, operation: envelope.operation.id, scope: envelope.operation.scope, subjectHash: digestHex(grant.subject).slice(0, 16), idempotencyKeyHash: keyHash.slice(0, 16) };
      if (!await audit({ ...safeAuditBase, result: 'attempted' })) throw new ContractError(503, 'audit_unavailable');
      if (typeof idempotencyStore.claim !== 'function' || typeof idempotencyStore.complete !== 'function') throw new ContractError(503, 'writes_unavailable');
      const claim = await idempotencyStore.claim(keyHash, requestDigest);
      if (claim.outcome === 'conflict') throw new ContractError(409, 'idempotency_conflict');
      if (claim.outcome === 'in_progress') throw new ContractError(409, 'request_in_progress');
      if (claim.outcome === 'replay') {
        await audit({ ...safeAuditBase, result: 'replayed' });
        return response(claim.record.status, { ...claim.record.body, requestId: envelope.requestId, replayed: true });
      }

      try {
        const execute = signal => envelope.operation.id === 'alerts.snooze'
          ? appAdapter.snoozeAlert({ alertId: envelope.input.alertId, days: envelope.input.days, signal })
          : appAdapter.unsnoozeAllAlerts({ signal });
        const result = assertOperationResult(envelope.operation.id, await withTimeout(execute, timeoutMs));
        const body = { ok: true, requestId: envelope.requestId, operation: envelope.operation.id, result };
        await idempotencyStore.complete(keyHash, { requestDigest, status: 200, body });
        await audit({ ...safeAuditBase, result: 'success' });
        return response(200, body);
      } catch (error) {
        const status = safeStatus(error);
        const body = { ok: false, error: safeCode(error) };
        await idempotencyStore.complete(keyHash, { requestDigest, status, body });
        throw error;
      }
    } catch (error) {
      const status = safeStatus(error);
      const code = safeCode(error);
      if (envelope) await audit({ requestId: envelope.requestId, operation: envelope.operation.id, scope: envelope.operation.scope, subjectHash: grant ? digestHex(grant.subject).slice(0, 16) : null, result: 'denied', reason: code });
      return response(status, { ok: false, error: code });
    }
  };
}

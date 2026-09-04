import { API_PATH, CONTRACT_VERSION, ContractError, PROJECT_ID, assertOperationResult, parseEnvelope, publicCapabilities } from './contract.mjs';
import { confirmationDigest, digestHex, requireServerConfig, requireServiceToken, verifyConfirmation, verifyProjectToken } from './security.mjs';

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

      // 🔴 TEAM-LOG R-008a：確認金鑰沒設好 → **寫入整組關掉**（503），
      //   絕對不可以退化成「那就跳過確認」。少一道關卡比整個功能不能用危險得多。
      // 🔴 TEAM-LOG R-010（顧問 codex 抓到）：**兩把金鑰相同也要擋**。
      //   以前只檢查長度，靠文件要求「請用不同的兩把」——但文件擋不住複製貼上。
      //   設成同一把的話，能簽 project token 的人就能自己簽確認，
      //   **我特地做的第二道關卡會整個消失，而且從外面看不出來**。
      const confirmSecret = String(env.KEVIN_CEO_CONFIRMATION_SECRET || '');
      const projectSecret = String(env.KEVIN_CEO_PROJECT_TOKEN_SECRET || '');
      if (!writesEnabled() || !adapterReady() || !idempotencyStore?.durable || !auditSink?.durable
          || confirmSecret.length < 32 || confirmSecret === projectSecret) throw new ContractError(503, 'writes_unavailable');
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
        // 🔴 TEAM-LOG R-008b：project token 的 `jti` 以前只驗格式、**從來沒記下用過哪些**，
        //   所以同一把權杖在有效期內（最多 5 分鐘）可以**換一個冪等鍵再寫第二次**。
        //   冪等只保證「同一個 key 只做一次」，不保證「同一把權杖只用一次」。
        //
        // ⚠ 位置很要緊：一定要放在冪等 `claim()` **之後**、而且只在 `claimed`
        //   （＝真的是新請求）時才檢查。放前面的話，**正當的重試會被誤判成重放**
        //   ——重試就是拿同一把權杖 ＋ 同一個冪等鍵再打一次，那是冪等機制存在的理由。
        //   （這個順序我第一版寫反了，寫下來免得再犯。）
        //
        // ⚠ 刻意**借用現有的耐久冪等儲存**，不另外新增一個 store：
        //   多一個「必須 durable」的依賴，就多一個會讓寫入整組關掉的前置條件。
        //   `claim()` 本身就是「第一個拿到的人才算數」，正好是一次性語意。
        // ⚠ 只對**寫入**做；讀取（health／capabilities）重放無害，
        //   而且那兩條本來就不要求耐久儲存，硬加會把它們一起關掉。
        const jtiKey = 'jti:' + digestHex(grant.jti);
        if ((await idempotencyStore.claim(jtiKey, 'token-once')).outcome !== 'claimed') {
          throw new ContractError(403, 'token_replayed');
        }
        await idempotencyStore.complete(jtiKey, { requestDigest: 'token-once', status: 0, body: {} });

        // 🔴 TEAM-LOG R-008a：確認不再是「呼叫端說了算」，要驗簽章並綁住
        //   哪個操作 ＋ 哪些參數 ＋ 誰 ＋ 多久內有效 ＋ 只能用一次。
        // ⚠ 用**另一把金鑰**（`KEVIN_CEO_CONFIRMATION_SECRET`），不是簽 project token 那把——
        //   共用一把的話，能簽權杖的人就能自己簽確認，等於沒有第二道關卡。
        const confirmation = verifyConfirmation({
          raw: envelope.input.confirmationId, secret: confirmSecret,
          operationId: envelope.operation.id, subject: grant.subject,
          inputDigest: confirmationDigest(envelope.operation.id, envelope.input), nowMs: now()
        });
        // 一次性：跟 jti 同一個做法，同樣**放在冪等 claim 之後**，
        // 否則正當的重試會被誤判成「確認重複使用」。
        const confirmKey = 'confirm:' + digestHex(confirmation.jti);
        if ((await idempotencyStore.claim(confirmKey, 'confirm-once')).outcome !== 'claimed') {
          throw new ContractError(403, 'confirmation_invalid');
        }
        await idempotencyStore.complete(confirmKey, { requestDigest: 'confirm-once', status: 0, body: {} });

        const execute = signal => envelope.operation.id === 'alerts.snooze'
          ? appAdapter.snoozeAlert({ alertId: envelope.input.alertId, days: envelope.input.days, signal })
          : appAdapter.unsnoozeAllAlerts({ signal });
        const result = assertOperationResult(envelope.operation.id, await withTimeout(execute, timeoutMs));
        const body = { ok: true, requestId: envelope.requestId, operation: envelope.operation.id, result };
        await idempotencyStore.complete(keyHash, { requestDigest, status: 200, body });
        // 🔴 TEAM-LOG R-008c：這一次 audit 的回傳值以前**沒有被檢查**
        //   （前面那次 `attempted` 是 `if (!await audit(...)) throw`，這裡卻直接忽略）。
        //   結果是「資料已經改了、卻沒有成功的稽核紀錄，而 API 照樣回 200」——
        //   事後對帳只看得到 attempted，分不出是失敗還是沒記到。
        // ⚠ 顧問建議「回失敗」，**不採納**：資料是真的改了，回失敗是更大的謊。
        //   誠實的做法是照實回 200，但**在回應裡講出來這次沒記到稽核**。
        if (!await audit({ ...safeAuditBase, result: 'success' })) {
          body.auditRecorded = false;
          // 同一個冪等鍵被重放時也要看到同一句話，否則兩次回應會不一致
          try { await idempotencyStore.complete(keyHash, { requestDigest, status: 200, body }); } catch {}
        }
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

import crypto from 'node:crypto';
import { ContractError, PROJECT_ID, TOKEN_AUDIENCE } from './contract.mjs';

const hash = value => crypto.createHash('sha256').update(String(value)).digest();
const safeEqual = (left, right) => crypto.timingSafeEqual(hash(left), hash(right));
const exactKeys = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

export function requireServerConfig(env) {
  if (String(env.KEVIN_CEO_API_ENABLED).toLowerCase() !== 'true') throw new ContractError(503, 'service_unavailable');
  if (String(env.KEVIN_CEO_SERVICE_TOKEN || '').length < 32 || String(env.KEVIN_CEO_PROJECT_TOKEN_SECRET || '').length < 32) {
    throw new ContractError(503, 'service_unavailable');
  }
  const timeout = Number(env.KEVIN_CEO_TIMEOUT_MS || 1500);
  return { timeoutMs: Number.isInteger(timeout) && timeout >= 100 && timeout <= 5000 ? timeout : 1500 };
}

export function requireServiceToken(received, expected) {
  if (!received || !safeEqual(received, expected)) throw new ContractError(401, 'authentication_failed');
}

export function verifyProjectToken(raw, secret, requiredScope, nowMs = Date.now()) {
  const token = String(raw || '').replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new ContractError(403, 'authorization_failed');
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  if (!safeEqual(parts[1], expected)) throw new ContractError(403, 'authorization_failed');
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
  catch { throw new ContractError(403, 'authorization_failed'); }
  if (!exactKeys(payload, ['aud', 'projectId', 'subject', 'scopes', 'exp', 'jti']) ||
      payload.aud !== TOKEN_AUDIENCE || payload.projectId !== PROJECT_ID ||
      typeof payload.subject !== 'string' || !/^[A-Za-z0-9._:@-]{1,120}$/.test(payload.subject) ||
      !Array.isArray(payload.scopes) || payload.scopes.length !== 1 || payload.scopes[0] !== requiredScope ||
      !Number.isFinite(payload.exp) || payload.exp <= nowMs || payload.exp > nowMs + 5 * 60 * 1000 + 5000 ||
      typeof payload.jti !== 'string' || !/^[A-Za-z0-9-]{16,128}$/.test(payload.jti)) {
    throw new ContractError(403, 'authorization_failed');
  }
  return payload;
}

export const digestHex = value => crypto.createHash('sha256').update(String(value)).digest('hex');

// ── 使用者確認（TEAM-LOG R-008a）───────────────────────────────────────────
//
// 🔴 以前 `confirmationId` **只檢查字元格式**，沒有簽章、沒跟任何東西綁定
//   → 拿到寫入權杖的人可以自己**捏一個**，「使用者確認過」變成呼叫端自己宣告的。
//
// 現在它是一個獨立簽章的權杖，綁住五件事：
//   operation（哪個操作）／inputDigest（哪些參數）／subject（誰）／exp（多久內有效）／jti（只能用一次）
//
// ⚠ **用另一把金鑰** `KEVIN_CEO_CONFIRMATION_SECRET`，不是 project token 那把。
//   共用一把的話，能簽權杖的人就能自己簽確認——那等於沒有第二道關卡。
//
// ⚠ `inputDigest` 算的是**扣掉 confirmedByUser / confirmationId 之後**的輸入，
//   否則會變成「要先知道簽章才算得出要簽什麼」的循環。
//   欄位先排序再序列化，同一組參數在任何順序下都得到同一個摘要。
export function confirmationDigest(operationId, input) {
  const rest = { ...input };
  delete rest.confirmedByUser;
  delete rest.confirmationId;
  const canonical = JSON.stringify(Object.keys(rest).sort().map(k => [k, rest[k]]));
  return digestHex(`${operationId}|${canonical}`);
}

export function verifyConfirmation({ raw, secret, operationId, subject, inputDigest, nowMs = Date.now() }) {
  const parts = String(raw || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new ContractError(403, 'confirmation_invalid');
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  if (!safeEqual(parts[1], expected)) throw new ContractError(403, 'confirmation_invalid');
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
  catch { throw new ContractError(403, 'confirmation_invalid'); }
  // ⚠ 一個錯誤碼就好。分開講「簽章錯」「過期」「綁錯操作」等於告訴攻擊者他離成功多近。
  if (!exactKeys(payload, ['aud', 'projectId', 'operation', 'inputDigest', 'subject', 'exp', 'jti']) ||
      payload.aud !== TOKEN_AUDIENCE || payload.projectId !== PROJECT_ID ||
      payload.operation !== operationId ||          // 綁「哪個操作」——不能拿 A 操作的確認去做 B
      payload.inputDigest !== inputDigest ||        // 綁「哪些參數」——不能改掉 alertId 再送
      payload.subject !== subject ||                // 綁「誰」——要跟 project token 同一個人
      !Number.isFinite(payload.exp) || payload.exp <= nowMs || payload.exp > nowMs + 5 * 60 * 1000 + 5000 ||
      typeof payload.jti !== 'string' || !/^[A-Za-z0-9-]{16,128}$/.test(payload.jti)) {
    throw new ContractError(403, 'confirmation_invalid');
  }
  return payload;
}

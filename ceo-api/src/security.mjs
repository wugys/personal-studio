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

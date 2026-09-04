export { API_PATH, PROJECT_ID, TOKEN_AUDIENCE, CONTRACT_VERSION } from './contract-constants.mjs';
import { CAPABILITY_REGISTRY } from './capability-registry.mjs';

export class ContractError extends Error {
  constructor(status, code) {
    super(code);
    this.name = 'ContractError';
    this.status = status;
    this.code = code;
  }
}

const plainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function exactKeys(value, expected) {
  if (!plainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function emptyInput(value) {
  if (!exactKeys(value, [])) throw new ContractError(400, 'invalid_input');
  return {};
}

// 🔴 TEAM-LOG R-008a：`confirmationId` 現在是一個**獨立簽章的確認權杖**，
//   不再是隨便一個字串。這裡只檢查「長相對不對」——**簽章是在 handler 驗的**
//   （這個檔案是純粹的形狀檢查，手上沒有金鑰，也不應該有）。
//   格式：`base64url(payload).base64url(hmac)`。
const CONFIRMATION_TOKEN = /^[A-Za-z0-9_-]{24,1024}\.[A-Za-z0-9_-]{24,128}$/;
function confirmedAction(value) {
  if (!exactKeys(value, ['confirmedByUser', 'confirmationId'])) throw new ContractError(400, 'invalid_input');
  if (value.confirmedByUser !== true || !CONFIRMATION_TOKEN.test(value.confirmationId)) {
    throw new ContractError(400, 'explicit_confirmation_required');
  }
  return { confirmedByUser: true, confirmationId: value.confirmationId };
}

function snoozeInput(value) {
  if (!exactKeys(value, ['alertId', 'days', 'confirmedByUser', 'confirmationId'])) throw new ContractError(400, 'invalid_input');
  if (!/^a[a-z0-9]{1,40}$/.test(value.alertId) || value.days !== 7) throw new ContractError(400, 'invalid_input');
  return { ...confirmedAction({ confirmedByUser: value.confirmedByUser, confirmationId: value.confirmationId }), alertId: value.alertId, days: 7 };
}

const executable = Object.freeze({
  'system.health': Object.freeze({
    id: 'system.health', kind: 'read', scope: 'kevin-ai-system:read:system.health', validate: emptyInput,
    description: 'Returns contract and application version metadata only; it does not read personal data.'
  }),
  'system.capabilities': Object.freeze({
    id: 'system.capabilities', kind: 'read', scope: 'kevin-ai-system:read:system.capabilities', validate: emptyInput,
    description: 'Returns the fixed operation allow-list and current availability flags.'
  }),
  'alerts.snooze': Object.freeze({
    id: 'alerts.snooze', kind: 'write', scope: 'kevin-ai-system:write:alerts.snooze', validate: snoozeInput,
    description: 'Snoozes one existing dashboard alert for exactly seven days.'
  }),
  'alerts.unsnooze-all': Object.freeze({
    id: 'alerts.unsnooze-all', kind: 'write', scope: 'kevin-ai-system:write:alerts.unsnooze-all', validate: confirmedAction,
    description: 'Restores all dashboard alerts that were previously snoozed.'
  })
});

export function operationFor(id) {
  return typeof id === 'string' ? CAPABILITY_REGISTRY.find(operation => operation.id === id) || null : null;
}

export function publicCapabilities({ writesEnabled, adapterReady }) {
  return CAPABILITY_REGISTRY.map(operation => ({
    ...operation,
    available: operation.status === 'enabled' || (operation.status === 'enabled_when_adapter_ready' && writesEnabled === true && adapterReady === true)
  }));
}

export function parseEnvelope(value) {
  if (!exactKeys(value, ['operation', 'requestId', 'input'])) throw new ContractError(400, 'invalid_request');
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(value.requestId)) throw new ContractError(400, 'invalid_request');
  const operation = operationFor(value.operation);
  if (!operation) throw new ContractError(400, 'unknown_operation');
  const implementation = executable[operation.id];
  if (!implementation) throw new ContractError(503, 'operation_unavailable');
  return { operation: { ...operation, validate: implementation.validate }, requestId: value.requestId, input: implementation.validate(value.input) };
}

export function assertOperationResult(operationId, value) {
  if (operationId === 'alerts.snooze') {
    if (!exactKeys(value, ['alertId', 'snoozedUntil']) || !/^a[a-z0-9]{1,40}$/.test(value.alertId) || !Number.isFinite(Date.parse(value.snoozedUntil))) {
      throw new ContractError(502, 'invalid_adapter_response');
    }
  } else if (operationId === 'alerts.unsnooze-all') {
    if (!exactKeys(value, ['restored']) || value.restored !== true) throw new ContractError(502, 'invalid_adapter_response');
  }
  return value;
}

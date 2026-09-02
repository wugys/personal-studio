import { ContractError } from './contract.mjs';

export function createAlertSnoozeAdapter({ loadState, saveState, listAlertIds, now = () => Date.now() }) {
  if (typeof loadState !== 'function' || typeof saveState !== 'function' || typeof listAlertIds !== 'function') {
    throw new TypeError('loadState, saveState, and listAlertIds are required');
  }
  return Object.freeze({
    supportsAbort: true,
    async snoozeAlert({ alertId, days, signal }) {
      if (signal?.aborted) throw signal.reason;
      const existingIds = await listAlertIds();
      if (!Array.isArray(existingIds) || !existingIds.includes(alertId)) throw new ContractError(404, 'alert_not_found');
      const current = await loadState();
      if (signal?.aborted) throw signal.reason;
      const state = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
      const expiresAt = now() + days * 86400000;
      state[alertId] = expiresAt;
      await saveState(state);
      return { alertId, snoozedUntil: new Date(expiresAt).toISOString() };
    },
    async unsnoozeAllAlerts({ signal }) {
      if (signal?.aborted) throw signal.reason;
      await saveState({});
      return { restored: true };
    }
  });
}

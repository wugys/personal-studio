export function createSafeConsoleAuditSink(logger = console) {
  return Object.freeze({
    durable: false,
    async write(event) {
      const safe = {
        at: event.at,
        projectId: event.projectId,
        requestId: event.requestId || null,
        operation: event.operation || null,
        scope: event.scope || null,
        subjectHash: event.subjectHash || null,
        result: event.result,
        reason: event.reason || null,
        idempotencyKeyHash: event.idempotencyKeyHash || null
      };
      logger.info('[kevin-ceo-audit]', JSON.stringify(safe));
    }
  });
}

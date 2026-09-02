import { PROJECT_ID } from './contract-constants.mjs';

const SCHEMAS = Object.freeze({
  empty: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  confirmation: { type: 'object', additionalProperties: false, properties: { confirmedByUser: { const: true }, confirmationId: { type: 'string', minLength: 8, maxLength: 128 } }, required: ['confirmedByUser', 'confirmationId'] },
  snooze: { type: 'object', additionalProperties: false, properties: { alertId: { type: 'string', pattern: '^a[a-z0-9]{1,40}$' }, days: { const: 7 }, confirmedByUser: { const: true }, confirmationId: { type: 'string', minLength: 8, maxLength: 128 } }, required: ['alertId', 'days', 'confirmedByUser', 'confirmationId'] },
  query: { type: 'object', additionalProperties: false, properties: { cursor: { type: 'string', maxLength: 160 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, required: [] },
  entityId: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', minLength: 1, maxLength: 128 }, confirmedByUser: { const: true }, confirmationId: { type: 'string', minLength: 8, maxLength: 128 } }, required: ['id', 'confirmedByUser', 'confirmationId'] },
  entityMutation: { type: 'object', additionalProperties: false, properties: { entity: { type: 'object', maxProperties: 40 }, confirmedByUser: { const: true }, confirmationId: { type: 'string', minLength: 8, maxLength: 128 } }, required: ['entity', 'confirmedByUser', 'confirmationId'] },
  selection: { type: 'object', additionalProperties: false, properties: { ids: { type: 'array', maxItems: 100, items: { type: 'string', maxLength: 128 } }, confirmedByUser: { const: true }, confirmationId: { type: 'string', minLength: 8, maxLength: 128 } }, required: ['ids', 'confirmedByUser', 'confirmationId'] },
  exportQuery: { type: 'object', additionalProperties: false, properties: { format: { enum: ['json', 'csv'] }, confirmedByUser: { const: true }, confirmationId: { type: 'string', minLength: 8, maxLength: 128 } }, required: ['format', 'confirmedByUser', 'confirmationId'] },
  importEnvelope: { type: 'object', additionalProperties: false, properties: { formatVersion: { type: 'string', maxLength: 32 }, payloadDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' }, confirmedByUser: { const: true }, confirmationId: { type: 'string', minLength: 8, maxLength: 128 } }, required: ['formatVersion', 'payloadDigest', 'confirmedByUser', 'confirmationId'] },
  readResult: { type: 'object', additionalProperties: false, properties: { items: { type: 'array' }, nextCursor: { type: ['string', 'null'] } }, required: ['items', 'nextCursor'] },
  mutationResult: { type: 'object', additionalProperties: false, properties: { changed: { type: 'boolean' }, entityId: { type: ['string', 'null'] } }, required: ['changed', 'entityId'] },
  externalResult: { type: 'object', additionalProperties: false, properties: { accepted: { type: 'boolean' }, completedAt: { type: ['string', 'null'], format: 'date-time' } }, required: ['accepted', 'completedAt'] }
  ,healthResult: { type: 'object', additionalProperties: false, properties: { service: { const: 'kevin-ai-system' }, contractVersion: { type: 'string' }, appVersion: { type: 'string' }, status: { const: 'ok' } }, required: ['service', 'contractVersion', 'appVersion', 'status'] }
  ,capabilitiesResult: { type: 'object', additionalProperties: false, properties: { operations: { type: 'array', items: { type: 'object' } } }, required: ['operations'] }
  ,snoozeResult: { type: 'object', additionalProperties: false, properties: { alertId: { type: 'string' }, snoozedUntil: { type: 'string', format: 'date-time' } }, required: ['alertId', 'snoozedUntil'] }
  ,restoreResult: { type: 'object', additionalProperties: false, properties: { restored: { const: true } }, required: ['restored'] }
});

const scope = (kind, id) => `${PROJECT_ID}:${kind}:${id}`;
const cap = ({ id, domain, kind, sensitivity, status, input = 'empty', output = kind === 'read' ? 'readResult' : 'mutationResult', externalEffect = false, evidence }) => Object.freeze({
  id, domain, kind, scope: scope(kind, id), sensitivity, status,
  idempotencyRequired: kind === 'write',
  explicitConfirmationRequired: kind === 'write' || externalEffect,
  externalEffect,
  inputSchema: SCHEMAS[input], outputSchema: SCHEMAS[output], evidence
});

const read = (domain, id, sensitivity, evidence, status = 'pending_storage_adapter') => cap({ id: `${domain}.${id}`, domain, kind: 'read', sensitivity, status, input: id === 'read' || id === 'summary' || id === 'list' ? 'query' : 'empty', evidence });
const write = (domain, id, sensitivity, evidence, input = id.includes('delete') || id.includes('remove') ? 'entityId' : 'entityMutation', status = 'pending_storage_adapter') => cap({ id: `${domain}.${id}`, domain, kind: 'write', sensitivity, status, input, evidence });
const effect = (domain, id, sensitivity, evidence, status = 'pending_external_connector') => cap({ id: `${domain}.${id}`, domain, kind: 'write', sensitivity, status, input: 'selection', output: 'externalResult', externalEffect: true, evidence });
const transfer = (domain, id, sensitivity, evidence) => cap({ id: `${domain}.${id}`, domain, kind: id.endsWith('import') ? 'write' : 'read', sensitivity, status: 'pending_secure_transfer_design', input: id.endsWith('import') ? 'importEnvelope' : 'exportQuery', output: id.endsWith('import') ? 'mutationResult' : 'externalResult', externalEffect: true, evidence });

const assetDomains = [
  ['tw-stock', 'm_tw_stock'], ['us-stock', 'm_us_stock'], ['crypto', 'm_crypto'],
  ['dividend-etf', 'm_etf_dividend'], ['market-etf', 'm_etf_market'], ['bond', 'm_bond'],
  ['forex', 'm_forex'], ['fund', 'm_active_fund'], ['metals', 'm_metals']
];

const capabilities = [
  cap({ id: 'system.health', domain: 'system', kind: 'read', sensitivity: 'none', status: 'enabled', evidence: 'v16.75 static application and contract metadata', output: 'healthResult' }),
  cap({ id: 'system.capabilities', domain: 'system', kind: 'read', sensitivity: 'none', status: 'enabled', evidence: 'this reviewed registry', output: 'capabilitiesResult' }),
  cap({ id: 'alerts.snooze', domain: 'alerts', kind: 'write', sensitivity: 'low', status: 'enabled_when_adapter_ready', input: 'snooze', output: 'snoozeResult', evidence: 'personal-dashboard.html snoozeAlert(id, 7)' }),
  cap({ id: 'alerts.unsnooze-all', domain: 'alerts', kind: 'write', sensitivity: 'low', status: 'enabled_when_adapter_ready', input: 'confirmation', output: 'restoreResult', evidence: 'personal-dashboard.html unsnoozeAllAlerts()' }),
  read('dashboard', 'summary', 'financial', 'm_dashboard cashflowView'),
  effect('dashboard', 'fx.refresh', 'financial', 'refreshCashflowFx()'),
  read('allocation', 'analysis', 'financial', 'm_allocation allocationView'),
  write('allocation', 'config.update', 'financial', 'saveAllocConfig()'),
  read('dca', 'schedule', 'financial', 'm_dca and dcaBuildSchedule()'),
  write('dca', 'plan.upsert', 'financial', 'saveDcaPlan()'),
  write('dca', 'plan.delete', 'financial', 'deleteDcaPlan()'),
  write('dca', 'execution.record', 'financial', 'saveDcaExec()'),
  write('dca', 'execution.delete', 'financial', 'deleteDcaExec()'),
  transfer('dca', 'data.export', 'financial', 'exportDcaData()'),
  transfer('dca', 'data.import', 'financial', 'importDcaData()'),
  read('goals', 'progress', 'financial', 'm_goals goal tracker'),
  write('goals', 'goal.upsert', 'financial', 'saveGoal()'),
  write('goals', 'goal.delete', 'financial', 'deleteGoal()'),
  transfer('goals', 'data.export', 'financial', 'exportGoalData()'),
  transfer('goals', 'data.import', 'financial', 'importGoalData()'),
  read('opportunities', 'list', 'financial', 'm_double/m_leverage and opportunities'),
  write('opportunities', 'opportunity.upsert', 'financial', 'saveOpportunity()'),
  write('opportunities', 'opportunity.delete', 'financial', 'deleteOpportunityConfirm()'),
  read('analysis-log', 'list', 'financial', 'analysis_log_v1'),
  write('analysis-log', 'entry.upsert', 'financial', 'saveAlogEntry()'),
  write('analysis-log', 'entry.delete', 'financial', 'deleteAlogEntry()'),
  write('analysis-log', 'plan.update', 'financial', 'saveAlogPlan()'),
  write('analysis-log', 'watchlist.add', 'financial', 'addCurrentToWatch()/addScanToWatch()'),
  write('analysis-log', 'watchlist.remove', 'financial', 'removeFromPlanWatch()'),
  transfer('analysis-log', 'data.export', 'financial', 'exportAlogData()'),
  read('asset-history', 'read', 'financial', 'studio_history_v1'),
  write('asset-history', 'snapshot.record', 'financial', 'recordAssetSnapshotManual()'),
  transfer('asset-history', 'data.export', 'financial', 'exportAssetHistory()'),
  read('association', 'summary', 'personal', 'm_assoc organization module'),
  write('association', 'organization.update', 'personal', 'saveAssocOrg()'),
  write('association', 'member.upsert', 'personal', 'saveAssocMember()'),
  write('association', 'member.delete', 'personal', 'deleteAssocMember()'),
  write('association', 'event.upsert', 'personal', 'saveAssocEvent()'),
  write('association', 'event.delete', 'personal', 'deleteAssocEvent()'),
  write('association', 'due.upsert', 'financial', 'saveAssocDue()'),
  write('association', 'due.delete', 'financial', 'deleteAssocDue()'),
  transfer('association', 'data.export', 'personal', 'exportAssocData()'),
  transfer('association', 'data.import', 'personal', 'importAssocData()'),
  read('travel', 'trip.list', 'personal', 'm_travel tripsView'),
  read('travel', 'trip.read', 'personal', 'travel multi-trip storage'),
  write('travel', 'trip.create', 'personal', 'addNewTrip()'),
  write('travel', 'trip.delete', 'personal', 'deleteCurrentTrip()'),
  write('travel', 'roster.upsert', 'sensitive_personal', 'saveRosterPerson()'),
  write('travel', 'roster.delete', 'sensitive_personal', 'deleteRosterPerson()'),
  write('travel', 'roster.import', 'sensitive_personal', 'importPartyToRoster()', 'importEnvelope'),
  write('travel', 'sos.update', 'sensitive_personal', 'saveSos()/saveSosContacts()'),
  write('travel', 'spot.upsert', 'personal', 'saveUserSpot()'),
  write('travel', 'spot.delete', 'personal', 'deleteUserSpot()'),
  write('travel', 'gathering.upsert', 'personal', 'saveGather()'),
  write('travel', 'checklist.upsert', 'personal', 'saveChecklistItem()'),
  write('travel', 'checklist.delete', 'personal', 'deleteCheck()'),
  write('travel', 'expense.upsert', 'financial', 'saveExpense()'),
  write('travel', 'expense.delete', 'financial', 'deleteExpense()'),
  write('travel', 'budget.update', 'financial', 'saveBudgetTotal()'),
  write('travel', 'shopping.upsert', 'financial', 'saveShopItem()'),
  write('travel', 'shopping.delete', 'financial', 'deleteShopItem()'),
  write('travel', 'settings.update', 'personal', 'saveTravelKey()/saveTripFx()'),
  transfer('travel', 'data.export', 'sensitive_personal', 'exportTravelData()/exportTripPdf()'),
  transfer('travel', 'data.import', 'sensitive_personal', 'importTravelData()'),
  effect('travel', 'gps.refresh', 'precise_location', 'refreshGps()'),
  effect('travel', 'party.sync', 'sensitive_personal', 'refreshPartyMembers()/refreshPartyLocations()'),
  read('ai-api-archive', 'list', 'secret', 'm_apis API archive', 'forbidden_secret_material'),
  write('ai-api-archive', 'entry.upsert', 'secret', 'saveApi()', 'entityMutation', 'forbidden_secret_material'),
  write('ai-api-archive', 'entry.delete', 'secret', 'deleteApi()', 'entityId', 'forbidden_secret_material'),
  transfer('ai-api-archive', 'data.export', 'secret', 'exportApiData()'),
  transfer('ai-api-archive', 'data.import', 'secret', 'importApiData()'),
  effect('ai', 'analysis.invoke', 'financial', 'run AI analysis functions'),
  effect('scanner', 'run', 'financial', 'stock scanner functions'),
  read('scanner', 'results.read', 'financial', 'scanner result cache'),
  effect('market-data', 'prices.refresh', 'financial', 'refreshAllPrices()'),
  effect('market-data', 'news.refresh', 'financial', 'refreshAllTwNews()'),
  transfer('backup', 'full.export', 'sensitive_personal', 'exportFullBackup()'),
  transfer('backup', 'full.import', 'sensitive_personal', 'full backup import path'),
  write('workspace', 'group.upsert', 'low', 'saveGroup()'),
  write('workspace', 'group.delete', 'low', 'deleteGroupConfirm()'),
  write('workspace', 'module.upsert', 'low', 'saveModule()'),
  write('workspace', 'module.delete', 'low', 'deleteModuleConfirm()')
];

for (const [domain, moduleId] of assetDomains) {
  capabilities.push(
    read(domain, 'summary', 'financial', `${moduleId} summary and holdings`),
    write(domain, 'holding.upsert', 'financial', `${moduleId} save holding`),
    write(domain, 'holding.delete', 'financial', `${moduleId} delete holding`),
    write(domain, 'transaction.record', 'financial', `${moduleId} save transaction`),
    write(domain, 'transaction.delete', 'financial', `${moduleId} delete transaction`),
    effect(domain, 'prices.refresh', 'financial', `${moduleId} refresh prices`),
    transfer(domain, 'data.export', 'financial', `${moduleId} export data`),
    transfer(domain, 'data.import', 'financial', `${moduleId} import data`)
  );
}

for (const [domain, moduleId] of [['rental', 'm_rental'], ['commercial-real-estate', 'm_commercial']]) {
  capabilities.push(
    read(domain, 'summary', 'financial', `${moduleId} property summary`),
    write(domain, 'property.upsert', 'financial', 'saveReProp()'),
    write(domain, 'property.delete', 'financial', 'deleteReProp()'),
    write(domain, 'transaction.upsert', 'financial', 'saveReTxn()'),
    write(domain, 'transaction.delete', 'financial', 'deleteReTxn()'),
    transfer(domain, 'data.export', 'financial', 'exportReData()'),
    transfer(domain, 'data.import', 'financial', 'importReData()')
  );
}

export const CAPABILITY_REGISTRY = Object.freeze(capabilities);
export const CAPABILITY_SCHEMAS = SCHEMAS;

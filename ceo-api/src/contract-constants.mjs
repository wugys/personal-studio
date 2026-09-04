export const API_PATH = '/api/ceo/v1/execute';
export const PROJECT_ID = 'kevin-ai-system';
export const TOKEN_AUDIENCE = 'ceo-project';
// 1.2.0：confirmationId 從「任意字串」改成**獨立簽章的確認權杖**（TEAM-LOG R-008a）。
// 這是破壞性變更——舊的呼叫端送任意字串會拿到 400/403。寫入本來就還沒開，所以現在改代價最小。
export const CONTRACT_VERSION = '1.2.0';

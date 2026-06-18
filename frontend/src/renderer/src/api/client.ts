declare global {
  interface Window {
    api: {
      call: (method: string, path: string, body?: unknown) => Promise<unknown>
      getPort: () => Promise<number>
    }
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return window.api.call(method, path, body) as Promise<T>
}

export const api = {
  // Connections
  getConnections: () => request('GET', '/api/connections'),
  createConnection: (config: unknown) => request('POST', '/api/connections', config),
  deleteConnection: (id: string) => request('DELETE', `/api/connections/${id}`),
  connect: (id: string) => request('POST', `/api/connections/${id}/connect`),
  disconnect: (id: string) => request('POST', `/api/connections/${id}/disconnect`),

  // Queries
  executeQuery: (connectionId: string, sql: string, maxRows = 1000) =>
    request('POST', '/api/query', { connectionId, sql, maxRows }),
  explainPlan: (connectionId: string, sql: string) =>
    request('POST', '/api/query/explain', { connectionId, sql }),

  // Schema
  getOwners: (connId: string) => request('GET', `/api/schema/${connId}/owners`),
  getObjectTypes: (connId: string, owner: string) =>
    request('GET', `/api/schema/${connId}/${owner}/types`),
  getObjects: (connId: string, owner: string, type: string) =>
    request('GET', `/api/schema/${connId}/${owner}/${type}`),
  getColumns: (connId: string, owner: string, table: string) =>
    request('GET', `/api/schema/${connId}/${owner}/table/${table}/columns`),
  getIndexes: (connId: string, owner: string, table: string) =>
    request('GET', `/api/schema/${connId}/${owner}/table/${table}/indexes`),
  getConstraints: (connId: string, owner: string, table: string) =>
    request('GET', `/api/schema/${connId}/${owner}/table/${table}/constraints`),
  getDdl: (connId: string, owner: string, type: string, name: string) =>
    request('GET', `/api/schema/${connId}/${owner}/${type}/${name}/ddl`),

  // Objects
  getObjectSource: (connId: string, owner: string, type: string, name: string) =>
    request('GET', `/api/objects/${connId}/${owner}/${type}/${name}/source`),
  saveObject: (payload: unknown) => request('POST', '/api/objects/save', payload),
  getObjectErrors: (connId: string, owner: string, type: string, name: string) =>
    request('GET', `/api/objects/${connId}/${owner}/${type}/${name}/errors`),
  getPackage: (connId: string, owner: string, name: string) =>
    request('GET', `/api/objects/${connId}/${owner}/package/${name}`),

  // Tables
  createTable: (payload: unknown) => request('POST', '/api/tables/create', payload),
  alterTable: (payload: unknown) => request('POST', '/api/tables/alter', payload),
  getTableData: (connId: string, owner: string, table: string, limit = 200, offset = 0) =>
    request('GET', `/api/tables/${connId}/${owner}/${table}/data?limit=${limit}&offset=${offset}`),
  getTableCount: (connId: string, owner: string, table: string) =>
    request('GET', `/api/tables/${connId}/${owner}/${table}/count`),

  // Callable object metadata
  getCallableObjects: (connId: string) =>
    request('GET', `/api/schema/${connId}/callable`),
  getCallableParams: (connId: string, name: string, pkg?: string) =>
    request('GET', `/api/schema/${connId}/callable/${encodeURIComponent(name)}/params${pkg ? `?pkg=${encodeURIComponent(pkg)}` : ''}`),

  // Debug sessions
  startDebugSession: (connectionId: string) =>
    request('POST', '/api/debug/start', { connectionId }),
  debugExecute: (sessionId: string, sql: string) =>
    request('POST', '/api/debug/execute', { sessionId, sql }),
  debugCommit: (sessionId: string) =>
    request('POST', `/api/debug/${sessionId}/commit`),
  debugRollback: (sessionId: string) =>
    request('POST', `/api/debug/${sessionId}/rollback`),
  debugClose: (sessionId: string) =>
    request('DELETE', `/api/debug/${sessionId}`),
  debugStatus: (sessionId: string) =>
    request('GET', `/api/debug/${sessionId}/status`),

  // Users
  getUsers: (connId: string) => request('GET', `/api/users/${connId}`),
  getUserPrivileges: (connId: string, username: string) =>
    request('GET', `/api/users/${connId}/${username}/privileges`),
  createUser: (payload: unknown) => request('POST', '/api/users/create', payload),
  grantPrivileges: (payload: unknown) => request('POST', '/api/users/grant', payload),
  revokePrivileges: (payload: unknown) => request('POST', '/api/users/revoke', payload),
  lockUser: (connId: string, username: string, lock: boolean) =>
    request('POST', `/api/users/${connId}/${username}/lock?lock=${lock}`),
  changePassword: (payload: unknown) => request('POST', '/api/users/password', payload),
  dropUser: (connId: string, username: string, cascade: boolean) =>
    request('DELETE', `/api/users/${connId}/${username}?cascade=${cascade}`)
}

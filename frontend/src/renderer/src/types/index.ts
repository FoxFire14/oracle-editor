export interface ConnectionConfig {
  id: string
  name: string
  host: string
  port: number
  serviceName: string
  username: string
  password: string
  role: 'NORMAL' | 'SYSDBA' | 'SYSOPER'
  connectionType: 'BASIC' | 'TNS' | 'JDBC_URL'
  tnsAlias?: string
  jdbcUrl?: string
  connected?: boolean
}

export interface QueryResult {
  success: boolean
  error?: string
  columns?: string[]
  columnTypes?: string[]
  rows?: Record<string, string | null>[]
  rowsAffected?: number
  executionTimeMs?: number
  statementType?: string
  dbmsOutput?: string
}

export interface SchemaObject {
  OBJECT_NAME: string
  STATUS: string
  LAST_DDL_TIME: string
}

export interface EditorTab {
  id: string
  title: string
  content: string
  connectionId: string | null
  type: 'sql' | 'object' | 'debug'
  debugSessionId?: string
  objectType?: string
  objectOwner?: string
  objectName?: string
  isDirty: boolean
}

export interface TreeNode {
  id: string
  label: string
  type: 'connection' | 'owner' | 'objectType' | 'object' | 'column'
  connectionId?: string
  owner?: string
  objectType?: string
  objectName?: string
  children?: TreeNode[]
  loaded?: boolean
}

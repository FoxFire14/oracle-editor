import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ConnectionConfig, EditorTab, QueryResult, TreeNode } from '../types'

let tabCounter = 1

interface AppState {
  connections: ConnectionConfig[]
  activeConnectionId: string | null
  tabs: EditorTab[]
  activeTabId: string | null
  schemaTrees: Record<string, TreeNode[]>
  queryResults: Record<string, QueryResult>

  setConnections: (conns: ConnectionConfig[]) => void
  addConnection: (conn: ConnectionConfig) => void
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => void
  removeConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void

  addTab: (tab?: Partial<EditorTab>) => string
  updateTab: (id: string, updates: Partial<EditorTab>) => void
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void

  setSchemaTree: (connId: string, nodes: TreeNode[]) => void
  setQueryResult: (tabId: string, result: QueryResult) => void
}

export const useStore = create<AppState>()(persist(
  (set, get) => ({
    connections: [],
    activeConnectionId: null,
    tabs: [],
    activeTabId: null,
    schemaTrees: {},
    queryResults: {},

    setConnections: (conns) => set({ connections: conns }),
    addConnection: (conn) => set((s) => ({ connections: [...s.connections, conn] })),
    updateConnection: (id, updates) =>
      set((s) => ({ connections: s.connections.map((c) => (c.id === id ? { ...c, ...updates } : c)) })),
    removeConnection: (id) =>
      set((s) => ({ connections: s.connections.filter((c) => c.id !== id) })),
    setActiveConnection: (id) => set({ activeConnectionId: id }),

    addTab: (partial = {}) => {
      const id = `tab-${tabCounter++}`
      const tab: EditorTab = {
        id,
        title: partial.title ?? `Query ${tabCounter - 1}`,
        content: partial.content ?? '',
        connectionId: partial.connectionId ?? get().activeConnectionId,
        type: partial.type ?? 'sql',
        isDirty: false,
        ...partial
      }
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }))
      return id
    },
    updateTab: (id, updates) =>
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
    removeTab: (id) =>
      set((s) => {
        const tabs = s.tabs.filter((t) => t.id !== id)
        const activeTabId = s.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? null) : s.activeTabId
        return { tabs, activeTabId }
      }),
    setActiveTab: (id) => set({ activeTabId: id }),

    setSchemaTree: (connId, nodes) =>
      set((s) => ({ schemaTrees: { ...s.schemaTrees, [connId]: nodes } })),
    setQueryResult: (tabId, result) =>
      set((s) => ({ queryResults: { ...s.queryResults, [tabId]: result } }))
  }),
  {
    name: 'oracle-editor-store',
    partialize: (s) => ({
      connections: s.connections.map((c) => ({ ...c, connected: false })),
      activeConnectionId: s.activeConnectionId,
      tabs: s.tabs,
      activeTabId: s.activeTabId,
    })
  }
))

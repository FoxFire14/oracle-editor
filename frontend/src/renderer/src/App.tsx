import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from './store'
import { api } from './api/client'
import { ConnectionPanel } from './components/ConnectionPanel/ConnectionPanel'
import { SchemaBrowser } from './components/SchemaBrowser/SchemaBrowser'
import { SqlEditor, type SqlEditorHandle } from './components/Editor/SqlEditor'
import { ResultsGrid } from './components/ResultsGrid/ResultsGrid'
import { ObjectEditor } from './components/ObjectEditor/ObjectEditor'
import { DebugPanel } from './components/DebugPanel/DebugPanel'
import type { QueryResult } from './types'
import styles from './App.module.css'

type SidebarTab = 'connections' | 'schema'

export default function App(): React.JSX.Element {
  const { tabs, activeTabId, activeConnectionId, addTab, updateTab, removeTab, setActiveTab, setQueryResult, queryResults } = useStore()
  const [sidebar, setSidebar] = useState<SidebarTab>('connections')
  const [loadingQuery, setLoadingQuery] = useState(false)
  const editorRef = useRef<SqlEditorHandle>(null)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null

  // Re-register all saved connections with the Java backend on startup
  useEffect(() => {
    const { connections, updateConnection } = useStore.getState()
    // Mark all as disconnected (backend just started fresh)
    connections.forEach((c) => updateConnection(c.id, { connected: false }))
    if (connections.length === 0) return
    // Small delay to let the Java backend finish starting
    const timer = setTimeout(async () => {
      for (const conn of connections) {
        await api.createConnection(conn).catch(() => {})
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  const handleNewTab = useCallback((): void => {
    addTab()
  }, [addTab])

  const handleExecute = useCallback(async (sql?: string): Promise<void> => {
    if (!activeTab || activeTab.type !== 'sql') return
    const connId = activeTab.connectionId ?? activeConnectionId
    if (!connId) return

    // sql comes from the editor (statement at cursor); Run button uses ref
    const toRun = sql ?? editorRef.current?.getStatementAtCursor() ?? activeTab.content
    if (!toRun.trim()) return

    setLoadingQuery(true)
    try {
      const result = await api.executeQuery(connId, toRun) as QueryResult
      setQueryResult(activeTab.id, result)
    } finally {
      setLoadingQuery(false)
    }
  }, [activeTab, activeConnectionId, setQueryResult])

  return (
    <div className={styles.app}>
      {/* Title bar drag region */}
      <div className={styles.titleBar}>
        <span className={styles.appName}>Oracle Editor</span>
      </div>

      <div className={styles.body}>
        {/* Left sidebar icon rail */}
        <div className={styles.rail}>
          <button
            className={`${styles.railBtn} ${sidebar === 'connections' ? styles.railActive : ''}`}
            onClick={() => setSidebar('connections')}
            title="Connections"
          >⚡</button>
          <button
            className={`${styles.railBtn} ${sidebar === 'schema' ? styles.railActive : ''}`}
            onClick={() => setSidebar('schema')}
            title="Schema Browser"
          >⊞</button>
        </div>

        {/* Sidebar panel */}
        <div className={styles.sidebar}>
          {sidebar === 'connections' && <ConnectionPanel />}
          {sidebar === 'schema' && <SchemaBrowser />}
        </div>

        {/* Main editor area */}
        <div className={styles.main}>
          {/* Tab bar */}
          <div className={styles.tabBar}>
            <div className={styles.tabList}>
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`${styles.tabItem} ${tab.id === activeTabId ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className={styles.tabIcon}>{tab.type === 'object' ? '▤' : tab.type === 'debug' ? '🐛' : '⊡'}</span>
                  <span className={styles.tabTitle}>{tab.title}{tab.isDirty ? ' •' : ''}</span>
                  <button
                    className={styles.tabClose}
                    onClick={(e) => { e.stopPropagation(); removeTab(tab.id) }}
                  >✕</button>
                </div>
              ))}
            </div>
            <button className={styles.newTabBtn} onClick={handleNewTab} title="New Query">+</button>
            <button className={styles.debugTabBtn} onClick={() => addTab({ title: 'Debug', type: 'debug', content: '' })} title="New Debug Session">🐛</button>
          </div>

          {/* Editor + results split */}
          {activeTab ? (
            <div className={styles.editorArea}>
              {activeTab.type === 'sql' ? (
                <>
                  <div className={styles.editorPane}>
                    <div className={styles.editorToolbar}>
                      <select
                        className={styles.connSelect}
                        value={activeTab.connectionId ?? ''}
                        onChange={(e) => updateTab(activeTab.id, { connectionId: e.target.value || null })}
                      >
                        <option value="">— no connection —</option>
                        {useStore.getState().connections.filter((c) => c.connected).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button className={styles.runBtn} onClick={handleExecute} disabled={loadingQuery}>
                        {loadingQuery ? '⟳' : '▶'} Run
                      </button>
                      <span className={styles.shortcut}>⌘↵</span>
                    </div>
                    <SqlEditor
                      ref={editorRef}
                      value={activeTab.content}
                      onChange={(v) => updateTab(activeTab.id, { content: v, isDirty: true })}
                      onExecute={handleExecute}
                    />
                  </div>
                  <div className={styles.resultsPane}>
                    <ResultsGrid result={queryResults[activeTab.id] ?? null} isLoading={loadingQuery} />
                  </div>
                </>
              ) : activeTab.type === 'debug' ? (
                <DebugPanel
                  tab={activeTab}
                  onUpdateTab={(updates) => updateTab(activeTab.id, updates)}
                />
              ) : (
                <ObjectEditor
                  tab={activeTab}
                  onContentChange={(v) => updateTab(activeTab.id, { content: v, isDirty: true })}
                />
              )}
            </div>
          ) : (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>⚡</div>
              <h2>Oracle Editor</h2>
              <p>Connect to a database and open a new query tab to get started.</p>
              <button className={styles.welcomeBtn} onClick={handleNewTab}>New Query</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

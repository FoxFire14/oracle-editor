import React, { useState, useRef, useCallback } from 'react'
import { api } from '../../api/client'
import { useStore } from '../../store'
import { SqlEditor, type SqlEditorHandle } from '../Editor/SqlEditor'
import { ResultsGrid } from '../ResultsGrid/ResultsGrid'
import { TestBuilder } from './TestBuilder'
import type { EditorTab, QueryResult } from '../../types'
import styles from './DebugPanel.module.css'

interface LogEntry {
  sql: string
  success: boolean
  message?: string
  ms: number
  result?: QueryResult
}

interface Props {
  tab: EditorTab
  onUpdateTab: (updates: Partial<EditorTab>) => void
}

export function DebugPanel({ tab, onUpdateTab }: Props): React.JSX.Element {
  const { connections, activeConnectionId, updateTab } = useStore()
  const [connId, setConnId] = useState(tab.connectionId ?? activeConnectionId ?? '')
  const [sessionId, setSessionId] = useState(tab.debugSessionId ?? '')
  const [showBuilder, setShowBuilder] = useState(true)
  const [starting, setStarting] = useState(false)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [lastResult, setLastResult] = useState<QueryResult | null>(null)
  const [sql, setSql] = useState(tab.content || '')
  const [startError, setStartError] = useState('')
  const editorRef = useRef<SqlEditorHandle>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const activeConns = connections.filter((c) => c.connected)

  const scrollLog = (): void => {
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const handleStart = async (): Promise<void> => {
    if (!connId) return
    setStarting(true)
    setStartError('')
    try {
      const res = await api.startDebugSession(connId) as { sessionId: string; success: boolean; error?: string }
      if (!res.success) { setStartError(res.error ?? 'Failed to start'); return }
      setSessionId(res.sessionId)
      onUpdateTab({ debugSessionId: res.sessionId, connectionId: connId })
      setLog([])
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : 'Failed to start session')
    } finally {
      setStarting(false)
    }
  }

  const handleExecute = useCallback(async (stmt?: string): Promise<void> => {
    if (!sessionId) return
    const toRun = stmt ?? editorRef.current?.getStatementAtCursor() ?? sql
    if (!toRun.trim()) return
    setRunning(true)
    try {
      const result = await api.debugExecute(sessionId, toRun) as QueryResult
      const entry: LogEntry = { sql: toRun, success: result.success, message: result.error, ms: result.executionTimeMs ?? 0, result }
      setLog((prev) => [...prev, entry])
      setLastResult(result)
      scrollLog()
    } finally {
      setRunning(false)
    }
  }, [sessionId, sql])

  const handleCommit = async (): Promise<void> => {
    if (!sessionId) return
    await api.debugCommit(sessionId)
    setLog((prev) => [...prev, { sql: 'COMMIT', success: true, ms: 0 }])
    scrollLog()
  }

  const handleRollback = async (): Promise<void> => {
    if (!sessionId) return
    await api.debugRollback(sessionId)
    setLog((prev) => [...prev, { sql: 'ROLLBACK', success: true, ms: 0 }])
    scrollLog()
  }

  const handleClose = async (): Promise<void> => {
    if (sessionId) await api.debugClose(sessionId)
    setSessionId('')
    onUpdateTab({ debugSessionId: undefined })
    setLog([])
    setLastResult(null)
  }

  const isActive = !!sessionId

  return (
    <div className={styles.wrap}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span className={`${styles.badge} ${isActive ? styles.badgeActive : ''}`}>
          {isActive ? '⬤ DEBUG' : '○ DEBUG'}
        </span>

        {!isActive ? (
          <>
            <select className={styles.connSelect} value={connId} onChange={(e) => setConnId(e.target.value)}>
              <option value="">— select connection —</option>
              {activeConns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className={styles.startBtn} onClick={handleStart} disabled={starting || !connId}>
              {starting ? 'Starting…' : '▶ Start Session'}
            </button>
            {startError && <span className={styles.err}>{startError}</span>}
          </>
        ) : (
          <>
            <span className={styles.sessionId} title={sessionId}>
              Session: {sessionId.slice(0, 8)}…
            </span>
            <button className={styles.runBtn} onClick={() => handleExecute()} disabled={running}>
              {running ? '⟳' : '▶'} Run
            </button>
            <button className={styles.commitBtn} onClick={handleCommit}>COMMIT</button>
            <button className={styles.rollbackBtn} onClick={handleRollback}>ROLLBACK</button>
            <button
              className={`${styles.builderToggle} ${showBuilder ? styles.builderToggleActive : ''}`}
              onClick={() => setShowBuilder(v => !v)}
            >⚙ Builder</button>
            <button className={styles.closeBtn} onClick={handleClose}>✕ End Session</button>
          </>
        )}
      </div>

      <div className={styles.body}>
        {/* Editor */}
        <div className={styles.editorPane}>
          {isActive && showBuilder && (
            <TestBuilder
              connectionId={connId || null}
              onGenerate={(generated) => {
                setSql(generated)
                onUpdateTab({ content: generated })
              }}
              onGenerateAndRun={(generated) => {
                setSql(generated)
                onUpdateTab({ content: generated })
                handleExecute(generated)
              }}
            />
          )}
          <SqlEditor
            ref={editorRef}
            value={sql}
            onChange={(v) => { setSql(v); onUpdateTab({ content: v }) }}
            onExecute={handleExecute}
            readOnly={!isActive}
          />
        </div>

        {/* Right panel: results + log */}
        <div className={styles.rightPane}>
          <div className={styles.results}>
            <ResultsGrid result={lastResult} isLoading={running} />
          </div>

          <div className={styles.log}>
            <div className={styles.logHeader}>Execution Log</div>
            {log.length === 0 && (
              <div className={styles.logEmpty}>No statements executed yet.</div>
            )}
            {log.map((entry, i) => (
              <div key={i}>
                <div className={`${styles.logEntry} ${entry.success ? styles.logOk : styles.logErr}`}>
                  <span className={styles.logIcon}>{entry.success ? '✓' : '✕'}</span>
                  <span className={styles.logSql}>{entry.sql.length > 80 ? entry.sql.slice(0, 80) + '…' : entry.sql}</span>
                  <span className={styles.logMeta}>
                    {entry.ms > 0 && `${entry.ms}ms`}
                    {entry.result?.rows && ` · ${entry.result.rows.length} rows`}
                    {entry.result?.rowsAffected != null && entry.result.rowsAffected > 0 && ` · ${entry.result.rowsAffected} affected`}
                    {entry.message && ` · ${entry.message}`}
                  </span>
                </div>
                {entry.result?.dbmsOutput && (
                  <pre className={styles.dbmsOutput}>{entry.result.dbmsOutput}</pre>
                )}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}

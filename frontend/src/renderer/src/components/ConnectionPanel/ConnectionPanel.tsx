import React, { useState } from 'react'
import { api } from '../../api/client'
import { useStore } from '../../store'
import type { ConnectionConfig } from '../../types'
import styles from './ConnectionPanel.module.css'

const EMPTY: Omit<ConnectionConfig, 'id' | 'connected'> = {
  name: '',
  host: '',
  port: 1521,
  serviceName: '',
  username: '',
  password: '',
  role: 'NORMAL',
  connectionType: 'BASIC',
  dbType: 'ORACLE'
}

export function ConnectionPanel(): React.JSX.Element {
  const { connections, activeConnectionId, addConnection, updateConnection, removeConnection, setActiveConnection } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [connectErrors, setConnectErrors] = useState<Record<string, string>>({})
  const [connecting, setConnecting] = useState<Record<string, boolean>>({})

  const openNew = (): void => {
    setEditingId(null)
    setForm({ ...EMPTY })
    setError('')
    setShowForm(true)
  }

  const openEdit = (conn: ConnectionConfig): void => {
    setEditingId(conn.id)
    setForm({ name: conn.name, host: conn.host, port: conn.port, serviceName: conn.serviceName,
      username: conn.username, password: conn.password, role: conn.role,
      connectionType: conn.connectionType, dbType: conn.dbType ?? 'ORACLE',
      tnsAlias: conn.tnsAlias, jdbcUrl: conn.jdbcUrl })
    setError('')
    setShowForm(true)
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        // Update existing
        const updated: ConnectionConfig = { ...form, id: editingId, connected: connections.find(c => c.id === editingId)?.connected ?? false }
        await api.createConnection(updated)
        updateConnection(editingId, form)
      } else {
        const res = await api.createConnection(form) as { id: string; success: boolean }
        const newConn: ConnectionConfig = { ...form, id: res.id, connected: false }
        addConnection(newConn)
      }
      setShowForm(false)
      setForm({ ...EMPTY })
      setEditingId(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleConnect = async (id: string): Promise<void> => {
    setConnectErrors((prev) => ({ ...prev, [id]: '' }))
    setConnecting((prev) => ({ ...prev, [id]: true }))
    try {
      const conn = connections.find((c) => c.id === id)
      if (conn) await api.createConnection(conn)

      const res = await api.connect(id) as { success: boolean; error?: string }
      if (res.success) {
        updateConnection(id, { connected: true })
        setActiveConnection(id)
      } else {
        updateConnection(id, { connected: false })
        setConnectErrors((prev) => ({ ...prev, [id]: res.error ?? 'Connection failed' }))
      }
    } catch (e: unknown) {
      updateConnection(id, { connected: false })
      setConnectErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : 'Connection failed' }))
    } finally {
      setConnecting((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleDisconnect = async (id: string): Promise<void> => {
    await api.disconnect(id)
    updateConnection(id, { connected: false })
    if (activeConnectionId === id) setActiveConnection(null)
  }

  const handleDelete = async (id: string): Promise<void> => {
    await api.deleteConnection(id)
    removeConnection(id)
    if (activeConnectionId === id) setActiveConnection(null)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Connections</span>
        <button className={styles.addBtn} onClick={openNew} title="New connection">+</button>
      </div>

      <div className={styles.list}>
        {connections.map((conn) => (
          <div
            key={conn.id}
            className={`${styles.connItem} ${activeConnectionId === conn.id ? styles.active : ''}`}
            onClick={() => setActiveConnection(conn.id)}
          >
            <span className={`${styles.dot} ${conn.connected ? styles.dotGreen : styles.dotGrey}`} />
            <span className={styles.connName}>{conn.name}</span>
            <span className={styles.connSub}>{conn.username}@{conn.host}</span>
            <div className={styles.connActions}>
              {conn.connected ? (
                <button onClick={(e) => { e.stopPropagation(); handleDisconnect(conn.id) }} title="Disconnect">⏹</button>
              ) : connecting[conn.id] ? (
                <button disabled className={styles.spinning} title="Connecting…">⟳</button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); handleConnect(conn.id) }} title="Connect">▶</button>
              )}
              <button onClick={(e) => { e.stopPropagation(); openEdit(conn) }} title="Edit connection">✎</button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(conn.id) }} title="Delete">✕</button>
            </div>
            {connectErrors[conn.id] && (
              <div className={styles.connError} onClick={(e) => e.stopPropagation()}>
                {connectErrors[conn.id]}
              </div>
            )}
          </div>
        ))}
        {connections.length === 0 && (
          <div className={styles.empty}>No connections yet</div>
        )}
      </div>

      {showForm && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>{editingId ? 'Edit Connection' : 'New Connection'}</h3>
              <button onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className={styles.formGrid}>
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Oracle DB" />

              <label>Database</label>
              <select value={form.dbType ?? 'ORACLE'} onChange={(e) => setForm({ ...form, dbType: e.target.value as ConnectionConfig['dbType'], port: e.target.value === 'POSTGRES' ? 5432 : 1521 })}>
                <option value="ORACLE">Oracle</option>
                <option value="POSTGRES">PostgreSQL</option>
              </select>

              <label>Connection</label>
              <select value={form.connectionType} onChange={(e) => setForm({ ...form, connectionType: e.target.value as ConnectionConfig['connectionType'] })}>
                <option value="BASIC">Basic (Host/Port/Service)</option>
                {form.dbType !== 'POSTGRES' && <option value="TNS">TNS Alias</option>}
                <option value="JDBC_URL">JDBC URL</option>
              </select>

              {form.connectionType === 'BASIC' && <>
                <label>Host</label>
                <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="localhost" />
                <label>Port</label>
                <input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
                <label>{form.dbType === 'POSTGRES' ? 'Database' : 'Service Name'}</label>
                <input value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} placeholder={form.dbType === 'POSTGRES' ? 'postgres' : 'ORCL'} />
              </>}

              {form.connectionType === 'TNS' && <>
                <label>TNS Alias</label>
                <input value={form.tnsAlias ?? ''} onChange={(e) => setForm({ ...form, tnsAlias: e.target.value })} placeholder="MYDB" />
              </>}

              {form.connectionType === 'JDBC_URL' && <>
                <label>JDBC URL</label>
                <input value={form.jdbcUrl ?? ''} onChange={(e) => setForm({ ...form, jdbcUrl: e.target.value })} placeholder={form.dbType === 'POSTGRES' ? 'jdbc:postgresql://localhost:5432/mydb' : 'jdbc:oracle:thin:@...'} />
              </>}

              <label>Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <label>Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              {form.dbType !== 'POSTGRES' && <>
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as ConnectionConfig['role'] })}>
                  <option value="NORMAL">Normal</option>
                  <option value="SYSDBA">SYSDBA</option>
                  <option value="SYSOPER">SYSOPER</option>
                </select>
              </>}
            </div>
            {error && <div className={styles.err}>{error}</div>}
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setShowForm(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

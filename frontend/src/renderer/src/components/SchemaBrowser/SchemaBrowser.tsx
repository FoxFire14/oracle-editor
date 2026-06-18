import React, { useState, useCallback } from 'react'
import { api } from '../../api/client'
import { useStore } from '../../store'
import type { QueryResult, TreeNode } from '../../types'
import styles from './SchemaBrowser.module.css'

const TYPE_ICONS: Record<string, string> = {
  TABLE: '⊞', VIEW: '◫', INDEX: '⍿', SEQUENCE: '⋯',
  PROCEDURE: 'ƒ', FUNCTION: 'ƒ', PACKAGE: '▤', 'PACKAGE BODY': '▤',
  TRIGGER: '⚡', TYPE: '◈', SYNONYM: '→', 'MATERIALIZED VIEW': '⊟',
}

function objectIcon(type: string): string {
  return TYPE_ICONS[type] ?? '○'
}

function buildOwnerNode(connId: string, owner: string): TreeNode {
  return {
    id: `${connId}::${owner}`,
    label: owner,
    type: 'owner',
    connectionId: connId,
    owner,
    children: [],
    loaded: false
  }
}

function buildTypeNode(connId: string, owner: string, objType: string): TreeNode {
  return {
    id: `${connId}::${owner}::${objType}`,
    label: `${objectIcon(objType)} ${objType}`,
    type: 'objectType',
    connectionId: connId,
    owner,
    objectType: objType,
    children: [],
    loaded: false
  }
}

function buildObjectNode(connId: string, owner: string, objType: string, name: string): TreeNode {
  return {
    id: `${connId}::${owner}::${objType}::${name}`,
    label: name,
    type: 'object',
    connectionId: connId,
    owner,
    objectType: objType,
    objectName: name,
    children: [],
    loaded: false
  }
}

export function SchemaBrowser(): React.JSX.Element {
  const { connections, activeConnectionId, schemaTrees, setSchemaTree, addTab, setActiveTab } = useStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')

  const connId = activeConnectionId
  const conn = connections.find((c) => c.id === connId)
  const tree = connId ? (schemaTrees[connId] ?? []) : []

  const setLoad = (id: string, on: boolean): void => {
    setLoading((prev) => { const s = new Set(prev); on ? s.add(id) : s.delete(id); return s })
  }

  const loadOwners = useCallback(async (): Promise<void> => {
    if (!connId || !conn?.connected) return
    // Clear expanded state and cached tree so everything reloads fresh
    setExpanded(new Set())
    setSchemaTree(connId, [])
    setLoad(connId, true)
    try {
      const res = await api.getOwners(connId) as QueryResult
      if (res.rows) {
        const nodes = res.rows.map((r) => buildOwnerNode(connId, r['OWNER'] as string))
        setSchemaTree(connId, nodes)
      }
    } finally {
      setLoad(connId, false)
    }
  }, [connId, conn?.connected, setSchemaTree])

  const toggleNode = useCallback(async (node: TreeNode): Promise<void> => {
    const id = node.id
    const isOpen = expanded.has(id)

    if (isOpen) {
      setExpanded((prev) => { const s = new Set(prev); s.delete(id); return s })
      return
    }

    setExpanded((prev) => new Set([...prev, id]))

    if (node.type === 'connection' || node.type === 'owner') {
      // Load object types under this owner
      if (!node.connectionId || !node.owner) return
      setLoad(id, true)
      try {
        const res = await api.getObjectTypes(node.connectionId, node.owner) as QueryResult
        if (res.rows) {
          const typeNodes = res.rows.map((r) =>
            buildTypeNode(node.connectionId!, node.owner!, r['OBJECT_TYPE'] as string)
          )
          // Update tree
          setSchemaTree(node.connectionId, updateNodeChildren(schemaTrees[node.connectionId] ?? [], id, typeNodes))
        }
      } finally {
        setLoad(id, false)
      }
    } else if (node.type === 'objectType') {
      if (!node.connectionId || !node.owner || !node.objectType) return
      setLoad(id, true)
      try {
        const res = await api.getObjects(node.connectionId, node.owner, node.objectType) as QueryResult
        if (res.rows) {
          const objNodes = res.rows.map((r) =>
            buildObjectNode(node.connectionId!, node.owner!, node.objectType!, r['OBJECT_NAME'] as string)
          )
          setSchemaTree(node.connectionId, updateNodeChildren(schemaTrees[node.connectionId] ?? [], id, objNodes))
        }
      } finally {
        setLoad(id, false)
      }
    } else if (node.type === 'object' && node.objectType === 'TABLE') {
      if (!node.connectionId || !node.owner || !node.objectName) return
      setLoad(id, true)
      try {
        const res = await api.getColumns(node.connectionId, node.owner, node.objectName) as QueryResult
        if (res.rows) {
          const colNodes: TreeNode[] = res.rows.map((r) => ({
            id: `${id}::col::${r['COLUMN_NAME']}`,
            label: `${r['COLUMN_NAME']} — ${r['DATA_TYPE']}${r['NULLABLE'] === 'Y' ? '' : ' NOT NULL'}`,
            type: 'column' as const,
            connectionId: node.connectionId,
          }))
          setSchemaTree(node.connectionId!, updateNodeChildren(schemaTrees[node.connectionId!] ?? [], id, colNodes))
        }
      } finally {
        setLoad(id, false)
      }
    }
  }, [expanded, schemaTrees, setSchemaTree])

  const openObject = useCallback((node: TreeNode): void => {
    if (node.type !== 'object') return
    const { connectionId, owner, objectType, objectName } = node
    if (!connectionId || !owner || !objectType || !objectName) return

    if (objectType === 'TABLE' || objectType === 'VIEW') {
      const tabId = addTab({
        title: objectName,
        content: `SELECT * FROM "${owner}"."${objectName}" FETCH FIRST 200 ROWS ONLY;`,
        connectionId,
        type: 'sql'
      })
      setActiveTab(tabId)
    } else {
      const tabId = addTab({
        title: `${objectName} (${objectType})`,
        content: '',
        connectionId,
        type: 'object',
        objectType,
        objectOwner: owner,
        objectName
      })
      setActiveTab(tabId)
    }
  }, [addTab, setActiveTab])

  function updateNodeChildren(nodes: TreeNode[], targetId: string, children: TreeNode[]): TreeNode[] {
    return nodes.map((n) => {
      if (n.id === targetId) return { ...n, children, loaded: true }
      if (n.children) return { ...n, children: updateNodeChildren(n.children, targetId, children) }
      return n
    })
  }

  function filterNodes(nodes: TreeNode[], q: string): TreeNode[] {
    if (!q) return nodes
    return nodes.reduce<TreeNode[]>((acc, n) => {
      if (n.label.toLowerCase().includes(q)) {
        acc.push(n)
      } else if (n.children) {
        const filtered = filterNodes(n.children, q)
        if (filtered.length) acc.push({ ...n, children: filtered })
      }
      return acc
    }, [])
  }

  function renderNode(node: TreeNode, depth = 0): React.ReactNode {
    const isOpen = expanded.has(node.id)
    const isLoading = loading.has(node.id)
    const hasChildren = node.type !== 'column'
    const indent = depth * 14

    return (
      <div key={node.id}>
        <div
          className={`${styles.node} ${node.type === 'object' ? styles.nodeObject : ''}`}
          style={{ paddingLeft: 8 + indent }}
          onClick={() => hasChildren ? toggleNode(node) : undefined}
          onDoubleClick={() => openObject(node)}
          title={node.type === 'object' ? 'Double-click to open' : undefined}
        >
          {hasChildren && (
            <span className={styles.arrow}>{isLoading ? '⟳' : isOpen ? '▾' : '▸'}</span>
          )}
          {!hasChildren && <span className={styles.arrowPlaceholder} />}
          <span className={styles.label}>{node.label}</span>
        </div>
        {isOpen && node.children && node.children.length > 0 && (
          <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  const filtered = filterNodes(tree, filter.toLowerCase())

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Schema</span>
        {conn?.connected && (
          <button className={styles.refreshBtn} onClick={loadOwners} title="Refresh">↺</button>
        )}
      </div>

      {tree.length === 0 && conn?.connected && (
        <button className={styles.loadBtn} onClick={loadOwners}>Load Schema</button>
      )}

      {!conn?.connected && (
        <div className={styles.hint}>Connect to a database to browse its schema.</div>
      )}

      {tree.length > 0 && (
        <div className={styles.filterWrap}>
          <input
            className={styles.filter}
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      )}

      <div className={styles.tree}>
        {filtered.map((n) => renderNode(n))}
      </div>
    </div>
  )
}

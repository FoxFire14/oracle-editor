import React, { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../api/client'
import type { QueryResult } from '../../types'
import styles from './TestBuilder.module.css'

interface CallableObject {
  name: string
  type: 'FUNCTION' | 'PROCEDURE' | 'PACKAGE_MEMBER'
  packageName?: string
  // resolved after loading params (position 0 = function)
  resolvedType?: 'FUNCTION' | 'PROCEDURE'
}

interface Param {
  id: string
  name: string
  direction: 'IN' | 'OUT' | 'IN OUT'
  dataType: string
  value: string
}

interface Props {
  connectionId: string | null
  onGenerate: (sql: string) => void
  onGenerateAndRun: (sql: string) => void
}

function formatValue(value: string, dataType: string): string {
  if (!value.trim()) return 'NULL'
  if (['NUMBER', 'INTEGER', 'FLOAT', 'BINARY_INTEGER', 'PLS_INTEGER'].includes(dataType)) return value
  if (dataType === 'BOOLEAN') return value.toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE'
  if (dataType === 'DATE') return `TO_DATE('${value}', 'YYYY-MM-DD')`
  if (dataType === 'TIMESTAMP') return `TO_TIMESTAMP('${value}', 'YYYY-MM-DD HH24:MI:SS')`
  return `'${value.replace(/'/g, "''")}'`
}

function generateBlock(
  objectName: string,
  objectType: 'FUNCTION' | 'PROCEDURE',
  returnType: string,
  params: Param[]
): string {
  const lines: string[] = []
  const hasVars = params.length > 0 || objectType === 'FUNCTION'
  if (hasVars) lines.push('DECLARE')
  for (const p of params) {
    let decl = `  ${p.name} ${p.dataType}`
    if (p.direction !== 'OUT' && p.value.trim()) {
      decl += ` := ${formatValue(p.value, p.dataType)}`
    }
    lines.push(decl + ';')
  }
  if (objectType === 'FUNCTION') lines.push(`  v_return ${returnType || 'VARCHAR2'};`)
  lines.push('BEGIN')
  const args = params.map(p => p.name).join(', ')
  if (objectType === 'FUNCTION') {
    lines.push(`  v_return := ${objectName}(${args});`)
    lines.push(`  DBMS_OUTPUT.PUT_LINE('[RETURN] = ' || TO_CHAR(v_return));`)
  } else {
    lines.push(`  ${objectName}(${args});`)
  }
  for (const p of params.filter(p => p.direction === 'OUT' || p.direction === 'IN OUT')) {
    lines.push(`  DBMS_OUTPUT.PUT_LINE('[${p.name}] = ' || TO_CHAR(${p.name}));`)
  }
  lines.push('END;')
  lines.push('/')
  return lines.join('\n')
}

let idSeq = 1

export function TestBuilder({ connectionId, onGenerate, onGenerateAndRun }: Props): React.JSX.Element {
  const [objects, setObjects] = useState<CallableObject[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<CallableObject | null>(null)
  const [params, setParams] = useState<Param[]>([])
  const [returnType, setReturnType] = useState('VARCHAR2')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load callable objects when connection changes
  useEffect(() => {
    if (!connectionId) { setObjects([]); return }
    api.getCallableObjects(connectionId).then(res => {
      const r = res as QueryResult
      if (r.rows) {
        setObjects(r.rows.map(row => ({
          name: row['NAME'] as string,
          type: row['TYPE'] as CallableObject['type'],
          packageName: row['PACKAGE_NAME'] as string | undefined || undefined,
        })))
      }
    }).catch(() => {})
  }, [connectionId])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (!dropdownRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayName = (o: CallableObject): string =>
    o.packageName ? `${o.packageName}.${o.name}` : o.name

  const filtered = objects.filter(o =>
    displayName(o).toLowerCase().includes(search.toLowerCase())
  )

  const selectObject = useCallback(async (obj: CallableObject) => {
    setSelected(obj)
    setSearch(displayName(obj))
    setOpen(false)
    setParams([])
    if (!connectionId) return
    setLoading(true)
    try {
      const res = await api.getCallableParams(connectionId, obj.name, obj.packageName) as QueryResult
      if (res.rows) {
        const ret = res.rows.find(r => Number(r['POSITION']) === 0)
        const isFunction = !!ret
        if (ret) setReturnType(ret['DATA_TYPE'] as string || 'VARCHAR2')
        // Update resolvedType based on whether position 0 exists
        setSelected(prev => prev ? { ...prev, resolvedType: isFunction ? 'FUNCTION' : 'PROCEDURE' } : prev)
        setParams(
          res.rows
            .filter(r => Number(r['POSITION']) > 0)
            .map(r => ({
              id: String(idSeq++),
              name: r['ARGUMENT_NAME'] as string,
              direction: (r['IN_OUT'] as string) as 'IN' | 'OUT' | 'IN OUT',
              dataType: r['DATA_TYPE'] as string,
              value: ''
            }))
        )
      }
    } finally {
      setLoading(false)
    }
  }, [connectionId])

  const updateValue = (id: string, value: string): void =>
    setParams(prev => prev.map(p => p.id === id ? { ...p, value } : p))

  const build = (): string => {
    const callName = selected
      ? (selected.packageName ? `${selected.packageName}.${selected.name}` : selected.name)
      : search.trim()
    const objType = selected?.resolvedType ?? (selected?.type === 'FUNCTION' ? 'FUNCTION' : 'PROCEDURE')
    return generateBlock(callName, objType, returnType, params)
  }

  const canRun = !!(selected || search.trim()) && connectionId

  return (
    <div className={styles.wrap}>
      {/* Object picker */}
      <div className={styles.pickerRow}>
        <div className={styles.comboWrap} ref={dropdownRef}>
          <div className={styles.comboInner}>
            {selected && (() => {
              const rt = selected.resolvedType ?? selected.type
              return (
                <span className={`${styles.typePill} ${rt === 'FUNCTION' ? styles.fn : selected.type === 'PACKAGE_MEMBER' ? styles.pkg : styles.proc}`}>
                  {rt === 'FUNCTION' ? 'FN' : selected.type === 'PACKAGE_MEMBER' ? 'PKG' : 'PR'}
                </span>
              )
            })()}
            <input
              ref={inputRef}
              className={styles.comboInput}
              placeholder={connectionId ? 'Search function / procedure…' : 'Start a debug session first'}
              value={search}
              disabled={!connectionId}
              onChange={e => { setSearch(e.target.value); setOpen(true); setSelected(null) }}
              onFocus={() => setOpen(true)}
            />
            {search && (
              <button className={styles.clearBtn} onClick={() => {
                setSearch(''); setSelected(null); setParams([]); inputRef.current?.focus()
              }}>✕</button>
            )}
          </div>
          {open && filtered.length > 0 && (
            <div className={styles.dropdown}>
              {filtered.slice(0, 60).map(obj => (
                <button
                  key={(obj.packageName ?? '') + obj.name}
                  className={`${styles.dropItem} ${selected && displayName(selected) === displayName(obj) ? styles.dropItemActive : ''}`}
                  onMouseDown={e => { e.preventDefault(); selectObject(obj) }}
                >
                  <span className={`${styles.typePill} ${obj.type === 'FUNCTION' ? styles.fn : obj.type === 'PACKAGE_MEMBER' ? styles.pkg : styles.proc}`}>
                    {obj.type === 'FUNCTION' ? 'FN' : obj.type === 'PACKAGE_MEMBER' ? 'PKG' : 'PR'}
                  </span>
                  {obj.packageName
                    ? <><span className={styles.pkgPrefix}>{obj.packageName}.</span>{obj.name}</>
                    : obj.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {(selected?.resolvedType === 'FUNCTION' || selected?.type === 'FUNCTION') && (
          <span className={styles.returnLabel}>→ {returnType}</span>
        )}

        <div className={styles.actionBtns}>
          <button className={styles.genBtn} disabled={!canRun} onClick={() => onGenerate(build())}>
            Generate
          </button>
          <button className={styles.runBtn} disabled={!canRun} onClick={() => onGenerateAndRun(build())}>
            ▶ Run
          </button>
        </div>
      </div>

      {/* Parameters */}
      {loading && <div className={styles.loading}>Loading parameters…</div>}
      {!loading && params.length > 0 && (
        <div className={styles.paramsTable}>
          <div className={styles.paramsHeader}>
            <span>Parameter</span>
            <span>Type</span>
            <span>Direction</span>
            <span>Value</span>
          </div>
          {params.map(p => (
            <div key={p.id} className={styles.paramRow}>
              <span className={styles.paramName}>{p.name}</span>
              <span className={styles.paramType}>{p.dataType}</span>
              <span className={`${styles.paramDir} ${p.direction === 'IN' ? styles.dirIn : p.direction === 'OUT' ? styles.dirOut : styles.dirInOut}`}>
                {p.direction}
              </span>
              <input
                className={styles.paramValue}
                placeholder={p.direction === 'OUT' ? '(output)' : `${p.dataType} value`}
                disabled={p.direction === 'OUT'}
                value={p.value}
                onChange={e => updateValue(p.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}
      {!loading && selected && params.length === 0 && (
        <div className={styles.noParams}>No parameters</div>
      )}
    </div>
  )
}

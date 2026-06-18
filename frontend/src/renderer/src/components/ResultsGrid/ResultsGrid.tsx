import React, { useState, useRef } from 'react'
import type { QueryResult } from '../../types'
import styles from './ResultsGrid.module.css'

interface Props {
  result: QueryResult | null
  isLoading: boolean
}

export function ResultsGrid({ result, isLoading }: Props): React.JSX.Element {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const resizing = useRef<{ col: string; startX: number; startW: number } | null>(null)

  if (isLoading) {
    return <div className={styles.status}>Executing…</div>
  }

  if (!result) {
    return <div className={styles.status}>Run a query to see results (⌘↵)</div>
  }

  if (!result.success) {
    return (
      <div className={styles.error}>
        <span className={styles.errorIcon}>✕</span>
        <pre>{result.error}</pre>
      </div>
    )
  }

  if (!result.columns || result.columns.length === 0) {
    return (
      <div className={styles.dml}>
        <span className={styles.dmlIcon}>✓</span>
        <div>
          <div>{result.statementType} completed</div>
          <div className={styles.dmlSub}>
            {result.rowsAffected ?? 0} row{result.rowsAffected !== 1 ? 's' : ''} affected
            {result.executionTimeMs != null && ` · ${result.executionTimeMs}ms`}
          </div>
        </div>
      </div>
    )
  }

  const rows = result.rows ?? []
  const columns = result.columns

  const sorted = sortCol
    ? [...rows].sort((a, b) => {
        const av = a[sortCol] ?? ''
        const bv = b[sortCol] ?? ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : rows

  const toggleSort = (col: string): void => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const startResize = (col: string, e: React.MouseEvent): void => {
    e.preventDefault()
    const startW = colWidths[col] ?? 120
    resizing.current = { col, startX: e.clientX, startW }
    const onMove = (ev: MouseEvent): void => {
      if (!resizing.current) return
      const delta = ev.clientX - resizing.current.startX
      setColWidths((prev) => ({ ...prev, [resizing.current!.col]: Math.max(60, resizing.current!.startW + delta) }))
    }
    const onUp = (): void => {
      resizing.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const copyTsv = (): void => {
    const header = columns.join('\t')
    const body = rows.map((r) => columns.map((c) => r[c] ?? '').join('\t')).join('\n')
    navigator.clipboard.writeText(header + '\n' + body)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.meta}>
          {rows.length} row{rows.length !== 1 ? 's' : ''}
          {result.executionTimeMs != null && ` · ${result.executionTimeMs}ms`}
        </span>
        <button className={styles.copyBtn} onClick={copyTsv} title="Copy as TSV">⎘ Copy</button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.rowNum}></th>
              {columns.map((col) => (
                <th
                  key={col}
                  style={{ width: colWidths[col] ?? 120, minWidth: colWidths[col] ?? 60 }}
                  className={styles.th}
                  onClick={() => toggleSort(col)}
                >
                  <span className={styles.colLabel}>{col}</span>
                  {sortCol === col && <span className={styles.sortIcon}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  <div className={styles.resizeHandle} onMouseDown={(e) => startResize(col, e)} onClick={(e) => e.stopPropagation()} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                <td className={styles.rowNum}>{i + 1}</td>
                {columns.map((col) => {
                  const val = row[col]
                  return (
                    <td key={col} className={`${styles.cell} ${val === null ? styles.nullCell : ''}`}
                        title={val ?? ''}>
                      {val === null ? <span className={styles.null}>NULL</span> : val}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

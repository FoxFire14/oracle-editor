import React, { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { EditorTab, QueryResult } from '../../types'
import { SqlEditor } from '../Editor/SqlEditor'
import styles from './ObjectEditor.module.css'

interface Props {
  tab: EditorTab
  onContentChange: (content: string) => void
}

interface CompileError {
  LINE: string
  POSITION: string
  TEXT: string
  ATTRIBUTE: string
}

export function ObjectEditor({ tab, onContentChange }: Props): React.JSX.Element {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<CompileError[]>([])
  const [saveMsg, setSaveMsg] = useState('')
  const [activeSection, setActiveSection] = useState<'spec' | 'body'>('spec')
  const [bodyContent, setBodyContent] = useState('')

  const isPackage = tab.objectType === 'PACKAGE' || tab.objectType === 'PACKAGE BODY'

  useEffect(() => {
    if (!tab.connectionId || !tab.objectOwner || !tab.objectType || !tab.objectName) return
    loadSource()
  }, [tab.objectName, tab.objectType, tab.objectOwner, tab.connectionId])

  const loadSource = async (): Promise<void> => {
    if (!tab.connectionId || !tab.objectOwner || !tab.objectType || !tab.objectName) return
    setLoading(true)
    try {
      if (isPackage) {
        const res = await api.getPackage(tab.connectionId, tab.objectOwner, tab.objectName) as
          { spec: QueryResult; body: QueryResult }
        onContentChange(joinSource(res.spec))
        setBodyContent(joinSource(res.body))
      } else {
        const res = await api.getObjectSource(tab.connectionId, tab.objectOwner, tab.objectType, tab.objectName) as QueryResult
        onContentChange(joinSource(res))
      }
    } finally {
      setLoading(false)
    }
  }

  const joinSource = (res: QueryResult): string => {
    if (!res.rows) return ''
    return res.rows.map((r) => r['TEXT'] ?? '').join('')
  }

  const handleSave = async (): Promise<void> => {
    if (!tab.connectionId) return
    setErrors([])
    setSaveMsg('')

    const saveSource = async (source: string, typeLabel: string): Promise<boolean> => {
      const res = await api.saveObject({
        connectionId: tab.connectionId,
        owner: tab.objectOwner,
        type: tab.objectType,
        name: tab.objectName,
        source
      }) as QueryResult

      if (!res.success) {
        setSaveMsg(`Error in ${typeLabel}: ${res.error}`)
        return false
      }

      // Fetch compile errors
      const errRes = await api.getObjectErrors(
        tab.connectionId!, tab.objectOwner!, tab.objectType!, tab.objectName!
      ) as QueryResult
      if (errRes.rows && errRes.rows.length > 0) {
        setErrors(errRes.rows as unknown as CompileError[])
        setSaveMsg(`${typeLabel} compiled with errors`)
        return false
      }
      return true
    }

    if (isPackage) {
      const specOk = await saveSource(tab.content, 'Package Spec')
      if (specOk) {
        const bodyOk = await saveSource(bodyContent, 'Package Body')
        if (bodyOk) setSaveMsg('Package compiled successfully')
      }
    } else {
      const ok = await saveSource(tab.content, tab.objectType ?? 'Object')
      if (ok) setSaveMsg('Compiled successfully')
    }
  }

  const currentContent = isPackage && activeSection === 'body' ? bodyContent : tab.content
  const handleChange = isPackage && activeSection === 'body'
    ? setBodyContent
    : onContentChange

  if (loading) {
    return <div className={styles.loading}>Loading source…</div>
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.info}>
          <span className={styles.badge}>{tab.objectType}</span>
          <span>{tab.objectOwner}.{tab.objectName}</span>
        </div>
        {isPackage && (
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${activeSection === 'spec' ? styles.tabActive : ''}`}
              onClick={() => setActiveSection('spec')}>Spec</button>
            <button className={`${styles.tab} ${activeSection === 'body' ? styles.tabActive : ''}`}
              onClick={() => setActiveSection('body')}>Body</button>
          </div>
        )}
        <div className={styles.actions}>
          {saveMsg && (
            <span className={errors.length > 0 ? styles.errMsg : styles.okMsg}>{saveMsg}</span>
          )}
          <button className={styles.saveBtn} onClick={handleSave} title="Compile & Save (⌘S)">
            ▶ Compile
          </button>
          <button className={styles.reloadBtn} onClick={loadSource} title="Reload from DB">↺</button>
        </div>
      </div>

      <div className={styles.editor}>
        <SqlEditor value={currentContent} onChange={handleChange} />
      </div>

      {errors.length > 0 && (
        <div className={styles.errPanel}>
          <div className={styles.errHeader}>Compilation Errors ({errors.length})</div>
          {errors.map((e, i) => (
            <div key={i} className={styles.errRow}>
              <span className={styles.errAttr}>{e.ATTRIBUTE}</span>
              <span className={styles.errLoc}>Line {e.LINE}, Col {e.POSITION}</span>
              <span className={styles.errText}>{e.TEXT}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

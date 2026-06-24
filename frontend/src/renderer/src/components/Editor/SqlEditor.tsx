import React, { useRef, useCallback, useDeferredValue, useMemo, useImperativeHandle, forwardRef } from 'react'
import { tokenize, type Dialect } from './tokenizer'
import { isSlashTerminator, extractStatementAtCursor } from './sqlUtils'
import styles from './SqlEditor.module.css'

export interface SqlEditorHandle {
  getStatementAtCursor: () => string
}

interface Props {
  value: string
  onChange: (value: string) => void
  onExecute?: (sql: string) => void
  readOnly?: boolean
  dialect?: Dialect
}

function highlight(code: string, dialect: Dialect): string {
  const tokens = tokenize(code, dialect)
  return tokens
    .map((t) => {
      const esc = t.value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      if (t.type === 'whitespace') return esc
      return `<span class="tok-${t.type}">${esc}</span>`
    })
    .join('')
}


export const SqlEditor = forwardRef<SqlEditorHandle, Props>(
  ({ value, onChange, onExecute, readOnly, dialect = 'oracle' }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const highlightRef = useRef<HTMLDivElement>(null)

    // Defer highlight computation so keystrokes are never blocked
    const deferredValue = useDeferredValue(value)
    const highlighted = useMemo(() => highlight(deferredValue, dialect) + '\n', [deferredValue, dialect])

    // Compute inline — no useEffect/setState needed
    const lineCount = (value.match(/\n/g)?.length ?? 0) + 1

    useImperativeHandle(ref, () => ({
      getStatementAtCursor: () => {
        const ta = textareaRef.current
        if (!ta) return ''
        // If text is selected, run the selection
        if (ta.selectionStart !== ta.selectionEnd) {
          return value.slice(ta.selectionStart, ta.selectionEnd).trim()
        }
        return extractStatementAtCursor(value, ta.selectionStart)
      }
    }))

    const syncScroll = useCallback(() => {
      if (!textareaRef.current || !highlightRef.current) return
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }, [])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const ta = textareaRef.current!
        const start = ta.selectionStart
        const end = ta.selectionEnd

        // Execute: Cmd+Enter — selection if any, otherwise statement at cursor
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault()
          const sql = start !== end
            ? value.slice(start, end).trim()
            : extractStatementAtCursor(value, start)
          onExecute?.(sql)
          return
        }

        // Tab → 2 spaces
        if (e.key === 'Tab') {
          e.preventDefault()
          if (e.shiftKey) {
            const lineStart = value.lastIndexOf('\n', start - 1) + 1
            const before = value.slice(0, lineStart)
            const line = value.slice(lineStart, end)
            const unindented = line.replace(/^  /, '')
            const removed = line.length - unindented.length
            onChange(before + unindented + value.slice(end))
            requestAnimationFrame(() => {
              ta.selectionStart = Math.max(start - removed, lineStart)
              ta.selectionEnd = end - removed
            })
          } else {
            onChange(value.slice(0, start) + '  ' + value.slice(end))
            requestAnimationFrame(() => {
              ta.selectionStart = ta.selectionEnd = start + 2
            })
          }
          return
        }

        // Auto-close brackets
        const pairs: Record<string, string> = { '(': ')', "'": "'", '"': '"' }
        if (pairs[e.key] && start === end) {
          e.preventDefault()
          const close = pairs[e.key]
          onChange(value.slice(0, start) + e.key + close + value.slice(end))
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = start + 1
          })
          return
        }

        // Skip over closing bracket if already there
        if (')]\'\"'.includes(e.key) && value[start] === e.key && start === end) {
          e.preventDefault()
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = start + 1
          })
          return
        }

        // Enter: auto-indent
        if (e.key === 'Enter') {
          e.preventDefault()
          const lineStart = value.lastIndexOf('\n', start - 1) + 1
          const line = value.slice(lineStart, start)
          const indent = line.match(/^(\s*)/)?.[1] ?? ''
          const extraIndent = line.trimEnd().endsWith('(') ? '  ' : ''
          const newText = '\n' + indent + extraIndent
          onChange(value.slice(0, start) + newText + value.slice(end))
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = start + newText.length
          })
        }
      },
      [value, onChange, onExecute]
    )

    return (
      <div className={styles.editorWrap}>
        <div className={styles.lineNumbers}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className={styles.lineNum}>{i + 1}</div>
          ))}
        </div>
        <div className={styles.editorInner}>
          <div
            ref={highlightRef}
            className={styles.highlight}
            aria-hidden
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            readOnly={readOnly}
          />
        </div>
      </div>
    )
  }
)

SqlEditor.displayName = 'SqlEditor'

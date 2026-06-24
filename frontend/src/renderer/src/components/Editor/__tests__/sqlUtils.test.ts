import { describe, it, expect } from 'vitest'
import { isSlashTerminator, extractStatementAtCursor } from '../sqlUtils'

// ---------------------------------------------------------------------------
// isSlashTerminator
// ---------------------------------------------------------------------------

describe('isSlashTerminator', () => {
  it('/ alone on its own line (first char) returns true', () => {
    expect(isSlashTerminator('/', 0)).toBe(true)
  })

  it('/ at position 0 in a string is a terminator', () => {
    // lineStart = 0, slice(0, 0) = '' → trim() === '' → true
    expect(isSlashTerminator('/\n', 0)).toBe(true)
  })

  it('/ preceded only by spaces on the same line returns true', () => {
    const code = '   /'
    expect(isSlashTerminator(code, 3)).toBe(true)
  })

  it('/ preceded by a tab on the same line returns true', () => {
    const code = '\t/'
    expect(isSlashTerminator(code, 1)).toBe(true)
  })

  it('/ after other characters on the same line returns false', () => {
    // e.g. "SELECT /" — the / is not a terminator
    const code = 'SELECT /'
    expect(isSlashTerminator(code, code.length - 1)).toBe(false)
  })

  it('/ after newline with content on its own line returns true', () => {
    const code = 'BEGIN\nEND;\n/'
    const slashPos = code.lastIndexOf('/')
    expect(isSlashTerminator(code, slashPos)).toBe(true)
  })

  it('/ on same line as code (no newline before it) returns false', () => {
    const code = 'END;/'
    expect(isSlashTerminator(code, 4)).toBe(false)
  })

  it('character that is not / always returns false', () => {
    expect(isSlashTerminator('SELECT', 0)).toBe(false)
    expect(isSlashTerminator('abc', 1)).toBe(false)
  })

  it('pos pointing to something other than / in a string with a / elsewhere returns false', () => {
    const code = 'a/b'
    // pos 0 is 'a', pos 2 is 'b' — neither is '/'
    expect(isSlashTerminator(code, 0)).toBe(false)
    expect(isSlashTerminator(code, 2)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// extractStatementAtCursor — helpers
// ---------------------------------------------------------------------------

// Returns the character index of the nth occurrence of `sub` in `str`
function nthIndex(str: string, sub: string, n: number): number {
  let idx = -1
  for (let i = 0; i < n; i++) {
    idx = str.indexOf(sub, idx + 1)
    if (idx === -1) break
  }
  return idx
}

// ---------------------------------------------------------------------------
// extractStatementAtCursor
// ---------------------------------------------------------------------------

describe('extractStatementAtCursor – single SQL statement', () => {
  it('single statement with ; — cursor at beginning returns full statement', () => {
    const code = 'SELECT 1 FROM dual;'
    expect(extractStatementAtCursor(code, 0)).toBe('SELECT 1 FROM dual;')
  })

  it('single statement with ; — cursor in the middle returns full statement', () => {
    const code = 'SELECT 1 FROM dual;'
    expect(extractStatementAtCursor(code, 7)).toBe('SELECT 1 FROM dual;')
  })

  it('single statement with ; — cursor at last char before ; returns full statement', () => {
    const code = 'SELECT 1 FROM dual;'
    expect(extractStatementAtCursor(code, code.length - 2)).toBe('SELECT 1 FROM dual;')
  })
})

describe('extractStatementAtCursor – two SQL statements separated by blank line', () => {
  it('cursor in first statement returns only first statement', () => {
    const code = 'SELECT 1 FROM dual\n\nSELECT 2 FROM dual'
    // cursor at position 0 (inside first statement)
    const result = extractStatementAtCursor(code, 0)
    expect(result).toBe('SELECT 1 FROM dual')
  })

  it('cursor in second statement returns only second statement', () => {
    const code = 'SELECT 1 FROM dual\n\nSELECT 2 FROM dual'
    // cursor somewhere in the second statement
    const secondStart = code.indexOf('SELECT 2')
    const result = extractStatementAtCursor(code, secondStart + 2)
    expect(result).toBe('SELECT 2 FROM dual')
  })
})

describe('extractStatementAtCursor – two SQL statements separated by semicolons', () => {
  it('cursor in second statement returns second statement', () => {
    const code = 'SELECT 1 FROM dual;\nSELECT 2 FROM dual;'
    // position inside "SELECT 2..."
    const cursorPos = code.indexOf('SELECT 2') + 2
    const result = extractStatementAtCursor(code, cursorPos)
    expect(result).toBe('SELECT 2 FROM dual;')
  })

  it('cursor in first statement returns first statement', () => {
    const code = 'SELECT 1 FROM dual;\nSELECT 2 FROM dual;'
    const result = extractStatementAtCursor(code, 5)
    expect(result).toBe('SELECT 1 FROM dual;')
  })
})

describe('extractStatementAtCursor – PL/SQL block with / terminator', () => {
  it('cursor in middle of block returns full block including /', () => {
    const code = 'BEGIN\n  NULL;\nEND;\n/'
    const cursorPos = code.indexOf('NULL')
    const result = extractStatementAtCursor(code, cursorPos)
    expect(result).toBe('BEGIN\n  NULL;\nEND;\n/')
  })

  it('cursor at beginning of block returns full block', () => {
    const code = 'BEGIN\n  NULL;\nEND;\n/'
    const result = extractStatementAtCursor(code, 0)
    expect(result).toBe('BEGIN\n  NULL;\nEND;\n/')
  })
})

describe('extractStatementAtCursor – two PL/SQL blocks separated by /', () => {
  it('cursor in second block returns only second block', () => {
    const block1 = 'BEGIN\n  NULL;\nEND;'
    const sep = '\n/'
    const block2 = '\nBEGIN\n  DBMS_OUTPUT.PUT_LINE(1);\nEND;'
    const terminator2 = '\n/'
    const code = block1 + sep + block2 + terminator2

    // cursor somewhere inside block2
    const cursorPos = code.indexOf('DBMS_OUTPUT')
    const result = extractStatementAtCursor(code, cursorPos)
    // Should contain block2 content and the closing /
    expect(result).toContain('DBMS_OUTPUT.PUT_LINE(1)')
    expect(result).toContain('/')
    // Should NOT contain block1 content
    expect(result).not.toContain('BEGIN\n  NULL')
  })
})

describe('extractStatementAtCursor – edge cases', () => {
  it('empty string returns empty string', () => {
    expect(extractStatementAtCursor('', 0)).toBe('')
  })

  it('cursor at end of file with no terminator returns remaining text', () => {
    const code = 'SELECT sysdate'
    // cursor at position 0; no ; or blank line; no /
    const result = extractStatementAtCursor(code, 0)
    expect(result).toBe('SELECT sysdate')
  })

  it('single newline does not crash', () => {
    expect(() => extractStatementAtCursor('\n', 0)).not.toThrow()
  })

  it('cursor past end of short string uses code.length as end boundary', () => {
    const code = 'SELECT 1'
    // cursorPos === code.length is an edge case
    const result = extractStatementAtCursor(code, code.length)
    expect(result).toBe('SELECT 1')
  })
})

export function isSlashTerminator(code: string, pos: number): boolean {
  if (code[pos] !== '/') return false
  const lineStart = code.lastIndexOf('\n', pos - 1) + 1
  return code.slice(lineStart, pos).trim() === ''
}

export function extractStatementAtCursor(code: string, cursorPos: number): string {
  let nextSlash = -1
  for (let i = cursorPos; i < code.length; i++) {
    if (isSlashTerminator(code, i)) { nextSlash = i + 1; break }
  }

  if (nextSlash !== -1) {
    let start = 0
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (isSlashTerminator(code, i)) { start = i + 1; break }
    }
    return code.slice(start, nextSlash).trim()
  }

  let start = 0
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (code[i] === ';') { start = i + 1; break }
    if (code[i] === '\n' && i > 0 && code[i - 1] === '\n') { start = i + 1; break }
  }

  let end = code.length
  for (let i = cursorPos; i < code.length; i++) {
    if (code[i] === ';') { end = i + 1; break }
    if (code[i] === '\n' && i + 1 < code.length && code[i + 1] === '\n') { end = i; break }
  }

  return code.slice(start, end).trim()
}

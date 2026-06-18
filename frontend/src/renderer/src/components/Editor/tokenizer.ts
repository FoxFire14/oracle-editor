export type TokenType =
  | 'keyword'
  | 'keyword2'
  | 'string'
  | 'number'
  | 'comment'
  | 'comment-block'
  | 'function'
  | 'operator'
  | 'identifier'
  | 'punctuation'
  | 'whitespace'

export interface Token {
  type: TokenType
  value: string
}

const KEYWORDS = new Set([
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','LIKE','BETWEEN',
  'INSERT','INTO','VALUES','UPDATE','SET','DELETE','MERGE','USING','MATCHED',
  'CREATE','ALTER','DROP','TRUNCATE','TABLE','VIEW','INDEX','SEQUENCE','SYNONYM',
  'PACKAGE','PROCEDURE','FUNCTION','TRIGGER','TYPE','BODY',
  'BEGIN','END','DECLARE','EXCEPTION','RAISE','RETURN','RETURNS',
  'IF','THEN','ELSE','ELSIF','LOOP','FOR','WHILE','EXIT','CONTINUE',
  'COMMIT','ROLLBACK','SAVEPOINT','GRANT','REVOKE','TO','ON',
  'JOIN','INNER','LEFT','RIGHT','FULL','OUTER','CROSS','NATURAL',
  'GROUP','BY','ORDER','HAVING','UNION','INTERSECT','MINUS','ALL',
  'DISTINCT','AS','WITH','CONNECT','PRIOR','START','LEVEL','NOCYCLE',
  'CASE','WHEN','THEN','ELSE','END','OVER','PARTITION','ROWS','RANGE',
  'UNBOUNDED','PRECEDING','FOLLOWING','CURRENT','ROW',
  'PRIMARY','KEY','FOREIGN','REFERENCES','UNIQUE','CHECK','DEFAULT','CONSTRAINT',
  'NOT','NULL','ENABLE','DISABLE','VALIDATE','NOVALIDATE',
  'REPLACE','OR','FORCE','NO','COMPILE','REUSE','SETTINGS',
  'EXECUTE','IMMEDIATE','BULK','COLLECT','FORALL','CURSOR','OPEN','CLOSE','FETCH',
  'INTO','LIMIT','RECORD','ROWTYPE','TYPE','OF','TABLE','INDEX','BY','VARRAY',
  'PRAGMA','EXCEPTION_INIT','AUTONOMOUS_TRANSACTION',
  'VARCHAR2','NUMBER','DATE','TIMESTAMP','CLOB','BLOB','CHAR','INTEGER','FLOAT',
  'BOOLEAN','PLS_INTEGER','BINARY_INTEGER','SIMPLE_INTEGER','ROWID','UROWID',
  'INTERVAL','YEAR','MONTH','DAY','HOUR','MINUTE','SECOND',
  'SYS_REFCURSOR','REF','CURSOR',
])

const FUNCTIONS = new Set([
  'COUNT','SUM','AVG','MIN','MAX','NVL','NVL2','NULLIF','COALESCE','DECODE',
  'TO_CHAR','TO_DATE','TO_NUMBER','TO_TIMESTAMP','TO_CLOB','TO_BLOB',
  'SUBSTR','SUBSTRB','LENGTH','LENGTHB','INSTR','INSTRB','TRIM','LTRIM','RTRIM',
  'UPPER','LOWER','INITCAP','REPLACE','TRANSLATE','REGEXP_REPLACE','REGEXP_SUBSTR',
  'REGEXP_INSTR','REGEXP_LIKE','REGEXP_COUNT',
  'ROUND','TRUNC','CEIL','FLOOR','MOD','REMAINDER','POWER','SQRT','ABS','SIGN',
  'SYSDATE','SYSTIMESTAMP','CURRENT_DATE','CURRENT_TIMESTAMP','LOCALTIMESTAMP',
  'ADD_MONTHS','MONTHS_BETWEEN','NEXT_DAY','LAST_DAY','EXTRACT',
  'ROWNUM','ROWID','LEVEL','CONNECT_BY_ISCYCLE','CONNECT_BY_ISLEAF',
  'LEAD','LAG','FIRST_VALUE','LAST_VALUE','NTH_VALUE','NTILE',
  'RANK','DENSE_RANK','ROW_NUMBER','PERCENT_RANK','CUME_DIST',
  'LISTAGG','XMLAGG','XMLELEMENT','XMLFOREST','XMLROOT','XMLTYPE',
  'DBMS_OUTPUT','PUT_LINE','RAISE_APPLICATION_ERROR',
  'SYS_GUID','USERENV','SYS_CONTEXT','UID','USER',
])

export function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < code.length) {
    // Line comment
    if (code[i] === '-' && code[i + 1] === '-') {
      let j = i + 2
      while (j < code.length && code[j] !== '\n') j++
      tokens.push({ type: 'comment', value: code.slice(i, j) })
      i = j
      continue
    }

    // Block comment
    if (code[i] === '/' && code[i + 1] === '*') {
      let j = i + 2
      while (j < code.length && !(code[j] === '*' && code[j + 1] === '/')) j++
      j += 2
      tokens.push({ type: 'comment-block', value: code.slice(i, j) })
      i = j
      continue
    }

    // String literal (single quote)
    if (code[i] === "'") {
      let j = i + 1
      while (j < code.length) {
        if (code[j] === "'" && code[j + 1] === "'") { j += 2; continue }
        if (code[j] === "'") { j++; break }
        j++
      }
      tokens.push({ type: 'string', value: code.slice(i, j) })
      i = j
      continue
    }

    // Number
    if (/[0-9]/.test(code[i]) || (code[i] === '.' && /[0-9]/.test(code[i + 1] ?? ''))) {
      let j = i + 1
      while (j < code.length && /[0-9._eE]/.test(code[j])) j++
      tokens.push({ type: 'number', value: code.slice(i, j) })
      i = j
      continue
    }

    // Identifier or keyword
    if (/[a-zA-Z_$#]/.test(code[i])) {
      let j = i + 1
      while (j < code.length && /[a-zA-Z0-9_$#.]/.test(code[j])) j++
      const word = code.slice(i, j)
      const upper = word.toUpperCase()
      let type: TokenType = 'identifier'
      if (KEYWORDS.has(upper)) type = 'keyword'
      else if (FUNCTIONS.has(upper)) type = 'function'
      tokens.push({ type, value: word })
      i = j
      continue
    }

    // Quoted identifier
    if (code[i] === '"') {
      let j = i + 1
      while (j < code.length && code[j] !== '"') j++
      j++
      tokens.push({ type: 'identifier', value: code.slice(i, j) })
      i = j
      continue
    }

    // Operator
    if (/[+\-*/<>=!|^~]/.test(code[i])) {
      let j = i + 1
      while (j < code.length && /[+\-*/<>=!|^~]/.test(code[j])) j++
      tokens.push({ type: 'operator', value: code.slice(i, j) })
      i = j
      continue
    }

    // Punctuation
    if (/[(),;:@%]/.test(code[i])) {
      tokens.push({ type: 'punctuation', value: code[i] })
      i++
      continue
    }

    // Whitespace (including newlines — keep together for rendering)
    if (code[i] === '\n') {
      tokens.push({ type: 'whitespace', value: '\n' })
      i++
      continue
    }

    if (/\s/.test(code[i])) {
      let j = i + 1
      while (j < code.length && /[^\S\n]/.test(code[j])) j++
      tokens.push({ type: 'whitespace', value: code.slice(i, j) })
      i = j
      continue
    }

    // Fallback
    tokens.push({ type: 'identifier', value: code[i] })
    i++
  }

  return tokens
}

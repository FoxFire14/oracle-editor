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

export type Dialect = 'oracle' | 'postgres'

export interface Token {
  type: TokenType
  value: string
}

// ── Shared by both dialects ────────────────────────────────────────────────

const COMMON_KEYWORDS = [
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','LIKE','BETWEEN',
  'INSERT','INTO','VALUES','UPDATE','SET','DELETE',
  'CREATE','ALTER','DROP','TRUNCATE','TABLE','VIEW','INDEX','SEQUENCE',
  'PROCEDURE','FUNCTION','TRIGGER','TYPE',
  'BEGIN','END','DECLARE','EXCEPTION','RAISE','RETURN','RETURNS',
  'IF','THEN','ELSE','LOOP','FOR','WHILE','EXIT','CONTINUE',
  'COMMIT','ROLLBACK','SAVEPOINT','GRANT','REVOKE','TO','ON',
  'JOIN','INNER','LEFT','RIGHT','FULL','OUTER','CROSS','NATURAL',
  'GROUP','BY','ORDER','HAVING','UNION','INTERSECT','ALL',
  'DISTINCT','AS','WITH',
  'CASE','WHEN','OVER','PARTITION','ROWS','RANGE',
  'UNBOUNDED','PRECEDING','FOLLOWING','CURRENT','ROW',
  'PRIMARY','KEY','FOREIGN','REFERENCES','UNIQUE','CHECK','DEFAULT','CONSTRAINT',
  'ENABLE','DISABLE','VALIDATE','REPLACE','EXECUTE','CURSOR',
  'OPEN','CLOSE','FETCH','LIMIT','RECORD',
  'VARCHAR','INTEGER','INT','BIGINT','SMALLINT','FLOAT','CHAR',
  'DATE','TIMESTAMP','BOOLEAN','INTERVAL',
  'YEAR','MONTH','DAY','HOUR','MINUTE','SECOND',
]

const COMMON_FUNCTIONS = [
  'COUNT','SUM','AVG','MIN','MAX','NULLIF','COALESCE',
  'TRIM','LTRIM','RTRIM','UPPER','LOWER','REPLACE','LENGTH','SUBSTR',
  'INSTR','INITCAP',
  'ROUND','TRUNC','CEIL','FLOOR','MOD','POWER','SQRT','ABS','SIGN',
  'CURRENT_DATE','CURRENT_TIMESTAMP','EXTRACT',
  'LEAD','LAG','FIRST_VALUE','LAST_VALUE','NTH_VALUE','NTILE',
  'RANK','DENSE_RANK','ROW_NUMBER','PERCENT_RANK','CUME_DIST',
  'REGEXP_REPLACE','USER',
]

// ── Oracle-specific ────────────────────────────────────────────────────────

const ORACLE_KEYWORDS = [
  'PACKAGE','BODY','MERGE','USING','MATCHED',
  'CONNECT','PRIOR','START','LEVEL','NOCYCLE',
  'MINUS','FORCE','NO','COMPILE','REUSE','SETTINGS',
  'IMMEDIATE','BULK','COLLECT','FORALL','VARRAY',
  'ROWTYPE','PRAGMA','EXCEPTION_INIT','AUTONOMOUS_TRANSACTION',
  'ELSIF','NOVALIDATE',
  'VARCHAR2','NUMBER','CLOB','BLOB','NCLOB',
  'PLS_INTEGER','BINARY_INTEGER','SIMPLE_INTEGER','ROWID','UROWID',
  'SYS_REFCURSOR','REF',
]

const ORACLE_FUNCTIONS = [
  'NVL','NVL2','DECODE',
  'TO_CHAR','TO_DATE','TO_NUMBER','TO_TIMESTAMP','TO_CLOB','TO_BLOB',
  'SUBSTRB','LENGTHB','INSTRB','TRANSLATE',
  'SYSDATE','SYSTIMESTAMP','LOCALTIMESTAMP',
  'ADD_MONTHS','MONTHS_BETWEEN','NEXT_DAY','LAST_DAY',
  'ROWNUM','LEVEL','CONNECT_BY_ISCYCLE','CONNECT_BY_ISLEAF',
  'LISTAGG','XMLAGG','XMLELEMENT','XMLFOREST','XMLROOT','XMLTYPE',
  'DBMS_OUTPUT','PUT_LINE','RAISE_APPLICATION_ERROR',
  'SYS_GUID','USERENV','SYS_CONTEXT','UID',
  'REGEXP_SUBSTR','REGEXP_INSTR','REGEXP_LIKE','REGEXP_COUNT',
]

// ── PostgreSQL-specific ────────────────────────────────────────────────────

const POSTGRES_KEYWORDS = [
  'RETURNING','LATERAL','ILIKE','SIMILAR',
  'DO','LANGUAGE','PLPGSQL',
  'COPY','VACUUM','ANALYZE','CLUSTER',
  'CONFLICT','EXCLUDED','EXCEPT',
  'ELSEIF','ARRAY','VARIADIC',
  'GENERATED','ALWAYS','IDENTITY','OWNED',
  'TEXT','BYTEA','UUID','JSONB','JSON',
  'SERIAL','BIGSERIAL','SMALLSERIAL',
  'NUMERIC','REAL','DOUBLE','PRECISION',
  'BOOL','MONEY','CIDR','INET','MACADDR',
  'SCHEMA','DATABASE','EXTENSION','ROLE',
]

const POSTGRES_FUNCTIONS = [
  'NOW','AGE','DATE_TRUNC','DATE_PART','MAKE_DATE','MAKE_TIMESTAMP',
  'TO_CHAR','TO_DATE','TO_NUMBER','TO_TIMESTAMP',
  'STRING_AGG','ARRAY_AGG','JSON_AGG','JSONB_AGG','ARRAY_TO_STRING',
  'REGEXP_MATCHES','REGEXP_SPLIT_TO_TABLE','REGEXP_SPLIT_TO_ARRAY',
  'GEN_RANDOM_UUID','MD5','ENCODE','DECODE',
  'SPLIT_PART','POSITION','OVERLAY','SUBSTRING',
  'UNNEST','GENERATE_SERIES','PG_SLEEP',
  'COALESCE','NULLIF','GREATEST','LEAST',
  'FORMAT','QUOTE_IDENT','QUOTE_LITERAL',
  'PG_TYPEOF','OID','CAST',
  'RAISE',
]

// ── Per-dialect sets ───────────────────────────────────────────────────────

const DIALECT: Record<Dialect, { keywords: Set<string>; functions: Set<string> }> = {
  oracle: {
    keywords:  new Set([...COMMON_KEYWORDS, ...ORACLE_KEYWORDS].map((k) => k.toUpperCase())),
    functions: new Set([...COMMON_FUNCTIONS, ...ORACLE_FUNCTIONS].map((f) => f.toUpperCase())),
  },
  postgres: {
    keywords:  new Set([...COMMON_KEYWORDS, ...POSTGRES_KEYWORDS].map((k) => k.toUpperCase())),
    functions: new Set([...COMMON_FUNCTIONS, ...POSTGRES_FUNCTIONS].map((f) => f.toUpperCase())),
  },
}

// ── Tokenizer ─────────────────────────────────────────────────────────────

export function tokenize(code: string, dialect: Dialect = 'oracle'): Token[] {
  const { keywords, functions } = DIALECT[dialect]
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

    // PostgreSQL dollar-quoted string: $$ ... $$ or $tag$ ... $tag$
    if (dialect === 'postgres' && code[i] === '$') {
      const tagEnd = code.indexOf('$', i + 1)
      if (tagEnd !== -1) {
        const tag = code.slice(i, tagEnd + 1)
        const closeIdx = code.indexOf(tag, tagEnd + 1)
        if (closeIdx !== -1) {
          tokens.push({ type: 'string', value: code.slice(i, closeIdx + tag.length) })
          i = closeIdx + tag.length
          continue
        }
      }
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
      if (keywords.has(upper)) type = 'keyword'
      else if (functions.has(upper)) type = 'function'
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

    tokens.push({ type: 'identifier', value: code[i] })
    i++
  }

  return tokens
}

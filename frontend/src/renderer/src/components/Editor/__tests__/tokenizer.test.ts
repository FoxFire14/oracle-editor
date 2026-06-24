import { describe, it, expect } from 'vitest'
import { tokenize } from '../tokenizer'
import type { Token, Dialect } from '../tokenizer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function types(tokens: Token[]): string[] {
  return tokens.map(t => t.type)
}

function values(tokens: Token[]): string[] {
  return tokens.map(t => t.value)
}

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe('tokenize – empty / trivial', () => {
  it('empty string returns empty array', () => {
    expect(tokenize('')).toEqual([])
  })
})

describe('tokenize – keywords', () => {
  it('uppercase SELECT produces a single keyword token', () => {
    const tokens = tokenize('SELECT')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('keyword')
    expect(tokens[0].value).toBe('SELECT')
  })

  it('lowercase select also produces a keyword token (case-insensitive)', () => {
    const tokens = tokenize('select')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('keyword')
    expect(tokens[0].value).toBe('select')
  })

  it('FROM is a keyword', () => {
    const tokens = tokenize('FROM')
    expect(tokens[0].type).toBe('keyword')
  })

  it('WHERE is a keyword', () => {
    expect(tokenize('WHERE')[0].type).toBe('keyword')
  })

  it('mixed-case keyword is still keyword', () => {
    expect(tokenize('Where')[0].type).toBe('keyword')
  })
})

describe('tokenize – functions', () => {
  it('COUNT is a function token, not a keyword', () => {
    const tokens = tokenize('COUNT')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('function')
  })

  it('count (lowercase) is also a function token', () => {
    expect(tokenize('count')[0].type).toBe('function')
  })

  it('SUM is a function token', () => {
    expect(tokenize('SUM')[0].type).toBe('function')
  })

  it('NVL is a function token', () => {
    expect(tokenize('NVL')[0].type).toBe('function')
  })
})

describe('tokenize – string literals', () => {
  it("single-quoted string 'hello' becomes a string token", () => {
    const tokens = tokenize("'hello'")
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('string')
    expect(tokens[0].value).toBe("'hello'")
  })

  it("escaped single quote 'it''s' is one string token", () => {
    const tokens = tokenize("'it''s'")
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('string')
    expect(tokens[0].value).toBe("'it''s'")
  })

  it('empty string literal is one string token', () => {
    const tokens = tokenize("''")
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('string')
    expect(tokens[0].value).toBe("''")
  })

  it('string with spaces is one token', () => {
    const tokens = tokenize("'hello world'")
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('string')
  })
})

describe('tokenize – comments', () => {
  it('line comment produces a comment token', () => {
    const tokens = tokenize('-- this is a comment')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('comment')
    expect(tokens[0].value).toBe('-- this is a comment')
  })

  it('line comment does not include the trailing newline in the token value', () => {
    const tokens = tokenize('-- comment\n')
    expect(tokens[0].type).toBe('comment')
    expect(tokens[0].value).toBe('-- comment')
    // the newline becomes a separate whitespace token
    expect(tokens[1].type).toBe('whitespace')
    expect(tokens[1].value).toBe('\n')
  })

  it('block comment produces a comment-block token', () => {
    const tokens = tokenize('/* hello */')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('comment-block')
    expect(tokens[0].value).toBe('/* hello */')
  })

  it('multi-line block comment is a single comment-block token', () => {
    const tokens = tokenize('/*\n  multi\n  line\n*/')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('comment-block')
  })
})

describe('tokenize – numbers', () => {
  it('integer 42 becomes a number token', () => {
    const tokens = tokenize('42')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('number')
    expect(tokens[0].value).toBe('42')
  })

  it('float 3.14 becomes a number token', () => {
    const tokens = tokenize('3.14')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('number')
    expect(tokens[0].value).toBe('3.14')
  })

  it('number starting with dot (.5) becomes a number token', () => {
    const tokens = tokenize('.5')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('number')
    expect(tokens[0].value).toBe('.5')
  })

  it('zero is a number token', () => {
    expect(tokenize('0')[0].type).toBe('number')
  })
})

describe('tokenize – operators', () => {
  it('>= is a single operator token', () => {
    const tokens = tokenize('>=')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('operator')
    expect(tokens[0].value).toBe('>=')
  })

  it('<= is a single operator token', () => {
    expect(tokenize('<=')[0].type).toBe('operator')
  })

  it('!= is a single operator token', () => {
    expect(tokenize('!=')[0].type).toBe('operator')
  })

  it('single = is an operator token', () => {
    const tokens = tokenize('=')
    expect(tokens[0].type).toBe('operator')
    expect(tokens[0].value).toBe('=')
  })

  it('|| is a single operator token', () => {
    const tokens = tokenize('||')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('operator')
    expect(tokens[0].value).toBe('||')
  })
})

describe('tokenize – punctuation', () => {
  it('opening parenthesis is punctuation', () => {
    const tokens = tokenize('(')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('punctuation')
    expect(tokens[0].value).toBe('(')
  })

  it('closing parenthesis is punctuation', () => {
    expect(tokenize(')')[0].type).toBe('punctuation')
  })

  it('semicolon is punctuation', () => {
    const tokens = tokenize(';')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('punctuation')
    expect(tokens[0].value).toBe(';')
  })

  it('comma is punctuation', () => {
    expect(tokenize(',')[0].type).toBe('punctuation')
  })

  it('colon is punctuation', () => {
    expect(tokenize(':')[0].type).toBe('punctuation')
  })
})

describe('tokenize – identifiers', () => {
  it('unknown name my_table is an identifier', () => {
    const tokens = tokenize('my_table')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('identifier')
    expect(tokens[0].value).toBe('my_table')
  })

  it('quoted identifier "MY TABLE" is an identifier token', () => {
    const tokens = tokenize('"MY TABLE"')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('identifier')
    expect(tokens[0].value).toBe('"MY TABLE"')
  })

  it('identifier starting with _ is an identifier', () => {
    expect(tokenize('_my_var')[0].type).toBe('identifier')
  })

  it('identifier with $ is an identifier', () => {
    expect(tokenize('v$session')[0].type).toBe('identifier')
  })
})

describe('tokenize – whitespace', () => {
  it('newline produces a whitespace token with value \\n', () => {
    const tokens = tokenize('\n')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('whitespace')
    expect(tokens[0].value).toBe('\n')
  })

  it('spaces produce a whitespace token', () => {
    const tokens = tokenize('   ')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('whitespace')
  })

  it('tab produces a whitespace token', () => {
    expect(tokenize('\t')[0].type).toBe('whitespace')
  })

  it('each newline is its own whitespace token', () => {
    const tokens = tokenize('\n\n')
    expect(tokens).toHaveLength(2)
    expect(tokens[0].value).toBe('\n')
    expect(tokens[1].value).toBe('\n')
  })
})

// ---------------------------------------------------------------------------
// Dialect: Oracle-specific tokens
// ---------------------------------------------------------------------------

describe('tokenize – Oracle dialect keywords', () => {
  it('defaults to oracle dialect when no dialect is specified', () => {
    expect(tokenize('VARCHAR2')[0].type).toBe('keyword')
  })

  it('VARCHAR2 is a keyword in oracle dialect', () => {
    expect(tokenize('VARCHAR2', 'oracle')[0].type).toBe('keyword')
  })

  it('PACKAGE is a keyword in oracle dialect', () => {
    expect(tokenize('PACKAGE', 'oracle')[0].type).toBe('keyword')
  })

  it('BODY is a keyword in oracle dialect', () => {
    expect(tokenize('BODY', 'oracle')[0].type).toBe('keyword')
  })

  it('ELSIF is a keyword in oracle dialect', () => {
    expect(tokenize('ELSIF', 'oracle')[0].type).toBe('keyword')
  })

  it('NOCYCLE is a keyword in oracle dialect', () => {
    expect(tokenize('NOCYCLE', 'oracle')[0].type).toBe('keyword')
  })

  it('PRIOR is a keyword in oracle dialect', () => {
    expect(tokenize('PRIOR', 'oracle')[0].type).toBe('keyword')
  })

  it('ROWTYPE is a keyword in oracle dialect', () => {
    expect(tokenize('ROWTYPE', 'oracle')[0].type).toBe('keyword')
  })

  it('MINUS is a keyword in oracle dialect', () => {
    expect(tokenize('MINUS', 'oracle')[0].type).toBe('keyword')
  })

  it('BULK is a keyword in oracle dialect', () => {
    expect(tokenize('BULK', 'oracle')[0].type).toBe('keyword')
  })

  it('PRAGMA is a keyword in oracle dialect', () => {
    expect(tokenize('PRAGMA', 'oracle')[0].type).toBe('keyword')
  })

  it('VARRAY is a keyword in oracle dialect', () => {
    expect(tokenize('VARRAY', 'oracle')[0].type).toBe('keyword')
  })

  it('SYS_REFCURSOR is a keyword in oracle dialect', () => {
    expect(tokenize('SYS_REFCURSOR', 'oracle')[0].type).toBe('keyword')
  })
})

describe('tokenize – Oracle dialect functions', () => {
  it('NVL is a function in oracle dialect', () => {
    expect(tokenize('NVL', 'oracle')[0].type).toBe('function')
  })

  it('NVL2 is a function in oracle dialect', () => {
    expect(tokenize('NVL2', 'oracle')[0].type).toBe('function')
  })

  it('DECODE is a function in oracle dialect', () => {
    expect(tokenize('DECODE', 'oracle')[0].type).toBe('function')
  })

  it('SYSDATE is a function in oracle dialect', () => {
    expect(tokenize('SYSDATE', 'oracle')[0].type).toBe('function')
  })

  it('TO_DATE is a function in oracle dialect', () => {
    expect(tokenize('TO_DATE', 'oracle')[0].type).toBe('function')
  })

  it('TO_CHAR is a function in oracle dialect', () => {
    expect(tokenize('TO_CHAR', 'oracle')[0].type).toBe('function')
  })

  it('TO_NUMBER is a function in oracle dialect', () => {
    expect(tokenize('TO_NUMBER', 'oracle')[0].type).toBe('function')
  })

  it('LISTAGG is a function in oracle dialect', () => {
    expect(tokenize('LISTAGG', 'oracle')[0].type).toBe('function')
  })

  it('DBMS_OUTPUT is a function in oracle dialect', () => {
    expect(tokenize('DBMS_OUTPUT', 'oracle')[0].type).toBe('function')
  })

  it('RAISE_APPLICATION_ERROR is a function in oracle dialect', () => {
    expect(tokenize('RAISE_APPLICATION_ERROR', 'oracle')[0].type).toBe('function')
  })

  it('SYS_GUID is a function in oracle dialect', () => {
    expect(tokenize('SYS_GUID', 'oracle')[0].type).toBe('function')
  })

  it('ROWNUM is a function in oracle dialect', () => {
    expect(tokenize('ROWNUM', 'oracle')[0].type).toBe('function')
  })

  it('ADD_MONTHS is a function in oracle dialect', () => {
    expect(tokenize('ADD_MONTHS', 'oracle')[0].type).toBe('function')
  })

  it('MONTHS_BETWEEN is a function in oracle dialect', () => {
    expect(tokenize('MONTHS_BETWEEN', 'oracle')[0].type).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Dialect: PostgreSQL-specific tokens
// ---------------------------------------------------------------------------

describe('tokenize – PostgreSQL dialect keywords', () => {
  it('RETURNING is a keyword in postgres dialect', () => {
    expect(tokenize('RETURNING', 'postgres')[0].type).toBe('keyword')
  })

  it('ILIKE is a keyword in postgres dialect', () => {
    expect(tokenize('ILIKE', 'postgres')[0].type).toBe('keyword')
  })

  it('LATERAL is a keyword in postgres dialect', () => {
    expect(tokenize('LATERAL', 'postgres')[0].type).toBe('keyword')
  })

  it('DO is a keyword in postgres dialect', () => {
    expect(tokenize('DO', 'postgres')[0].type).toBe('keyword')
  })

  it('LANGUAGE is a keyword in postgres dialect', () => {
    expect(tokenize('LANGUAGE', 'postgres')[0].type).toBe('keyword')
  })

  it('ELSEIF is a keyword in postgres dialect', () => {
    expect(tokenize('ELSEIF', 'postgres')[0].type).toBe('keyword')
  })

  it('EXCEPT is a keyword in postgres dialect', () => {
    expect(tokenize('EXCEPT', 'postgres')[0].type).toBe('keyword')
  })

  it('JSONB is a keyword in postgres dialect', () => {
    expect(tokenize('JSONB', 'postgres')[0].type).toBe('keyword')
  })

  it('TEXT is a keyword in postgres dialect', () => {
    expect(tokenize('TEXT', 'postgres')[0].type).toBe('keyword')
  })

  it('SERIAL is a keyword in postgres dialect', () => {
    expect(tokenize('SERIAL', 'postgres')[0].type).toBe('keyword')
  })

  it('BIGSERIAL is a keyword in postgres dialect', () => {
    expect(tokenize('BIGSERIAL', 'postgres')[0].type).toBe('keyword')
  })

  it('UUID is a keyword in postgres dialect', () => {
    expect(tokenize('UUID', 'postgres')[0].type).toBe('keyword')
  })

  it('CONFLICT is a keyword in postgres dialect', () => {
    expect(tokenize('CONFLICT', 'postgres')[0].type).toBe('keyword')
  })

  it('EXCLUDED is a keyword in postgres dialect', () => {
    expect(tokenize('EXCLUDED', 'postgres')[0].type).toBe('keyword')
  })

  it('SCHEMA is a keyword in postgres dialect', () => {
    expect(tokenize('SCHEMA', 'postgres')[0].type).toBe('keyword')
  })
})

describe('tokenize – PostgreSQL dialect functions', () => {
  it('NOW is a function in postgres dialect', () => {
    expect(tokenize('NOW', 'postgres')[0].type).toBe('function')
  })

  it('DATE_TRUNC is a function in postgres dialect', () => {
    expect(tokenize('DATE_TRUNC', 'postgres')[0].type).toBe('function')
  })

  it('STRING_AGG is a function in postgres dialect', () => {
    expect(tokenize('STRING_AGG', 'postgres')[0].type).toBe('function')
  })

  it('ARRAY_AGG is a function in postgres dialect', () => {
    expect(tokenize('ARRAY_AGG', 'postgres')[0].type).toBe('function')
  })

  it('GEN_RANDOM_UUID is a function in postgres dialect', () => {
    expect(tokenize('GEN_RANDOM_UUID', 'postgres')[0].type).toBe('function')
  })

  it('GENERATE_SERIES is a function in postgres dialect', () => {
    expect(tokenize('GENERATE_SERIES', 'postgres')[0].type).toBe('function')
  })

  it('SPLIT_PART is a function in postgres dialect', () => {
    expect(tokenize('SPLIT_PART', 'postgres')[0].type).toBe('function')
  })

  it('UNNEST is a function in postgres dialect', () => {
    expect(tokenize('UNNEST', 'postgres')[0].type).toBe('function')
  })

  it('JSON_AGG is a function in postgres dialect', () => {
    expect(tokenize('JSON_AGG', 'postgres')[0].type).toBe('function')
  })

  it('AGE is a function in postgres dialect', () => {
    expect(tokenize('AGE', 'postgres')[0].type).toBe('function')
  })

  it('TO_CHAR is a function in postgres dialect', () => {
    expect(tokenize('TO_CHAR', 'postgres')[0].type).toBe('function')
  })

  it('TO_DATE is a function in postgres dialect', () => {
    expect(tokenize('TO_DATE', 'postgres')[0].type).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Dialect: isolation — Oracle-only tokens are NOT keywords/functions in postgres
// and vice-versa
// ---------------------------------------------------------------------------

describe('tokenize – dialect isolation', () => {
  it('VARCHAR2 is an identifier in postgres dialect (Oracle-only type)', () => {
    expect(tokenize('VARCHAR2', 'postgres')[0].type).toBe('identifier')
  })

  it('ELSIF is an identifier in postgres dialect', () => {
    expect(tokenize('ELSIF', 'postgres')[0].type).toBe('identifier')
  })

  it('PACKAGE is an identifier in postgres dialect', () => {
    expect(tokenize('PACKAGE', 'postgres')[0].type).toBe('identifier')
  })

  it('NOCYCLE is an identifier in postgres dialect', () => {
    expect(tokenize('NOCYCLE', 'postgres')[0].type).toBe('identifier')
  })

  it('NVL is an identifier in postgres dialect', () => {
    expect(tokenize('NVL', 'postgres')[0].type).toBe('identifier')
  })

  it('SYSDATE is an identifier in postgres dialect (Oracle-only function)', () => {
    expect(tokenize('SYSDATE', 'postgres')[0].type).toBe('identifier')
  })

  it('SYSDATE is an identifier in postgres dialect', () => {
    expect(tokenize('SYSDATE', 'postgres')[0].type).toBe('identifier')
  })

  it('DBMS_OUTPUT is an identifier in postgres dialect', () => {
    expect(tokenize('DBMS_OUTPUT', 'postgres')[0].type).toBe('identifier')
  })

  it('ILIKE is an identifier in oracle dialect (PostgreSQL-only)', () => {
    expect(tokenize('ILIKE', 'oracle')[0].type).toBe('identifier')
  })

  it('RETURNING is an identifier in oracle dialect', () => {
    expect(tokenize('RETURNING', 'oracle')[0].type).toBe('identifier')
  })

  it('ELSEIF is an identifier in oracle dialect', () => {
    expect(tokenize('ELSEIF', 'oracle')[0].type).toBe('identifier')
  })

  it('SERIAL is an identifier in oracle dialect', () => {
    expect(tokenize('SERIAL', 'oracle')[0].type).toBe('identifier')
  })

  it('JSONB is an identifier in oracle dialect', () => {
    expect(tokenize('JSONB', 'oracle')[0].type).toBe('identifier')
  })

  it('GEN_RANDOM_UUID is an identifier in oracle dialect', () => {
    expect(tokenize('GEN_RANDOM_UUID', 'oracle')[0].type).toBe('identifier')
  })

  it('STRING_AGG is an identifier in oracle dialect', () => {
    expect(tokenize('STRING_AGG', 'oracle')[0].type).toBe('identifier')
  })

  it('GENERATE_SERIES is an identifier in oracle dialect', () => {
    expect(tokenize('GENERATE_SERIES', 'oracle')[0].type).toBe('identifier')
  })
})

// ---------------------------------------------------------------------------
// Dialect: shared tokens work in both
// ---------------------------------------------------------------------------

describe('tokenize – shared tokens across both dialects', () => {
  const dialects: Dialect[] = ['oracle', 'postgres']

  for (const d of dialects) {
    it(`SELECT is a keyword in ${d}`, () => {
      expect(tokenize('SELECT', d)[0].type).toBe('keyword')
    })

    it(`JOIN is a keyword in ${d}`, () => {
      expect(tokenize('JOIN', d)[0].type).toBe('keyword')
    })

    it(`WITH is a keyword in ${d}`, () => {
      expect(tokenize('WITH', d)[0].type).toBe('keyword')
    })

    it(`COUNT is a function in ${d}`, () => {
      expect(tokenize('COUNT', d)[0].type).toBe('function')
    })

    it(`COALESCE is a function in ${d}`, () => {
      expect(tokenize('COALESCE', d)[0].type).toBe('function')
    })

    it(`ROW_NUMBER is a function in ${d}`, () => {
      expect(tokenize('ROW_NUMBER', d)[0].type).toBe('function')
    })
  }
})

// ---------------------------------------------------------------------------
// Dialect: PostgreSQL dollar-quoting
// ---------------------------------------------------------------------------

describe('tokenize – PostgreSQL dollar-quoting', () => {
  it('$$ body $$ is a single string token in postgres dialect', () => {
    const tokens = tokenize('$$hello$$', 'postgres')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('string')
    expect(tokens[0].value).toBe('$$hello$$')
  })

  it('tagged dollar-quote $tag$...$tag$ is a string token in postgres dialect', () => {
    const tokens = tokenize('$body$SELECT 1$body$', 'postgres')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('string')
  })

  it('keywords inside $$ are not highlighted (they are inside a string)', () => {
    const tokens = tokenize('$$SELECT 1$$', 'postgres')
    expect(tokens).toHaveLength(1)
    expect(tokens[0].type).toBe('string')
  })

  it('$$ is NOT treated as dollar-quote in oracle dialect (falls through to punctuation/identifier)', () => {
    const tokens = tokenize('$$hello$$', 'oracle')
    expect(tokens[0].type).not.toBe('string')
  })
})

// ---------------------------------------------------------------------------
// Dialect: full query sequences
// ---------------------------------------------------------------------------

describe('tokenize – Oracle full query sequences', () => {
  it('NVL(col, 0) token sequence is correct', () => {
    const tokens = tokenize('NVL(col, 0)', 'oracle')
    expect(tokens[0]).toEqual({ type: 'function', value: 'NVL' })
    expect(tokens[1]).toEqual({ type: 'punctuation', value: '(' })
    expect(tokens[2]).toEqual({ type: 'identifier', value: 'col' })
  })

  it('ROWNUM pseudo-column is a function token', () => {
    const tokens = tokenize('WHERE ROWNUM <= 10', 'oracle')
    const rownum = tokens.find(t => t.value === 'ROWNUM')
    expect(rownum?.type).toBe('function')
  })

  it('CONNECT BY PRIOR is tokenized correctly', () => {
    const tokens = tokenize('CONNECT BY PRIOR id = parent_id', 'oracle')
    const types = tokens.filter(t => t.type !== 'whitespace').map(t => t.type)
    expect(types[0]).toBe('keyword') // CONNECT
    expect(types[1]).toBe('keyword') // BY
    expect(types[2]).toBe('keyword') // PRIOR
  })

  it('DBMS_OUTPUT.PUT_LINE is one identifier token (dot is consumed in identifier scan)', () => {
    const tokens = tokenize("DBMS_OUTPUT.PUT_LINE('hi')", 'oracle')
    // the identifier scanner includes '.', so the whole qualified name is one token
    expect(tokens[0].value).toBe('DBMS_OUTPUT.PUT_LINE')
    expect(tokens[0].type).toBe('identifier')
  })
})

describe('tokenize – PostgreSQL full query sequences', () => {
  it('INSERT ... RETURNING id token sequence has RETURNING as keyword', () => {
    const tokens = tokenize('INSERT INTO t VALUES (1) RETURNING id', 'postgres')
    const ret = tokens.find(t => t.value === 'RETURNING')
    expect(ret?.type).toBe('keyword')
  })

  it('ON CONFLICT DO NOTHING — CONFLICT and EXCLUDED are keywords', () => {
    const conflict = tokenize('CONFLICT', 'postgres')[0]
    const excluded = tokenize('EXCLUDED', 'postgres')[0]
    expect(conflict.type).toBe('keyword')
    expect(excluded.type).toBe('keyword')
  })

  it('DO $$ BEGIN END $$ LANGUAGE plpgsql — DO and LANGUAGE are keywords, body is one string token', () => {
    const tokens = tokenize('DO $$ BEGIN END $$ LANGUAGE plpgsql', 'postgres')
    const kws = tokens.filter(t => t.type === 'keyword').map(t => t.value.toUpperCase())
    // BEGIN/END live inside the dollar-quoted string literal — not separate keyword tokens
    expect(kws).toContain('DO')
    expect(kws).toContain('LANGUAGE')
    const stringTokens = tokens.filter(t => t.type === 'string')
    expect(stringTokens).toHaveLength(1)
    expect(stringTokens[0].value).toBe('$$ BEGIN END $$')
  })

  it('GENERATE_SERIES(1,10) — GENERATE_SERIES is a function token', () => {
    const tokens = tokenize('GENERATE_SERIES(1,10)', 'postgres')
    expect(tokens[0]).toEqual({ type: 'function', value: 'GENERATE_SERIES' })
  })

  it('WHERE name ILIKE $1 — ILIKE is a keyword', () => {
    const tokens = tokenize('WHERE name ILIKE $1', 'postgres')
    const ilike = tokens.find(t => t.value === 'ILIKE')
    expect(ilike?.type).toBe('keyword')
  })
})

describe('tokenize – full query token sequence', () => {
  it('SELECT id FROM users produces correct sequence', () => {
    // keyword ws identifier ws keyword ws identifier
    const tokens = tokenize('SELECT id FROM users')
    expect(types(tokens)).toEqual([
      'keyword',    // SELECT
      'whitespace', // space
      'identifier', // id
      'whitespace', // space
      'keyword',    // FROM
      'whitespace', // space
      'identifier', // users
    ])
    expect(values(tokens)).toEqual(['SELECT', ' ', 'id', ' ', 'FROM', ' ', 'users'])
  })

  it('SELECT 1 FROM dual; produces correct sequence', () => {
    const tokens = tokenize('SELECT 1 FROM dual;')
    expect(types(tokens)).toEqual([
      'keyword',    // SELECT
      'whitespace', // space
      'number',     // 1
      'whitespace', // space
      'keyword',    // FROM
      'whitespace', // space
      'identifier', // dual
      'punctuation',// ;
    ])
  })

  it('COUNT(*) produces function, punctuation, operator, punctuation', () => {
    // * is an operator in the tokenizer
    const tokens = tokenize('COUNT(*)')
    expect(types(tokens)).toEqual(['function', 'punctuation', 'operator', 'punctuation'])
  })

  it('WHERE x >= 10 produces keyword, ws, id, ws, operator, ws, number', () => {
    const tokens = tokenize('WHERE x >= 10')
    expect(types(tokens)).toEqual([
      'keyword',    // WHERE
      'whitespace', // space
      'identifier', // x
      'whitespace', // space
      'operator',   // >=
      'whitespace', // space
      'number',     // 10
    ])
  })
})

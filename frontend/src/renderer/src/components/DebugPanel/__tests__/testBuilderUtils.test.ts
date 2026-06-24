import { describe, it, expect } from 'vitest'
import { formatValue, generateBlock } from '../testBuilderUtils'
import type { Param } from '../testBuilderUtils'

// ---------------------------------------------------------------------------
// formatValue
// ---------------------------------------------------------------------------

describe('formatValue – NULL / blank', () => {
  it('empty string returns NULL', () => {
    expect(formatValue('', 'VARCHAR2')).toBe('NULL')
  })

  it('whitespace-only string returns NULL', () => {
    expect(formatValue('   ', 'VARCHAR2')).toBe('NULL')
    expect(formatValue('\t', 'NUMBER')).toBe('NULL')
  })
})

describe('formatValue – numeric types (no quotes)', () => {
  it('NUMBER type with value 42 returns 42 unquoted', () => {
    expect(formatValue('42', 'NUMBER')).toBe('42')
  })

  it('INTEGER type returns value unquoted', () => {
    expect(formatValue('10', 'INTEGER')).toBe('10')
  })

  it('FLOAT type returns value unquoted', () => {
    expect(formatValue('3.14', 'FLOAT')).toBe('3.14')
  })

  it('BINARY_INTEGER type returns value unquoted', () => {
    expect(formatValue('0', 'BINARY_INTEGER')).toBe('0')
  })

  it('PLS_INTEGER type returns value unquoted', () => {
    expect(formatValue('99', 'PLS_INTEGER')).toBe('99')
  })
})

describe('formatValue – BOOLEAN', () => {
  it('true (lowercase) returns TRUE', () => {
    expect(formatValue('true', 'BOOLEAN')).toBe('TRUE')
  })

  it('TRUE (uppercase) returns TRUE', () => {
    expect(formatValue('TRUE', 'BOOLEAN')).toBe('TRUE')
  })

  it('True (mixed case) returns TRUE', () => {
    expect(formatValue('True', 'BOOLEAN')).toBe('TRUE')
  })

  it('false (lowercase) returns FALSE', () => {
    expect(formatValue('false', 'BOOLEAN')).toBe('FALSE')
  })

  it('FALSE (uppercase) returns FALSE', () => {
    expect(formatValue('FALSE', 'BOOLEAN')).toBe('FALSE')
  })

  it('any non-true value returns FALSE', () => {
    expect(formatValue('yes', 'BOOLEAN')).toBe('FALSE')
  })
})

describe('formatValue – DATE', () => {
  it('formats date string with TO_DATE', () => {
    expect(formatValue('2024-01-15', 'DATE')).toBe("TO_DATE('2024-01-15', 'YYYY-MM-DD')")
  })

  it('date value is wrapped as-is inside TO_DATE', () => {
    expect(formatValue('2000-12-31', 'DATE')).toBe("TO_DATE('2000-12-31', 'YYYY-MM-DD')")
  })
})

describe('formatValue – TIMESTAMP', () => {
  it('formats timestamp string with TO_TIMESTAMP', () => {
    expect(formatValue('2024-01-15 10:30:00', 'TIMESTAMP')).toBe(
      "TO_TIMESTAMP('2024-01-15 10:30:00', 'YYYY-MM-DD HH24:MI:SS')"
    )
  })
})

describe('formatValue – VARCHAR2 / default (quoted)', () => {
  it('VARCHAR2 hello returns single-quoted string', () => {
    expect(formatValue('hello', 'VARCHAR2')).toBe("'hello'")
  })

  it("VARCHAR2 with single quote it's is escaped to 'it''s'", () => {
    expect(formatValue("it's", 'VARCHAR2')).toBe("'it''s'")
  })

  it('CHAR type also gets quoted', () => {
    expect(formatValue('X', 'CHAR')).toBe("'X'")
  })

  it('unknown type falls back to quoted string', () => {
    expect(formatValue('hello', 'CLOB')).toBe("'hello'")
  })

  it('multiple single quotes in value are all escaped', () => {
    expect(formatValue("don't stop won't stop", 'VARCHAR2')).toBe("'don''t stop won''t stop'")
  })
})

// ---------------------------------------------------------------------------
// generateBlock
// ---------------------------------------------------------------------------

describe('generateBlock – PROCEDURE with no params', () => {
  it('produces no DECLARE block, just BEGIN…END;/', () => {
    const result = generateBlock('my_proc', 'PROCEDURE', '', [])
    expect(result).toBe('BEGIN\n  my_proc();\nEND;\n/')
  })

  it('does not contain DECLARE', () => {
    const result = generateBlock('my_proc', 'PROCEDURE', '', [])
    expect(result).not.toContain('DECLARE')
  })
})

describe('generateBlock – FUNCTION with no params', () => {
  it('has DECLARE section with v_return VARCHAR2 when no returnType given', () => {
    const result = generateBlock('my_func', 'FUNCTION', '', [])
    expect(result).toContain('DECLARE')
    expect(result).toContain('v_return VARCHAR2;')
  })

  it('calls function as assignment and prints [RETURN]', () => {
    const result = generateBlock('my_func', 'FUNCTION', '', [])
    expect(result).toContain('v_return := my_func();')
    expect(result).toContain("DBMS_OUTPUT.PUT_LINE('[RETURN] = ' || TO_CHAR(v_return));")
  })

  it('ends with END;\\n/', () => {
    const result = generateBlock('my_func', 'FUNCTION', '', [])
    expect(result.endsWith('END;\n/')).toBe(true)
  })
})

describe('generateBlock – FUNCTION with explicit return type', () => {
  it('uses the provided return type for v_return declaration', () => {
    const result = generateBlock('get_count', 'FUNCTION', 'NUMBER', [])
    expect(result).toContain('v_return NUMBER;')
  })

  it('falls back to VARCHAR2 when returnType is empty string', () => {
    const result = generateBlock('get_val', 'FUNCTION', '', [])
    expect(result).toContain('v_return VARCHAR2;')
  })
})

describe('generateBlock – IN param', () => {
  const inParam: Param = { name: 'p_id', direction: 'IN', dataType: 'NUMBER', value: '42' }

  it('IN param with value is initialised in DECLARE', () => {
    const result = generateBlock('my_proc', 'PROCEDURE', '', [inParam])
    expect(result).toContain('DECLARE')
    expect(result).toContain('  p_id NUMBER := 42;')
  })

  it('IN param appears in procedure call', () => {
    const result = generateBlock('my_proc', 'PROCEDURE', '', [inParam])
    expect(result).toContain('my_proc(p_id);')
  })

  it('IN param does NOT generate a DBMS_OUTPUT line after the call', () => {
    const result = generateBlock('my_proc', 'PROCEDURE', '', [inParam])
    expect(result).not.toContain("[p_id]")
  })

  it('IN param with no value is declared without initialiser', () => {
    const noVal: Param = { name: 'p_name', direction: 'IN', dataType: 'VARCHAR2', value: '' }
    const result = generateBlock('my_proc', 'PROCEDURE', '', [noVal])
    expect(result).toContain('  p_name VARCHAR2;')
    expect(result).not.toContain(':=')
  })
})

describe('generateBlock – OUT param', () => {
  const outParam: Param = { name: 'p_result', direction: 'OUT', dataType: 'NUMBER', value: '0' }

  it('OUT param is declared without initialiser even when value is provided', () => {
    const result = generateBlock('my_proc', 'PROCEDURE', '', [outParam])
    expect(result).toContain('  p_result NUMBER;')
    expect(result).not.toContain('p_result NUMBER :=')
  })

  it('OUT param generates a DBMS_OUTPUT line after the call', () => {
    const result = generateBlock('my_proc', 'PROCEDURE', '', [outParam])
    expect(result).toContain("DBMS_OUTPUT.PUT_LINE('[p_result] = ' || TO_CHAR(p_result));")
  })
})

describe('generateBlock – IN OUT param', () => {
  const inOutParam: Param = { name: 'p_val', direction: 'IN OUT', dataType: 'VARCHAR2', value: 'hello' }

  it('IN OUT param is initialised in DECLARE', () => {
    const result = generateBlock('my_proc', 'PROCEDURE', '', [inOutParam])
    expect(result).toContain("  p_val VARCHAR2 := 'hello';")
  })

  it('IN OUT param generates a DBMS_OUTPUT line after the call', () => {
    const result = generateBlock('my_proc', 'PROCEDURE', '', [inOutParam])
    expect(result).toContain("DBMS_OUTPUT.PUT_LINE('[p_val] = ' || TO_CHAR(p_val));")
  })
})

describe('generateBlock – multiple params', () => {
  const params: Param[] = [
    { name: 'p_a', direction: 'IN',  dataType: 'NUMBER',  value: '1' },
    { name: 'p_b', direction: 'IN',  dataType: 'NUMBER',  value: '2' },
    { name: 'p_c', direction: 'OUT', dataType: 'VARCHAR2', value: '' },
  ]

  it('multiple IN params are joined by comma in the call', () => {
    const result = generateBlock('calc', 'PROCEDURE', '', params)
    expect(result).toContain('calc(p_a, p_b, p_c);')
  })

  it('only OUT param gets a DBMS_OUTPUT line', () => {
    const result = generateBlock('calc', 'PROCEDURE', '', params)
    expect(result).toContain("[p_c]")
    expect(result).not.toContain("[p_a]")
    expect(result).not.toContain("[p_b]")
  })
})

describe('generateBlock – package-qualified name', () => {
  it('package.function name is used as-is in the generated block', () => {
    const result = generateBlock('MY_PKG.my_func', 'FUNCTION', 'NUMBER', [])
    expect(result).toContain('v_return := MY_PKG.my_func();')
    expect(result).toContain('v_return NUMBER;')
  })

  it('package.procedure name is used as-is in the call', () => {
    const result = generateBlock('MY_PKG.my_proc', 'PROCEDURE', '', [])
    expect(result).toContain('MY_PKG.my_proc();')
  })
})

describe('generateBlock – overall structure', () => {
  it('block always ends with END;\\n/', () => {
    const result1 = generateBlock('p', 'PROCEDURE', '', [])
    const result2 = generateBlock('f', 'FUNCTION', 'NUMBER', [])
    expect(result1.endsWith('END;\n/')).toBe(true)
    expect(result2.endsWith('END;\n/')).toBe(true)
  })

  it('BEGIN always appears before END;', () => {
    const result = generateBlock('p', 'PROCEDURE', '', [])
    const beginIdx = result.indexOf('BEGIN')
    const endIdx = result.indexOf('END;')
    expect(beginIdx).toBeLessThan(endIdx)
  })
})

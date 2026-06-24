export interface Param {
  name: string
  direction: 'IN' | 'OUT' | 'IN OUT'
  dataType: string
  value: string
}

export function formatValue(value: string, dataType: string): string {
  if (!value.trim()) return 'NULL'
  if (['NUMBER', 'INTEGER', 'FLOAT', 'BINARY_INTEGER', 'PLS_INTEGER'].includes(dataType)) return value
  if (dataType === 'BOOLEAN') return value.toUpperCase() === 'TRUE' ? 'TRUE' : 'FALSE'
  if (dataType === 'DATE') return `TO_DATE('${value}', 'YYYY-MM-DD')`
  if (dataType === 'TIMESTAMP') return `TO_TIMESTAMP('${value}', 'YYYY-MM-DD HH24:MI:SS')`
  return `'${value.replace(/'/g, "''")}'`
}

export function generateBlock(
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

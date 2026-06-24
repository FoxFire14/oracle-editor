package com.oracleeditor.dialect;

/** Shared logic that is the same across all vendors. */
public abstract class AbstractDialect implements DatabaseDialect {

    @Override
    public boolean isQuery(String sql) {
        String upper = sql.toUpperCase().stripLeading();
        return upper.startsWith("SELECT") || upper.startsWith("WITH");
    }

    @Override
    public String classifyStatement(String sql) {
        if (isProceduralBlock(sql)) return "PLSQL";
        String upper = sql.toUpperCase().stripLeading();
        if (upper.startsWith("INSERT"))  return "INSERT";
        if (upper.startsWith("UPDATE"))  return "UPDATE";
        if (upper.startsWith("DELETE"))  return "DELETE";
        if (upper.startsWith("MERGE"))   return "MERGE";
        if (upper.startsWith("CREATE") || upper.startsWith("ALTER")
                || upper.startsWith("DROP") || upper.startsWith("TRUNCATE")) return "DDL";
        return "DML";
    }

    /** Default: no-op (PostgreSQL, SQLite, etc.). */
    @Override
    public void enableOutput(java.sql.Connection conn) throws java.sql.SQLException {}

    /** Default: no output to capture. */
    @Override
    public String captureOutput(java.sql.Connection conn) throws java.sql.SQLException {
        return null;
    }

    /** Default: no extra HikariCP configuration. */
    @Override
    public void configurePool(com.zaxxer.hikari.HikariConfig hc,
                              com.oracleeditor.model.ConnectionConfig config) {}
}

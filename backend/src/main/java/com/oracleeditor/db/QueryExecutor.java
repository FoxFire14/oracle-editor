package com.oracleeditor.db;

import com.oracleeditor.dialect.DatabaseDialect;
import com.oracleeditor.dialect.OracleDialect;
import com.oracleeditor.model.QueryResult;

import java.sql.*;
import java.util.*;

public class QueryExecutor {

    private static final DatabaseDialect ORACLE = new OracleDialect();

    /** Execute using the provided dialect. */
    public static QueryResult execute(Connection conn, String sql,
                                      int maxRows, DatabaseDialect dialect) throws SQLException {
        String prepared = dialect.prepareStatement(sql);
        long start = System.currentTimeMillis();

        if (dialect.isProceduralBlock(prepared)) {
            return executeProcedural(conn, prepared, start);
        }
        if (dialect.isQuery(prepared)) {
            return executeSelect(conn, prepared, maxRows, start);
        }
        return executeDml(conn, prepared, start, dialect);
    }

    /** Convenience overload — defaults to Oracle dialect. */
    public static QueryResult execute(Connection conn, String sql, int maxRows) throws SQLException {
        return execute(conn, sql, maxRows, ORACLE);
    }

    // -------------------------------------------------------------------------

    private static QueryResult executeSelect(Connection conn, String sql,
                                             int maxRows, long start) throws SQLException {
        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setMaxRows(maxRows > 0 ? maxRows : 1000);
            try (ResultSet rs = stmt.executeQuery()) {
                ResultSetMetaData meta = rs.getMetaData();
                int colCount = meta.getColumnCount();
                List<String> columns = new ArrayList<>();
                List<String> columnTypes = new ArrayList<>();
                for (int i = 1; i <= colCount; i++) {
                    columns.add(meta.getColumnName(i));
                    columnTypes.add(meta.getColumnTypeName(i));
                }
                List<Map<String, Object>> rows = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= colCount; i++) {
                        Object val = rs.getObject(i);
                        row.put(columns.get(i - 1), val != null ? val.toString() : null);
                    }
                    rows.add(row);
                }
                return QueryResult.ok(columns, columnTypes, rows,
                        System.currentTimeMillis() - start);
            }
        }
    }

    private static QueryResult executeDml(Connection conn, String sql,
                                          long start, DatabaseDialect dialect) throws SQLException {
        String type = dialect.classifyStatement(sql);
        try (Statement stmt = conn.createStatement()) {
            int affected = stmt.executeUpdate(sql);
            if (!conn.getAutoCommit()) conn.commit();
            return QueryResult.dml(affected, System.currentTimeMillis() - start, type);
        }
    }

    private static QueryResult executeProcedural(Connection conn, String sql,
                                                  long start) throws SQLException {
        try (CallableStatement stmt = conn.prepareCall(sql)) {
            stmt.execute();
            if (!conn.getAutoCommit()) conn.commit();
            return QueryResult.dml(0, System.currentTimeMillis() - start, "PLSQL");
        }
    }
}

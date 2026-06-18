package com.oracleeditor.db;

import com.oracleeditor.model.QueryResult;

import java.sql.*;
import java.util.*;

public class QueryExecutor {

    public static QueryResult execute(Connection conn, String sql, int maxRows) throws SQLException {
        String trimmed = sql.strip();
        // Strip trailing / (SQL*Plus PL/SQL terminator — not valid in JDBC)
        if (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1).strip();
        }
        // Strip trailing semicolon for non-PL/SQL
        if (trimmed.endsWith(";") && !isPlSql(trimmed)) {
            trimmed = trimmed.substring(0, trimmed.length() - 1).strip();
        }

        long start = System.currentTimeMillis();

        if (isPlSql(trimmed)) {
            return executePlSql(conn, trimmed, start);
        }

        String upper = trimmed.toUpperCase();
        if (upper.startsWith("SELECT") || upper.startsWith("WITH")) {
            return executeSelect(conn, trimmed, maxRows, start);
        } else {
            return executeDml(conn, trimmed, start);
        }
    }

    private static QueryResult executeSelect(Connection conn, String sql, int maxRows, long start) throws SQLException {
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
                return QueryResult.ok(columns, columnTypes, rows, System.currentTimeMillis() - start);
            }
        }
    }

    private static QueryResult executeDml(Connection conn, String sql, long start) throws SQLException {
        String upper = sql.toUpperCase().strip();
        String type = "DML";
        if (upper.startsWith("INSERT")) type = "INSERT";
        else if (upper.startsWith("UPDATE")) type = "UPDATE";
        else if (upper.startsWith("DELETE")) type = "DELETE";
        else if (upper.startsWith("CREATE") || upper.startsWith("ALTER") || upper.startsWith("DROP") || upper.startsWith("TRUNCATE")) type = "DDL";

        try (Statement stmt = conn.createStatement()) {
            int affected = stmt.executeUpdate(sql);
            if (!conn.getAutoCommit()) conn.commit();
            return QueryResult.dml(affected, System.currentTimeMillis() - start, type);
        }
    }

    private static QueryResult executePlSql(Connection conn, String sql, long start) throws SQLException {
        try (CallableStatement stmt = conn.prepareCall(sql)) {
            stmt.execute();
            if (!conn.getAutoCommit()) conn.commit();
            return QueryResult.dml(0, System.currentTimeMillis() - start, "PLSQL");
        }
    }

    private static boolean isPlSql(String sql) {
        String upper = sql.toUpperCase().strip();
        return upper.startsWith("BEGIN") || upper.startsWith("DECLARE")
                || upper.startsWith("CREATE OR REPLACE FUNCTION")
                || upper.startsWith("CREATE OR REPLACE PROCEDURE")
                || upper.startsWith("CREATE OR REPLACE PACKAGE")
                || upper.startsWith("CREATE OR REPLACE TRIGGER")
                || upper.startsWith("CREATE FUNCTION")
                || upper.startsWith("CREATE PROCEDURE")
                || upper.startsWith("CREATE PACKAGE")
                || upper.endsWith("/");
    }
}

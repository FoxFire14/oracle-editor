package com.oracleeditor.dialect;

import com.oracleeditor.model.ConnectionConfig;
import com.oracleeditor.model.QueryResult;
import com.zaxxer.hikari.HikariConfig;

import java.sql.*;
import java.util.*;

public class OracleDialect extends AbstractDialect {

    // -------------------------------------------------------------------------
    // Connection
    // -------------------------------------------------------------------------

    @Override
    public String buildJdbcUrl(ConnectionConfig config) {
        if (config.jdbcUrl != null && !config.jdbcUrl.isBlank()) return config.jdbcUrl;
        if (config.tnsAlias != null && !config.tnsAlias.isBlank())
            return "jdbc:oracle:thin:@" + config.tnsAlias;
        return String.format("jdbc:oracle:thin:@//%s:%d/%s",
                config.host, config.port, config.serviceName);
    }

    @Override
    public void configurePool(HikariConfig hc, ConnectionConfig config) {
        if ("SYSDBA".equalsIgnoreCase(config.role))
            hc.addDataSourceProperty("internal_logon", "sysdba");
        else if ("SYSOPER".equalsIgnoreCase(config.role))
            hc.addDataSourceProperty("internal_logon", "sysoper");
    }

    // -------------------------------------------------------------------------
    // Statement processing
    // -------------------------------------------------------------------------

    @Override
    public String prepareStatement(String sql) {
        String s = sql.strip();
        // Strip SQL*Plus block terminator
        if (s.endsWith("/")) s = s.substring(0, s.length() - 1).strip();
        // Strip trailing semicolon only for plain SQL (PL/SQL may end with END;)
        if (s.endsWith(";") && !isProceduralBlock(s))
            s = s.substring(0, s.length() - 1).strip();
        return s;
    }

    @Override
    public boolean isProceduralBlock(String sql) {
        String u = sql.toUpperCase().stripLeading();
        return u.startsWith("BEGIN") || u.startsWith("DECLARE")
                || u.startsWith("CREATE OR REPLACE FUNCTION")
                || u.startsWith("CREATE OR REPLACE PROCEDURE")
                || u.startsWith("CREATE OR REPLACE PACKAGE")
                || u.startsWith("CREATE OR REPLACE TRIGGER")
                || u.startsWith("CREATE OR REPLACE TYPE")
                || u.startsWith("CREATE FUNCTION")
                || u.startsWith("CREATE PROCEDURE")
                || u.startsWith("CREATE PACKAGE")
                || u.startsWith("CREATE TRIGGER")
                || u.endsWith("/");
    }

    // -------------------------------------------------------------------------
    // Schema queries
    // -------------------------------------------------------------------------

    @Override
    public String ownersQuery() {
        return "SELECT DISTINCT OWNER FROM ALL_OBJECTS ORDER BY OWNER";
    }

    @Override
    public String objectTypesQuery(String owner) {
        return "SELECT DISTINCT OBJECT_TYPE FROM ALL_OBJECTS WHERE OWNER='"
                + owner + "' ORDER BY OBJECT_TYPE";
    }

    @Override
    public String objectsQuery(String owner, String type) {
        return "SELECT OBJECT_NAME, STATUS, LAST_DDL_TIME FROM ALL_OBJECTS "
                + "WHERE OWNER='" + owner + "' AND OBJECT_TYPE='" + type
                + "' ORDER BY OBJECT_NAME";
    }

    @Override
    public String columnsQuery(String owner, String table) {
        return "SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_PRECISION, "
                + "DATA_SCALE, NULLABLE, DATA_DEFAULT "
                + "FROM ALL_TAB_COLUMNS WHERE OWNER='" + owner
                + "' AND TABLE_NAME='" + table + "' ORDER BY COLUMN_ID";
    }

    @Override
    public String indexesQuery(String owner, String table) {
        return "SELECT i.INDEX_NAME, i.INDEX_TYPE, i.UNIQUENESS, "
                + "ic.COLUMN_NAME, ic.COLUMN_POSITION "
                + "FROM ALL_INDEXES i JOIN ALL_IND_COLUMNS ic "
                + "ON i.INDEX_NAME=ic.INDEX_NAME AND i.OWNER=ic.INDEX_OWNER "
                + "WHERE i.TABLE_OWNER='" + owner + "' AND i.TABLE_NAME='"
                + table + "' ORDER BY i.INDEX_NAME, ic.COLUMN_POSITION";
    }

    @Override
    public String constraintsQuery(String owner, String table) {
        return "SELECT c.CONSTRAINT_NAME, c.CONSTRAINT_TYPE, c.STATUS, "
                + "c.VALIDATED, cc.COLUMN_NAME, c.R_CONSTRAINT_NAME, c.SEARCH_CONDITION "
                + "FROM ALL_CONSTRAINTS c "
                + "LEFT JOIN ALL_CONS_COLUMNS cc "
                + "ON c.CONSTRAINT_NAME=cc.CONSTRAINT_NAME AND c.OWNER=cc.OWNER "
                + "WHERE c.OWNER='" + owner + "' AND c.TABLE_NAME='"
                + table + "' ORDER BY c.CONSTRAINT_NAME";
    }

    @Override
    public String ddlQuery(String owner, String type, String name) {
        return "SELECT DBMS_METADATA.GET_DDL('" + type + "','" + name
                + "','" + owner + "') AS DDL FROM DUAL";
    }

    @Override
    public String callableObjectsQuery() {
        return "SELECT OBJECT_NAME AS NAME, OBJECT_TYPE AS TYPE, NULL AS PACKAGE_NAME "
                + "FROM USER_OBJECTS WHERE OBJECT_TYPE IN ('FUNCTION','PROCEDURE') "
                + "UNION ALL "
                + "SELECT PROCEDURE_NAME, 'PACKAGE_MEMBER', OBJECT_NAME "
                + "FROM USER_PROCEDURES WHERE PROCEDURE_NAME IS NOT NULL "
                + "ORDER BY PACKAGE_NAME NULLS FIRST, NAME";
    }

    @Override
    public String callableParamsQuery(String name, String pkg) {
        String pkgClause = (pkg != null && !pkg.isBlank())
                ? "AND PACKAGE_NAME = '" + pkg.toUpperCase() + "'"
                : "AND PACKAGE_NAME IS NULL";
        return "SELECT ARGUMENT_NAME, POSITION, IN_OUT, DATA_TYPE "
                + "FROM USER_ARGUMENTS "
                + "WHERE OBJECT_NAME='" + name.toUpperCase() + "' " + pkgClause
                + " ORDER BY POSITION";
    }

    // -------------------------------------------------------------------------
    // Explain plan
    // -------------------------------------------------------------------------

    @Override
    public QueryResult explainPlan(Connection conn, String sql) throws SQLException {
        conn.createStatement().execute("EXPLAIN PLAN FOR " + sql);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY)")) {
            ps.setMaxRows(500);
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData meta = rs.getMetaData();
                List<String> cols = List.of(meta.getColumnName(1));
                List<String> types = List.of(meta.getColumnTypeName(1));
                List<Map<String, Object>> rows = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put(cols.get(0), rs.getString(1));
                    rows.add(row);
                }
                return QueryResult.ok(cols, types, rows, 0);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Output capture
    // -------------------------------------------------------------------------

    @Override
    public void enableOutput(Connection conn) throws SQLException {
        try (Statement st = conn.createStatement()) {
            st.execute("BEGIN DBMS_OUTPUT.ENABLE(1000000); END;");
        }
    }

    @Override
    public String captureOutput(Connection conn) throws SQLException {
        StringBuilder sb = new StringBuilder();
        try (CallableStatement cs = conn.prepareCall(
                "BEGIN DBMS_OUTPUT.GET_LINE(:l, :s); END;")) {
            for (int i = 0; i < 10_000; i++) {
                cs.registerOutParameter(1, Types.VARCHAR);
                cs.registerOutParameter(2, Types.INTEGER);
                cs.execute();
                if (cs.getInt(2) != 0) break;
                String line = cs.getString(1);
                if (line != null) sb.append(line).append('\n');
            }
        } catch (Exception ignored) {}
        return sb.isEmpty() ? null : sb.toString().stripTrailing();
    }

    // -------------------------------------------------------------------------
    // Display
    // -------------------------------------------------------------------------

    @Override
    public String displayName() { return "Oracle"; }
}

package com.oracleeditor.dialect;

import com.oracleeditor.model.ConnectionConfig;
import com.oracleeditor.model.QueryResult;

import java.sql.*;
import java.util.*;

public class PostgresDialect extends AbstractDialect {

    // -------------------------------------------------------------------------
    // Connection
    // -------------------------------------------------------------------------

    @Override
    public String buildJdbcUrl(ConnectionConfig config) {
        if (config.jdbcUrl != null && !config.jdbcUrl.isBlank()) return config.jdbcUrl;
        int port = config.port > 0 ? config.port : 5432;
        String db = (config.serviceName != null && !config.serviceName.isBlank())
                ? config.serviceName : config.host;
        return String.format("jdbc:postgresql://%s:%d/%s", config.host, port, db);
    }

    // -------------------------------------------------------------------------
    // Statement processing
    // -------------------------------------------------------------------------

    @Override
    public String prepareStatement(String sql) {
        String s = sql.strip();
        // PostgreSQL accepts trailing semicolons fine, but strip for cleanliness
        if (s.endsWith(";") && !isProceduralBlock(s))
            s = s.substring(0, s.length() - 1).strip();
        return s;
    }

    @Override
    public boolean isProceduralBlock(String sql) {
        String u = sql.toUpperCase().stripLeading();
        return u.startsWith("DO")
                || u.startsWith("CREATE OR REPLACE FUNCTION")
                || u.startsWith("CREATE OR REPLACE PROCEDURE")
                || u.startsWith("CREATE FUNCTION")
                || u.startsWith("CREATE PROCEDURE");
    }

    // -------------------------------------------------------------------------
    // Schema queries  (information_schema / pg_catalog)
    // -------------------------------------------------------------------------

    @Override
    public String ownersQuery() {
        return "SELECT schema_name AS OWNER FROM information_schema.schemata "
                + "WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') "
                + "ORDER BY schema_name";
    }

    @Override
    public String objectTypesQuery(String owner) {
        return "SELECT DISTINCT 'TABLE' AS OBJECT_TYPE FROM information_schema.tables "
                + "WHERE table_schema='" + owner + "' AND table_type='BASE TABLE' "
                + "UNION SELECT DISTINCT 'VIEW' FROM information_schema.views "
                + "WHERE table_schema='" + owner + "' "
                + "UNION SELECT DISTINCT 'FUNCTION' FROM information_schema.routines "
                + "WHERE routine_schema='" + owner + "' AND routine_type='FUNCTION' "
                + "UNION SELECT DISTINCT 'PROCEDURE' FROM information_schema.routines "
                + "WHERE routine_schema='" + owner + "' AND routine_type='PROCEDURE' "
                + "ORDER BY OBJECT_TYPE";
    }

    @Override
    public String objectsQuery(String owner, String type) {
        return switch (type.toUpperCase()) {
            case "TABLE" ->
                "SELECT table_name AS OBJECT_NAME, 'VALID' AS STATUS, NULL AS LAST_DDL_TIME "
                + "FROM information_schema.tables "
                + "WHERE table_schema='" + owner + "' AND table_type='BASE TABLE' "
                + "ORDER BY table_name";
            case "VIEW" ->
                "SELECT table_name AS OBJECT_NAME, 'VALID' AS STATUS, NULL AS LAST_DDL_TIME "
                + "FROM information_schema.views "
                + "WHERE table_schema='" + owner + "' ORDER BY table_name";
            case "FUNCTION" ->
                "SELECT routine_name AS OBJECT_NAME, 'VALID' AS STATUS, NULL AS LAST_DDL_TIME "
                + "FROM information_schema.routines "
                + "WHERE routine_schema='" + owner + "' AND routine_type='FUNCTION' "
                + "ORDER BY routine_name";
            case "PROCEDURE" ->
                "SELECT routine_name AS OBJECT_NAME, 'VALID' AS STATUS, NULL AS LAST_DDL_TIME "
                + "FROM information_schema.routines "
                + "WHERE routine_schema='" + owner + "' AND routine_type='PROCEDURE' "
                + "ORDER BY routine_name";
            default ->
                "SELECT routine_name AS OBJECT_NAME, 'VALID' AS STATUS, NULL AS LAST_DDL_TIME "
                + "FROM information_schema.routines WHERE routine_schema='" + owner + "'";
        };
    }

    @Override
    public String columnsQuery(String owner, String table) {
        return "SELECT column_name AS COLUMN_NAME, data_type AS DATA_TYPE, "
                + "character_maximum_length AS DATA_LENGTH, numeric_precision AS DATA_PRECISION, "
                + "numeric_scale AS DATA_SCALE, is_nullable AS NULLABLE, column_default AS DATA_DEFAULT "
                + "FROM information_schema.columns "
                + "WHERE table_schema='" + owner + "' AND table_name='" + table
                + "' ORDER BY ordinal_position";
    }

    @Override
    public String indexesQuery(String owner, String table) {
        return "SELECT i.relname AS INDEX_NAME, "
                + "CASE WHEN ix.indisunique THEN 'UNIQUE' ELSE 'NONUNIQUE' END AS UNIQUENESS, "
                + "a.attname AS COLUMN_NAME "
                + "FROM pg_class t "
                + "JOIN pg_index ix ON t.oid = ix.indrelid "
                + "JOIN pg_class i ON i.oid = ix.indexrelid "
                + "JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey) "
                + "JOIN pg_namespace n ON n.oid = t.relnamespace "
                + "WHERE n.nspname='" + owner + "' AND t.relname='" + table
                + "' ORDER BY i.relname, a.attnum";
    }

    @Override
    public String constraintsQuery(String owner, String table) {
        return "SELECT tc.constraint_name AS CONSTRAINT_NAME, "
                + "tc.constraint_type AS CONSTRAINT_TYPE, "
                + "'ENABLED' AS STATUS, 'VALIDATED' AS VALIDATED, "
                + "kcu.column_name AS COLUMN_NAME, "
                + "ccu.table_name AS R_TABLE_NAME, NULL AS SEARCH_CONDITION "
                + "FROM information_schema.table_constraints tc "
                + "LEFT JOIN information_schema.key_column_usage kcu "
                + "ON tc.constraint_name=kcu.constraint_name "
                + "AND tc.table_schema=kcu.table_schema "
                + "LEFT JOIN information_schema.referential_constraints rc "
                + "ON tc.constraint_name=rc.constraint_name "
                + "LEFT JOIN information_schema.constraint_column_usage ccu "
                + "ON rc.unique_constraint_name=ccu.constraint_name "
                + "WHERE tc.table_schema='" + owner + "' AND tc.table_name='"
                + table + "' ORDER BY tc.constraint_name";
    }

    @Override
    public String ddlQuery(String owner, String type, String name) {
        // PostgreSQL has pg_get_functiondef for functions; no universal DDL function
        return switch (type.toUpperCase()) {
            case "FUNCTION", "PROCEDURE" ->
                "SELECT pg_get_functiondef(oid) AS DDL FROM pg_proc "
                + "WHERE proname='" + name.toLowerCase() + "' LIMIT 1";
            case "VIEW" ->
                "SELECT 'CREATE OR REPLACE VIEW ' || table_name || ' AS ' || view_definition AS DDL "
                + "FROM information_schema.views "
                + "WHERE table_schema='" + owner + "' AND table_name='" + name.toLowerCase() + "'";
            default ->
                "SELECT 'DDL not available for " + type + " in PostgreSQL' AS DDL FROM information_schema.tables LIMIT 1";
        };
    }

    @Override
    public String callableObjectsQuery() {
        return "SELECT routine_name AS NAME, routine_type AS TYPE, routine_schema AS PACKAGE_NAME "
                + "FROM information_schema.routines "
                + "WHERE routine_schema NOT IN ('pg_catalog','information_schema') "
                + "ORDER BY routine_schema, routine_name";
    }

    @Override
    public String callableParamsQuery(String name, String pkg) {
        String schemaClause = (pkg != null && !pkg.isBlank())
                ? "AND r.routine_schema='" + pkg.toLowerCase() + "'"
                : "";
        return "SELECT p.parameter_name AS ARGUMENT_NAME, p.ordinal_position AS POSITION, "
                + "p.parameter_mode AS IN_OUT, p.data_type AS DATA_TYPE "
                + "FROM information_schema.parameters p "
                + "JOIN information_schema.routines r "
                + "ON p.specific_name=r.specific_name AND p.specific_schema=r.specific_schema "
                + "WHERE r.routine_name='" + name.toLowerCase() + "' " + schemaClause
                + " ORDER BY p.ordinal_position";
    }

    // -------------------------------------------------------------------------
    // Explain plan
    // -------------------------------------------------------------------------

    @Override
    public QueryResult explainPlan(Connection conn, String sql) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("EXPLAIN ANALYZE " + sql);
             ResultSet rs = ps.executeQuery()) {
            List<String> cols = List.of("QUERY PLAN");
            List<String> types = List.of("text");
            List<Map<String, Object>> rows = new ArrayList<>();
            while (rs.next()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("QUERY PLAN", rs.getString(1));
                rows.add(row);
            }
            return QueryResult.ok(cols, types, rows, 0);
        }
    }

    // -------------------------------------------------------------------------
    // Output capture  (PostgreSQL uses connection warnings for RAISE NOTICE)
    // -------------------------------------------------------------------------

    @Override
    public String captureOutput(Connection conn) throws SQLException {
        SQLWarning warning = conn.getWarnings();
        if (warning == null) return null;
        StringBuilder sb = new StringBuilder();
        while (warning != null) {
            sb.append(warning.getMessage()).append('\n');
            warning = warning.getNextWarning();
        }
        conn.clearWarnings();
        return sb.toString().stripTrailing();
    }

    // -------------------------------------------------------------------------
    // Display
    // -------------------------------------------------------------------------

    @Override
    public String displayName() { return "PostgreSQL"; }
}

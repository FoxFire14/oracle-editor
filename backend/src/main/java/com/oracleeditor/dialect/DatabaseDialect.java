package com.oracleeditor.dialect;

import com.oracleeditor.model.ConnectionConfig;
import com.oracleeditor.model.QueryResult;

import java.sql.Connection;
import java.sql.SQLException;

/**
 * Encapsulates everything that varies between database vendors:
 * JDBC URL format, SQL dialect, system catalog queries, and output capture.
 */
public interface DatabaseDialect {

    // -------------------------------------------------------------------------
    // Connection
    // -------------------------------------------------------------------------

    /** Builds the JDBC URL from a connection config. */
    String buildJdbcUrl(ConnectionConfig config);

    /** Applies any extra HikariCP properties (e.g. Oracle roles). */
    default void configurePool(com.zaxxer.hikari.HikariConfig hc, ConnectionConfig config) {}

    // -------------------------------------------------------------------------
    // Statement processing
    // -------------------------------------------------------------------------

    /**
     * Strips vendor-specific terminators (Oracle `/`, trailing `;` for non-PL/SQL, etc.)
     * so the statement is safe to hand to JDBC.
     */
    String prepareStatement(String sql);

    /** Returns true if the statement is a procedural block (PL/SQL, DO $$, etc.). */
    boolean isProceduralBlock(String sql);

    /** Returns true if the statement produces a ResultSet. */
    boolean isQuery(String sql);

    /**
     * Classifies a DML/DDL statement for display purposes.
     * Returns INSERT, UPDATE, DELETE, DDL, DML, or PLSQL.
     */
    String classifyStatement(String sql);

    // -------------------------------------------------------------------------
    // Schema browser queries
    // All methods return a SQL string ready to pass to QueryExecutor.execute().
    // -------------------------------------------------------------------------

    String ownersQuery();
    String objectTypesQuery(String owner);
    String objectsQuery(String owner, String type);
    String columnsQuery(String owner, String table);
    String indexesQuery(String owner, String table);
    String constraintsQuery(String owner, String table);
    String ddlQuery(String owner, String type, String name);
    String callableObjectsQuery();
    String callableParamsQuery(String name, String pkg);

    // -------------------------------------------------------------------------
    // Explain plan
    // -------------------------------------------------------------------------

    /** Executes an explain plan and returns the result directly. */
    QueryResult explainPlan(Connection conn, String sql) throws SQLException;

    // -------------------------------------------------------------------------
    // Procedural output capture (DBMS_OUTPUT / warnings)
    // -------------------------------------------------------------------------

    /** Called before each procedural execution to enable output buffering. */
    void enableOutput(Connection conn) throws SQLException;

    /**
     * Called after execution to drain buffered output lines.
     * Returns null if there is no output.
     */
    String captureOutput(Connection conn) throws SQLException;

    // -------------------------------------------------------------------------
    // Display
    // -------------------------------------------------------------------------

    String displayName();
}

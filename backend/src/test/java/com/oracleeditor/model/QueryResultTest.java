package com.oracleeditor.model;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class QueryResultTest {

    @Test
    void ok_setsSuccessTrueAndSelectFields() {
        List<String> columns = List.of("ID", "NAME");
        List<String> columnTypes = List.of("NUMBER", "VARCHAR2");
        List<Map<String, Object>> rows = List.of(
                Map.of("ID", "1", "NAME", "Alice"),
                Map.of("ID", "2", "NAME", "Bob")
        );
        long ms = 42L;

        QueryResult result = QueryResult.ok(columns, columnTypes, rows, ms);

        assertTrue(result.success);
        assertNull(result.error);
        assertEquals(columns, result.columns);
        assertEquals(columnTypes, result.columnTypes);
        assertEquals(rows, result.rows);
        assertEquals(ms, result.executionTimeMs);
        assertEquals("SELECT", result.statementType);
        assertEquals(0, result.rowsAffected);
    }

    @Test
    void ok_withEmptyRows_returnsEmptyList() {
        QueryResult result = QueryResult.ok(List.of(), List.of(), List.of(), 0L);

        assertTrue(result.success);
        assertNotNull(result.rows);
        assertTrue(result.rows.isEmpty());
        assertNotNull(result.columns);
        assertTrue(result.columns.isEmpty());
        assertEquals("SELECT", result.statementType);
    }

    @Test
    void dml_insert_setsRowsAffectedAndStatementType() {
        QueryResult result = QueryResult.dml(5, 100L, "INSERT");

        assertTrue(result.success);
        assertNull(result.error);
        assertEquals(5, result.rowsAffected);
        assertEquals(100L, result.executionTimeMs);
        assertEquals("INSERT", result.statementType);
        assertNull(result.columns);
        assertNull(result.rows);
    }

    @Test
    void dml_update_setsStatementTypeUpdate() {
        QueryResult result = QueryResult.dml(3, 50L, "UPDATE");

        assertTrue(result.success);
        assertEquals(3, result.rowsAffected);
        assertEquals("UPDATE", result.statementType);
    }

    @Test
    void dml_delete_setsStatementTypeDelete() {
        QueryResult result = QueryResult.dml(1, 10L, "DELETE");

        assertTrue(result.success);
        assertEquals(1, result.rowsAffected);
        assertEquals("DELETE", result.statementType);
    }

    @Test
    void dml_ddl_setsStatementTypeDdl() {
        QueryResult result = QueryResult.dml(0, 200L, "DDL");

        assertTrue(result.success);
        assertEquals(0, result.rowsAffected);
        assertEquals("DDL", result.statementType);
    }

    @Test
    void dml_plsql_setsStatementTypePlsql() {
        QueryResult result = QueryResult.dml(0, 15L, "PLSQL");

        assertTrue(result.success);
        assertEquals(0, result.rowsAffected);
        assertEquals("PLSQL", result.statementType);
    }

    @Test
    void error_setsSuccessFalseAndMessage() {
        String message = "ORA-00942: table or view does not exist";

        QueryResult result = QueryResult.error(message);

        assertFalse(result.success);
        assertEquals(message, result.error);
        assertNull(result.columns);
        assertNull(result.rows);
        assertEquals(0, result.rowsAffected);
        assertEquals(0L, result.executionTimeMs);
    }

    @Test
    void error_withNullMessage_succeeds() {
        QueryResult result = QueryResult.error(null);

        assertFalse(result.success);
        assertNull(result.error);
    }
}

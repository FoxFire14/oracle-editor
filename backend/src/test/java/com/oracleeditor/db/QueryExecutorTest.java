package com.oracleeditor.db;

import com.oracleeditor.model.QueryResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.sql.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QueryExecutorTest {

    @Mock Connection conn;
    @Mock PreparedStatement preparedStatement;
    @Mock CallableStatement callableStatement;
    @Mock Statement statement;
    @Mock ResultSet resultSet;
    @Mock ResultSetMetaData metaData;

    // -------------------------------------------------------------------------
    // SELECT
    // -------------------------------------------------------------------------

    @Test
    void select_returnsRowsAndColumns() throws SQLException {
        when(conn.prepareStatement(anyString())).thenReturn(preparedStatement);
        when(preparedStatement.executeQuery()).thenReturn(resultSet);
        when(resultSet.getMetaData()).thenReturn(metaData);
        when(metaData.getColumnCount()).thenReturn(2);
        when(metaData.getColumnName(1)).thenReturn("ID");
        when(metaData.getColumnName(2)).thenReturn("NAME");
        when(metaData.getColumnTypeName(1)).thenReturn("NUMBER");
        when(metaData.getColumnTypeName(2)).thenReturn("VARCHAR2");
        // Two rows then done
        when(resultSet.next()).thenReturn(true, true, false);
        when(resultSet.getObject(1)).thenReturn(1, 2);
        when(resultSet.getObject(2)).thenReturn("Alice", "Bob");

        QueryResult result = QueryExecutor.execute(conn, "SELECT ID, NAME FROM USERS", 100);

        assertTrue(result.success);
        assertEquals("SELECT", result.statementType);
        assertEquals(2, result.columns.size());
        assertEquals("ID", result.columns.get(0));
        assertEquals("NAME", result.columns.get(1));
        assertEquals(2, result.rows.size());
        assertEquals("1", result.rows.get(0).get("ID"));
        assertEquals("Alice", result.rows.get(0).get("NAME"));
        assertEquals("2", result.rows.get(1).get("ID"));
        assertEquals("Bob", result.rows.get(1).get("NAME"));
    }

    @Test
    void select_withNullValue_mapsToNull() throws SQLException {
        when(conn.prepareStatement(anyString())).thenReturn(preparedStatement);
        when(preparedStatement.executeQuery()).thenReturn(resultSet);
        when(resultSet.getMetaData()).thenReturn(metaData);
        when(metaData.getColumnCount()).thenReturn(1);
        when(metaData.getColumnName(1)).thenReturn("VAL");
        when(metaData.getColumnTypeName(1)).thenReturn("VARCHAR2");
        when(resultSet.next()).thenReturn(true, false);
        when(resultSet.getObject(1)).thenReturn(null);

        QueryResult result = QueryExecutor.execute(conn, "SELECT VAL FROM T", 10);

        assertTrue(result.success);
        assertNull(result.rows.get(0).get("VAL"));
    }

    @Test
    void select_doesNotCallCommit_whenAutoCommitFalse() throws SQLException {
        when(conn.prepareStatement(anyString())).thenReturn(preparedStatement);
        when(preparedStatement.executeQuery()).thenReturn(resultSet);
        when(resultSet.getMetaData()).thenReturn(metaData);
        when(metaData.getColumnCount()).thenReturn(0);
        when(resultSet.next()).thenReturn(false);

        QueryExecutor.execute(conn, "SELECT 1 FROM DUAL", 10);

        verify(conn, never()).commit();
    }

    @Test
    void select_trailingSemicolonStripped() throws SQLException {
        when(conn.prepareStatement("SELECT 1 FROM DUAL")).thenReturn(preparedStatement);
        when(preparedStatement.executeQuery()).thenReturn(resultSet);
        when(resultSet.getMetaData()).thenReturn(metaData);
        when(metaData.getColumnCount()).thenReturn(0);
        when(resultSet.next()).thenReturn(false);

        QueryResult result = QueryExecutor.execute(conn, "SELECT 1 FROM DUAL;", 10);

        assertTrue(result.success);
        // Verify the semicolon was stripped by checking prepareStatement was called without it
        verify(conn).prepareStatement("SELECT 1 FROM DUAL");
    }

    @Test
    void select_withPrefix_works() throws SQLException {
        when(conn.prepareStatement(anyString())).thenReturn(preparedStatement);
        when(preparedStatement.executeQuery()).thenReturn(resultSet);
        when(resultSet.getMetaData()).thenReturn(metaData);
        when(metaData.getColumnCount()).thenReturn(0);
        when(resultSet.next()).thenReturn(false);

        QueryResult result = QueryExecutor.execute(conn, "WITH cte AS (SELECT 1 FROM DUAL) SELECT * FROM cte", 10);

        assertTrue(result.success);
        assertEquals("SELECT", result.statementType);
    }

    // -------------------------------------------------------------------------
    // DML
    // -------------------------------------------------------------------------

    @Test
    void insert_returnsRowsAffectedAndCorrectType() throws SQLException {
        when(conn.createStatement()).thenReturn(statement);
        when(statement.executeUpdate(anyString())).thenReturn(3);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryResult result = QueryExecutor.execute(conn, "INSERT INTO T VALUES (1)", 0);

        assertTrue(result.success);
        assertEquals(3, result.rowsAffected);
        assertEquals("INSERT", result.statementType);
    }

    @Test
    void update_setsStatementTypeUpdate() throws SQLException {
        when(conn.createStatement()).thenReturn(statement);
        when(statement.executeUpdate(anyString())).thenReturn(2);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryResult result = QueryExecutor.execute(conn, "UPDATE T SET COL=1 WHERE ID=1", 0);

        assertTrue(result.success);
        assertEquals(2, result.rowsAffected);
        assertEquals("UPDATE", result.statementType);
    }

    @Test
    void delete_setsStatementTypeDelete() throws SQLException {
        when(conn.createStatement()).thenReturn(statement);
        when(statement.executeUpdate(anyString())).thenReturn(1);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryResult result = QueryExecutor.execute(conn, "DELETE FROM T WHERE ID=1", 0);

        assertTrue(result.success);
        assertEquals(1, result.rowsAffected);
        assertEquals("DELETE", result.statementType);
    }

    @Test
    void createTable_setsStatementTypeDdl() throws SQLException {
        when(conn.createStatement()).thenReturn(statement);
        when(statement.executeUpdate(anyString())).thenReturn(0);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryResult result = QueryExecutor.execute(conn, "CREATE TABLE T (ID NUMBER)", 0);

        assertTrue(result.success);
        assertEquals(0, result.rowsAffected);
        assertEquals("DDL", result.statementType);
    }

    @Test
    void alterTable_setsStatementTypeDdl() throws SQLException {
        when(conn.createStatement()).thenReturn(statement);
        when(statement.executeUpdate(anyString())).thenReturn(0);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryResult result = QueryExecutor.execute(conn, "ALTER TABLE T ADD COL VARCHAR2(50)", 0);

        assertTrue(result.success);
        assertEquals("DDL", result.statementType);
    }

    @Test
    void dropTable_setsStatementTypeDdl() throws SQLException {
        when(conn.createStatement()).thenReturn(statement);
        when(statement.executeUpdate(anyString())).thenReturn(0);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryResult result = QueryExecutor.execute(conn, "DROP TABLE T", 0);

        assertTrue(result.success);
        assertEquals("DDL", result.statementType);
    }

    @Test
    void dml_autoCommitFalse_callsCommit() throws SQLException {
        when(conn.createStatement()).thenReturn(statement);
        when(statement.executeUpdate(anyString())).thenReturn(1);
        when(conn.getAutoCommit()).thenReturn(false);

        QueryExecutor.execute(conn, "INSERT INTO T VALUES (1)", 0);

        verify(conn).commit();
    }

    @Test
    void dml_autoCommitTrue_doesNotCallCommit() throws SQLException {
        when(conn.createStatement()).thenReturn(statement);
        when(statement.executeUpdate(anyString())).thenReturn(1);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryExecutor.execute(conn, "INSERT INTO T VALUES (1)", 0);

        verify(conn, never()).commit();
    }

    // -------------------------------------------------------------------------
    // PL/SQL
    // -------------------------------------------------------------------------

    @Test
    void plsql_beginBlock_usesCallableStatement() throws SQLException {
        when(conn.prepareCall(anyString())).thenReturn(callableStatement);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryResult result = QueryExecutor.execute(conn, "BEGIN NULL; END;", 0);

        assertTrue(result.success);
        assertEquals("PLSQL", result.statementType);
        verify(conn).prepareCall("BEGIN NULL; END;");
        verify(callableStatement).execute();
    }

    @Test
    void plsql_declareBlock_recognizedAsPlSql() throws SQLException {
        when(conn.prepareCall(anyString())).thenReturn(callableStatement);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryResult result = QueryExecutor.execute(conn, "DECLARE v NUMBER; BEGIN v := 1; END;", 0);

        assertTrue(result.success);
        assertEquals("PLSQL", result.statementType);
        verify(callableStatement).execute();
    }

    @Test
    void plsql_trailingSlashStripped() throws SQLException {
        String expectedSql = "BEGIN NULL; END;";
        when(conn.prepareCall(expectedSql)).thenReturn(callableStatement);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryResult result = QueryExecutor.execute(conn, "BEGIN NULL; END;\n/", 0);

        assertTrue(result.success);
        assertEquals("PLSQL", result.statementType);
        verify(conn).prepareCall(expectedSql);
    }

    @Test
    void plsql_autoCommitFalse_callsCommit() throws SQLException {
        when(conn.prepareCall(anyString())).thenReturn(callableStatement);
        when(conn.getAutoCommit()).thenReturn(false);

        QueryExecutor.execute(conn, "BEGIN NULL; END;", 0);

        verify(conn).commit();
    }

    @Test
    void plsql_autoCommitTrue_doesNotCallCommit() throws SQLException {
        when(conn.prepareCall(anyString())).thenReturn(callableStatement);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryExecutor.execute(conn, "BEGIN NULL; END;", 0);

        verify(conn, never()).commit();
    }

    @Test
    void plsql_createOrReplaceProcedure_recognizedAsPlSql() throws SQLException {
        when(conn.prepareCall(anyString())).thenReturn(callableStatement);
        when(conn.getAutoCommit()).thenReturn(true);

        QueryResult result = QueryExecutor.execute(conn,
                "CREATE OR REPLACE PROCEDURE my_proc AS BEGIN NULL; END;", 0);

        assertTrue(result.success);
        assertEquals("PLSQL", result.statementType);
    }
}

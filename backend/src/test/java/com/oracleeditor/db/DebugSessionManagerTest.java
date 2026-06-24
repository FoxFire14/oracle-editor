package com.oracleeditor.db;

import com.oracleeditor.dialect.OracleDialect;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DebugSessionManagerTest {

    @Mock Connection mockConn;

    private DebugSessionManager manager;
    private final OracleDialect dialect = new OracleDialect();

    @BeforeEach
    void setUp() { manager = new DebugSessionManager(); }

    private void inject(String sessionId, String connId) {
        inject(sessionId, connId, new ArrayList<>());
    }

    private void inject(String sessionId, String connId, List<DebugSessionManager.LogEntry> log) {
        manager.injectSession(new DebugSessionManager.DebugSession(
                sessionId, connId, mockConn, log, dialect));
    }

    // -------------------------------------------------------------------------
    // listSessions()
    // -------------------------------------------------------------------------

    @Test
    void listSessions_emptyManager_returnsEmptyList() {
        assertTrue(manager.listSessions().isEmpty());
    }

    @Test
    void listSessions_withInjectedSession_returnsCorrectCount() {
        inject("sess-1", "conn-A");
        assertEquals(1, manager.listSessions().size());
    }

    @Test
    void listSessions_withInjectedSession_returnsCorrectIds() {
        inject("sess-1", "conn-A");
        Map<String, Object> entry = manager.listSessions().get(0);
        assertEquals("conn-A", entry.get("connectionId"));
        assertEquals("sess-1", entry.get("sessionId"));
    }

    @Test
    void listSessions_withMultipleSessions_returnsCorrectCount() {
        inject("sess-1", "conn-A");
        inject("sess-2", "conn-B");
        assertEquals(2, manager.listSessions().size());
    }

    @Test
    void listSessions_logCountReflectsLogEntries() {
        List<DebugSessionManager.LogEntry> log = new ArrayList<>();
        log.add(new DebugSessionManager.LogEntry("SELECT 1 FROM DUAL", true, "ok", 5));
        inject("sess-1", "conn-A", log);
        assertEquals(1, manager.listSessions().get(0).get("logCount"));
    }

    // -------------------------------------------------------------------------
    // commit()
    // -------------------------------------------------------------------------

    @Test
    void commit_callsConnectionCommit() throws SQLException {
        inject("sess-1", "conn-A");
        manager.commit("sess-1");
        verify(mockConn).commit();
    }

    @Test
    void commit_addsLogEntry() throws SQLException {
        List<DebugSessionManager.LogEntry> log = new ArrayList<>();
        inject("sess-1", "conn-A", log);
        manager.commit("sess-1");
        assertEquals(1, log.size());
        assertEquals("COMMIT", log.get(0).sql());
        assertTrue(log.get(0).success());
    }

    @Test
    void commit_unknownSession_throwsIllegalStateException() {
        assertThrows(IllegalStateException.class, () -> manager.commit("no-such-session"));
    }

    // -------------------------------------------------------------------------
    // rollback()
    // -------------------------------------------------------------------------

    @Test
    void rollback_callsConnectionRollback() throws SQLException {
        inject("sess-1", "conn-A");
        manager.rollback("sess-1");
        verify(mockConn).rollback();
    }

    @Test
    void rollback_addsLogEntry() throws SQLException {
        List<DebugSessionManager.LogEntry> log = new ArrayList<>();
        inject("sess-1", "conn-A", log);
        manager.rollback("sess-1");
        assertEquals(1, log.size());
        assertEquals("ROLLBACK", log.get(0).sql());
        assertTrue(log.get(0).success());
    }

    @Test
    void rollback_unknownSession_throwsIllegalStateException() {
        assertThrows(IllegalStateException.class, () -> manager.rollback("no-such-session"));
    }

    // -------------------------------------------------------------------------
    // close()
    // -------------------------------------------------------------------------

    @Test
    void close_callsConnectionRollbackAndClose() throws Exception {
        inject("sess-1", "conn-A");
        manager.close("sess-1");
        verify(mockConn).rollback();
        verify(mockConn).close();
    }

    @Test
    void close_removesSessionFromMap() throws Exception {
        inject("sess-1", "conn-A");
        manager.close("sess-1");
        assertTrue(manager.listSessions().isEmpty());
    }

    @Test
    void close_unknownSession_doesNothing() {
        assertDoesNotThrow(() -> manager.close("ghost-session"));
    }

    // -------------------------------------------------------------------------
    // status()
    // -------------------------------------------------------------------------

    @Test
    void status_returnsCorrectSessionId() throws SQLException {
        inject("sess-1", "conn-A");
        when(mockConn.getAutoCommit()).thenReturn(false);
        assertEquals("sess-1", manager.status("sess-1").get("sessionId"));
    }

    @Test
    void status_returnsCorrectConnectionId() throws SQLException {
        inject("sess-1", "conn-A");
        when(mockConn.getAutoCommit()).thenReturn(false);
        assertEquals("conn-A", manager.status("sess-1").get("connectionId"));
    }

    @Test
    void status_returnsAutoCommitValue() throws SQLException {
        inject("sess-1", "conn-A");
        when(mockConn.getAutoCommit()).thenReturn(true);
        assertEquals(true, manager.status("sess-1").get("autoCommit"));
    }

    @Test
    void status_returnsLogList() throws SQLException {
        List<DebugSessionManager.LogEntry> log = new ArrayList<>();
        log.add(new DebugSessionManager.LogEntry("SELECT 1 FROM DUAL", true, "ok", 10));
        inject("sess-1", "conn-A", log);
        when(mockConn.getAutoCommit()).thenReturn(false);
        assertSame(log, manager.status("sess-1").get("log"));
    }

    @Test
    void status_unknownSession_throwsIllegalStateException() {
        assertThrows(IllegalStateException.class, () -> manager.status("missing"));
    }

    // -------------------------------------------------------------------------
    // get() error propagation
    // -------------------------------------------------------------------------

    @Test
    void get_unknownSessionId_messageContainsId() {
        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> manager.commit("nonexistent-id"));
        assertTrue(ex.getMessage().contains("nonexistent-id"));
    }
}

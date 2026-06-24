package com.oracleeditor.db;

import com.oracleeditor.dialect.DatabaseDialect;
import com.oracleeditor.dialect.DialectFactory;
import com.oracleeditor.model.ConnectionConfig;
import com.oracleeditor.model.QueryResult;

import java.sql.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class DebugSessionManager {
    private static final DebugSessionManager INSTANCE = new DebugSessionManager();

    public static DebugSessionManager getInstance() { return INSTANCE; }

    public record DebugSession(String id, String connectionId, Connection conn,
                               List<LogEntry> log, DatabaseDialect dialect) {}
    public record LogEntry(String sql, boolean success, String message, long ms) {}

    private final Map<String, DebugSession> sessions = new ConcurrentHashMap<>();

    public DebugSession create(String connectionId) throws SQLException {
        ConnectionConfig config = ConnectionManager.getInstance().getConfig(connectionId);
        if (config == null) throw new IllegalArgumentException("Connection not found: " + connectionId);

        DatabaseDialect dialect = DialectFactory.create(config.dbType);
        Connection conn = DriverManager.getConnection(
                dialect.buildJdbcUrl(config), config.username, config.password);
        conn.setAutoCommit(false);

        String sessionId = UUID.randomUUID().toString();
        DebugSession session = new DebugSession(sessionId, connectionId, conn, new ArrayList<>(), dialect);
        sessions.put(sessionId, session);
        return session;
    }

    public QueryResult execute(String sessionId, String sql) throws SQLException {
        DebugSession session = get(sessionId);
        long start = System.currentTimeMillis();

        session.dialect().enableOutput(session.conn());

        try {
            QueryResult result = QueryExecutor.execute(session.conn(), sql, 1000, session.dialect());
            result.dbmsOutput = session.dialect().captureOutput(session.conn());
            session.log().add(new LogEntry(sql, result.success, result.error,
                    System.currentTimeMillis() - start));
            return result;
        } catch (SQLException e) {
            session.log().add(new LogEntry(sql, false, e.getMessage(),
                    System.currentTimeMillis() - start));
            throw e;
        }
    }

    public void commit(String sessionId) throws SQLException {
        DebugSession session = get(sessionId);
        session.conn().commit();
        session.log().add(new LogEntry("COMMIT", true, "Transaction committed", 0));
    }

    public void rollback(String sessionId) throws SQLException {
        DebugSession session = get(sessionId);
        session.conn().rollback();
        session.log().add(new LogEntry("ROLLBACK", true, "Transaction rolled back", 0));
    }

    public void close(String sessionId) {
        DebugSession session = sessions.remove(sessionId);
        if (session == null) return;
        try { session.conn().rollback(); } catch (Exception ignored) {}
        try { session.conn().close();   } catch (Exception ignored) {}
    }

    public Map<String, Object> status(String sessionId) throws SQLException {
        DebugSession session = get(sessionId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sessionId", sessionId);
        m.put("connectionId", session.connectionId());
        m.put("dialect", session.dialect().displayName());
        m.put("autoCommit", session.conn().getAutoCommit());
        m.put("log", session.log());
        return m;
    }

    public List<Map<String, Object>> listSessions() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (DebugSession s : sessions.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sessionId", s.id());
            m.put("connectionId", s.connectionId());
            m.put("dialect", s.dialect().displayName());
            m.put("logCount", s.log().size());
            result.add(m);
        }
        return result;
    }

    // Package-private: lets tests inject a pre-built session with a mock connection
    void injectSession(DebugSession session) {
        sessions.put(session.id(), session);
    }

    private DebugSession get(String sessionId) {
        DebugSession s = sessions.get(sessionId);
        if (s == null) throw new IllegalStateException("Debug session not found: " + sessionId);
        return s;
    }
}

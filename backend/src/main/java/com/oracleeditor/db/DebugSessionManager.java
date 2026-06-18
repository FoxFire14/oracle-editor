package com.oracleeditor.db;

import com.oracleeditor.model.ConnectionConfig;
import com.oracleeditor.model.QueryResult;

import java.sql.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class DebugSessionManager {
    private static final DebugSessionManager INSTANCE = new DebugSessionManager();

    public static DebugSessionManager getInstance() { return INSTANCE; }

    public record DebugSession(String id, String connectionId, Connection conn, List<LogEntry> log) {}
    public record LogEntry(String sql, boolean success, String message, long ms) {}

    private final Map<String, DebugSession> sessions = new ConcurrentHashMap<>();

    public DebugSession create(String connectionId) throws SQLException {
        ConnectionConfig config = ConnectionManager.getInstance().getConfig(connectionId);
        if (config == null) throw new IllegalArgumentException("Connection not found: " + connectionId);

        // Dedicated connection — not from pool — so we can hold it open across requests
        Connection conn = DriverManager.getConnection(config.toJdbcUrl(), config.username, config.password);
        if ("SYSDBA".equalsIgnoreCase(config.role)) {
            conn.createStatement().execute("SET ROLE SYSDBA");
        }
        conn.setAutoCommit(false);

        String sessionId = UUID.randomUUID().toString();
        DebugSession session = new DebugSession(sessionId, connectionId, conn, new ArrayList<>());
        sessions.put(sessionId, session);
        return session;
    }

    public QueryResult execute(String sessionId, String sql) throws SQLException {
        DebugSession session = get(sessionId);
        long start = System.currentTimeMillis();

        // Enable DBMS_OUTPUT before every execution
        try (Statement en = session.conn().createStatement()) {
            en.execute("BEGIN DBMS_OUTPUT.ENABLE(1000000); END;");
        }

        try {
            QueryResult result = QueryExecutor.execute(session.conn(), sql, 1000);
            result.dbmsOutput = captureDbmsOutput(session.conn());
            session.log().add(new LogEntry(sql, result.success, result.error, System.currentTimeMillis() - start));
            return result;
        } catch (SQLException e) {
            session.log().add(new LogEntry(sql, false, e.getMessage(), System.currentTimeMillis() - start));
            throw e;
        }
    }

    private String captureDbmsOutput(Connection conn) {
        StringBuilder sb = new StringBuilder();
        try (CallableStatement line = conn.prepareCall(
                "BEGIN DBMS_OUTPUT.GET_LINE(:l, :s); END;")) {
            for (int i = 0; i < 10000; i++) {
                line.registerOutParameter(1, java.sql.Types.VARCHAR);
                line.registerOutParameter(2, java.sql.Types.INTEGER);
                line.execute();
                if (line.getInt(2) != 0) break; // no more lines
                String l = line.getString(1);
                if (l != null) sb.append(l).append('\n');
            }
        } catch (Exception ignored) {}
        return sb.isEmpty() ? null : sb.toString().stripTrailing();
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
        try { session.conn().close(); } catch (Exception ignored) {}
    }

    public Map<String, Object> status(String sessionId) throws SQLException {
        DebugSession session = get(sessionId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sessionId", sessionId);
        m.put("connectionId", session.connectionId());
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
            m.put("logCount", s.log().size());
            result.add(m);
        }
        return result;
    }

    private DebugSession get(String sessionId) {
        DebugSession s = sessions.get(sessionId);
        if (s == null) throw new IllegalStateException("Debug session not found: " + sessionId);
        return s;
    }
}

package com.oracleeditor.db;

import com.oracleeditor.dialect.DatabaseDialect;
import com.oracleeditor.dialect.DialectFactory;
import com.oracleeditor.model.ConnectionConfig;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class ConnectionManager {
    private static final ConnectionManager INSTANCE = new ConnectionManager();

    private final Map<String, ConnectionConfig>  configs  = new ConcurrentHashMap<>();
    private final Map<String, HikariDataSource>  pools    = new ConcurrentHashMap<>();
    private final Map<String, DatabaseDialect>   dialects = new ConcurrentHashMap<>();

    private final ConnectionStore store = new ConnectionStore();

    private ConnectionManager() {
        for (ConnectionConfig c : store.load()) {
            configs.put(c.id, c);
        }
    }

    public static ConnectionManager getInstance() { return INSTANCE; }

    // -------------------------------------------------------------------------
    // Config management
    // -------------------------------------------------------------------------

    public void addConnection(ConnectionConfig config) {
        configs.put(config.id, config);
        store.save(configs.values());
    }

    public void removeConnection(String id) {
        configs.remove(id);
        dialects.remove(id);
        HikariDataSource ds = pools.remove(id);
        if (ds != null) ds.close();
        store.save(configs.values());
    }

    public ConnectionConfig getConfig(String connectionId) {
        return configs.get(connectionId);
    }

    // -------------------------------------------------------------------------
    // Connect / disconnect
    // -------------------------------------------------------------------------

    public void connect(String id) throws SQLException {
        ConnectionConfig config = configs.get(id);
        if (config == null) throw new IllegalArgumentException("Connection not found: " + id);

        DatabaseDialect dialect = DialectFactory.create(config.dbType);

        if (pools.containsKey(id)) {
            pools.get(id).close();
            pools.remove(id);
        }

        HikariConfig hc = new HikariConfig();
        hc.setJdbcUrl(dialect.buildJdbcUrl(config));
        hc.setUsername(config.username);
        hc.setPassword(config.password);
        hc.setMaximumPoolSize(10);
        hc.setMinimumIdle(1);
        hc.setConnectionTimeout(10_000);
        dialect.configurePool(hc, config);

        pools.put(id, new HikariDataSource(hc));
        dialects.put(id, dialect);
    }

    public void disconnect(String id) {
        dialects.remove(id);
        HikariDataSource ds = pools.remove(id);
        if (ds != null) ds.close();
    }

    // -------------------------------------------------------------------------
    // Runtime access
    // -------------------------------------------------------------------------

    public Connection getConnection(String connectionId) throws SQLException {
        HikariDataSource ds = pools.get(connectionId);
        if (ds == null || ds.isClosed())
            throw new IllegalStateException("Not connected: " + connectionId);
        return ds.getConnection();
    }

    public DatabaseDialect getDialect(String connectionId) {
        // Fall back to Oracle dialect if the connection was registered before connecting
        return dialects.getOrDefault(connectionId,
                DialectFactory.create(configs.containsKey(connectionId)
                        ? configs.get(connectionId).dbType : null));
    }

    public boolean isConnected(String id) {
        HikariDataSource ds = pools.get(id);
        return ds != null && !ds.isClosed();
    }

    // -------------------------------------------------------------------------
    // Listing (used by ConnectionRoutes)
    // -------------------------------------------------------------------------

    public List<Map<String, Object>> listConnections() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (ConnectionConfig c : configs.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.id);
            m.put("name", c.name);
            m.put("host", c.host);
            m.put("port", c.port);
            m.put("serviceName", c.serviceName);
            m.put("username", c.username);
            m.put("role", c.role);
            m.put("dbType", c.dbType != null ? c.dbType : "ORACLE");
            m.put("connected", pools.containsKey(c.id) && !pools.get(c.id).isClosed());
            result.add(m);
        }
        return result;
    }
}

package com.oracleeditor.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ConnectionConfig {
    public String id;
    public String name;
    public String host;
    public int port = 1521;
    public String serviceName;
    public String username;
    public String password;
    public String role;           // NORMAL, SYSDBA, SYSOPER
    public String connectionType; // BASIC, TNS, JDBC_URL
    public String dbType;         // ORACLE (default), POSTGRES
    public String tnsAlias;
    public String jdbcUrl;

    /** Kept for backward compatibility with OracleDialect and existing tests. */
    public String toJdbcUrl() {
        if (jdbcUrl != null && !jdbcUrl.isBlank()) return jdbcUrl;
        if (tnsAlias != null && !tnsAlias.isBlank()) {
            return "jdbc:oracle:thin:@" + tnsAlias;
        }
        return String.format("jdbc:oracle:thin:@//%s:%d/%s", host, port, serviceName);
    }
}

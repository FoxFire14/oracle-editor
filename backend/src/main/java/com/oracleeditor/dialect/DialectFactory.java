package com.oracleeditor.dialect;

public class DialectFactory {

    public static DatabaseDialect create(String dbType) {
        if (dbType == null) return new OracleDialect();
        return switch (dbType.toUpperCase()) {
            case "POSTGRES", "POSTGRESQL" -> new PostgresDialect();
            default -> new OracleDialect();
        };
    }
}

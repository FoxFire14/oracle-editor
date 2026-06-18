package com.oracleeditor.model;

import java.util.List;
import java.util.Map;

public class QueryResult {
    public boolean success;
    public String error;
    public List<String> columns;
    public List<String> columnTypes;
    public List<Map<String, Object>> rows;
    public int rowsAffected;
    public long executionTimeMs;
    public String statementType;
    public String dbmsOutput; // SELECT, INSERT, UPDATE, DELETE, DDL, PLSQL

    public static QueryResult ok(List<String> columns, List<String> columnTypes, List<Map<String, Object>> rows, long ms) {
        QueryResult r = new QueryResult();
        r.success = true;
        r.columns = columns;
        r.columnTypes = columnTypes;
        r.rows = rows;
        r.executionTimeMs = ms;
        r.statementType = "SELECT";
        return r;
    }

    public static QueryResult dml(int rowsAffected, long ms, String type) {
        QueryResult r = new QueryResult();
        r.success = true;
        r.rowsAffected = rowsAffected;
        r.executionTimeMs = ms;
        r.statementType = type;
        return r;
    }

    public static QueryResult error(String message) {
        QueryResult r = new QueryResult();
        r.success = false;
        r.error = message;
        return r;
    }
}

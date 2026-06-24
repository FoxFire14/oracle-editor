package com.oracleeditor.routes;

import com.oracleeditor.db.ConnectionManager;
import com.oracleeditor.db.QueryExecutor;
import com.oracleeditor.dialect.DatabaseDialect;
import com.oracleeditor.model.QueryResult;
import io.javalin.Javalin;

import java.sql.Connection;

public class QueryRoutes {

    record QueryRequest(String connectionId, String sql, int maxRows) {}
    record ExplainRequest(String connectionId, String sql) {}

    public static void register(Javalin app) {
        app.post("/api/query", ctx -> {
            QueryRequest body = ctx.bodyAsClass(QueryRequest.class);
            String connectionId = body.connectionId();
            String sql = body.sql();
            int maxRows = body.maxRows() > 0 ? body.maxRows() : 1000;

            if (sql == null || sql.isBlank()) {
                ctx.status(400).json(QueryResult.error("SQL cannot be empty"));
                return;
            }

            DatabaseDialect dialect = ConnectionManager.getInstance().getDialect(connectionId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connectionId)) {
                conn.setAutoCommit(false);
                QueryResult result = QueryExecutor.execute(conn, sql, maxRows, dialect);
                ctx.json(result);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        app.post("/api/query/explain", ctx -> {
            ExplainRequest body = ctx.bodyAsClass(ExplainRequest.class);
            String connectionId = body.connectionId();
            DatabaseDialect dialect = ConnectionManager.getInstance().getDialect(connectionId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connectionId)) {
                ctx.json(dialect.explainPlan(conn, body.sql()));
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });
    }
}

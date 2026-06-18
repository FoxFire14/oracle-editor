package com.oracleeditor.routes;

import com.oracleeditor.db.ConnectionManager;
import com.oracleeditor.db.QueryExecutor;
import com.oracleeditor.model.QueryResult;
import io.javalin.Javalin;

import java.sql.Connection;
import java.util.List;
import java.util.Map;

public class TableRoutes {

    record ColumnDef(String name, String dataType, Integer length, Integer precision, Integer scale,
                     boolean nullable, String defaultValue) {}
    record CreateTableRequest(String connectionId, String owner, String tableName, List<ColumnDef> columns,
                              String tablespace) {}
    record AlterTableRequest(String connectionId, String owner, String tableName, String ddl) {}

    public static void register(Javalin app) {

        // Create table
        app.post("/api/tables/create", ctx -> {
            CreateTableRequest req = ctx.bodyAsClass(CreateTableRequest.class);
            String ddl = buildCreateTable(req);
            try (Connection conn = ConnectionManager.getInstance().getConnection(req.connectionId())) {
                QueryResult r = QueryExecutor.execute(conn, ddl, 0);
                ctx.json(Map.of("success", r.success, "error", r.error != null ? r.error : "", "ddl", ddl));
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Execute arbitrary DDL (ALTER TABLE, DROP TABLE, etc.)
        app.post("/api/tables/alter", ctx -> {
            AlterTableRequest req = ctx.bodyAsClass(AlterTableRequest.class);
            try (Connection conn = ConnectionManager.getInstance().getConnection(req.connectionId())) {
                QueryResult r = QueryExecutor.execute(conn, req.ddl(), 0);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Table row count
        app.get("/api/tables/{connId}/{owner}/{table}/count", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            String table = ctx.pathParam("table").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT COUNT(*) AS ROW_COUNT FROM \"" + owner + "\".\"" + table + "\"", 1);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Preview table data
        app.get("/api/tables/{connId}/{owner}/{table}/data", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            String table = ctx.pathParam("table").toUpperCase();
            int limit = Integer.parseInt(ctx.queryParamAsClass("limit", String.class).getOrDefault("200"));
            int offset = Integer.parseInt(ctx.queryParamAsClass("offset", String.class).getOrDefault("0"));
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT * FROM \"" + owner + "\".\"" + table + "\" OFFSET " + offset + " ROWS FETCH NEXT " + limit + " ROWS ONLY", limit);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });
    }

    private static String buildCreateTable(CreateTableRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("CREATE TABLE \"").append(req.owner()).append("\".\"").append(req.tableName()).append("\" (\n");
        for (int i = 0; i < req.columns().size(); i++) {
            ColumnDef col = req.columns().get(i);
            sb.append("  \"").append(col.name()).append("\" ").append(col.dataType());
            if (col.length() != null && col.length() > 0) {
                sb.append("(").append(col.length()).append(")");
            } else if (col.precision() != null && col.precision() > 0) {
                sb.append("(").append(col.precision());
                if (col.scale() != null && col.scale() > 0) sb.append(",").append(col.scale());
                sb.append(")");
            }
            if (!col.nullable()) sb.append(" NOT NULL");
            if (col.defaultValue() != null && !col.defaultValue().isBlank()) {
                sb.append(" DEFAULT ").append(col.defaultValue());
            }
            if (i < req.columns().size() - 1) sb.append(",");
            sb.append("\n");
        }
        sb.append(")");
        if (req.tablespace() != null && !req.tablespace().isBlank()) {
            sb.append(" TABLESPACE ").append(req.tablespace());
        }
        return sb.toString();
    }
}

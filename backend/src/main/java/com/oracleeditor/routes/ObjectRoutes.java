package com.oracleeditor.routes;

import com.oracleeditor.db.ConnectionManager;
import com.oracleeditor.db.QueryExecutor;
import com.oracleeditor.model.QueryResult;
import io.javalin.Javalin;

import java.sql.Connection;

public class ObjectRoutes {

    record SaveObjectRequest(String connectionId, String owner, String type, String name, String source) {}
    record CompileRequest(String connectionId, String owner, String type, String name) {}

    public static void register(Javalin app) {

        // Get source of a stored object (package, procedure, function, trigger, type)
        app.get("/api/objects/{connId}/{owner}/{type}/{name}/source", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            String type = ctx.pathParam("type").toUpperCase();
            String name = ctx.pathParam("name").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT LINE, TEXT FROM ALL_SOURCE " +
                        "WHERE OWNER='" + owner + "' AND TYPE='" + type + "' AND NAME='" + name + "' ORDER BY LINE", 5000);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Save (compile) a PL/SQL object
        app.post("/api/objects/save", ctx -> {
            SaveObjectRequest req = ctx.bodyAsClass(SaveObjectRequest.class);
            try (Connection conn = ConnectionManager.getInstance().getConnection(req.connectionId())) {
                conn.setAutoCommit(true);
                QueryResult r = QueryExecutor.execute(conn, req.source(), 0);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Get compilation errors for an object
        app.get("/api/objects/{connId}/{owner}/{type}/{name}/errors", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            String type = ctx.pathParam("type").toUpperCase();
            String name = ctx.pathParam("name").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT LINE, POSITION, TEXT, ATTRIBUTE FROM ALL_ERRORS " +
                        "WHERE OWNER='" + owner + "' AND TYPE='" + type + "' AND NAME='" + name + "' ORDER BY SEQUENCE", 200);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Get package spec + body separately
        app.get("/api/objects/{connId}/{owner}/package/{name}", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            String name = ctx.pathParam("name").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult spec = QueryExecutor.execute(conn,
                        "SELECT LINE, TEXT FROM ALL_SOURCE WHERE OWNER='" + owner + "' AND TYPE='PACKAGE' AND NAME='" + name + "' ORDER BY LINE", 5000);
                QueryResult body = QueryExecutor.execute(conn,
                        "SELECT LINE, TEXT FROM ALL_SOURCE WHERE OWNER='" + owner + "' AND TYPE='PACKAGE BODY' AND NAME='" + name + "' ORDER BY LINE", 5000);
                ctx.json(java.util.Map.of("spec", spec, "body", body));
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });
    }
}

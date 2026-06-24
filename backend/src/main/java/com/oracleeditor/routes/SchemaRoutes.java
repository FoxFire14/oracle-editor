package com.oracleeditor.routes;

import com.oracleeditor.db.ConnectionManager;
import com.oracleeditor.db.QueryExecutor;
import com.oracleeditor.dialect.DatabaseDialect;
import com.oracleeditor.model.QueryResult;
import io.javalin.Javalin;

import java.sql.Connection;

public class SchemaRoutes {
    public static void register(Javalin app) {

        app.get("/api/schema/{connId}/owners", ctx -> {
            String connId = ctx.pathParam("connId");
            DatabaseDialect d = ConnectionManager.getInstance().getDialect(connId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                ctx.json(QueryExecutor.execute(conn, d.ownersQuery(), 500, d));
            } catch (Exception e) { ctx.json(QueryResult.error(e.getMessage())); }
        });

        app.get("/api/schema/{connId}/{owner}/types", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner  = ctx.pathParam("owner").toUpperCase();
            DatabaseDialect d = ConnectionManager.getInstance().getDialect(connId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                ctx.json(QueryExecutor.execute(conn, d.objectTypesQuery(owner), 100, d));
            } catch (Exception e) { ctx.json(QueryResult.error(e.getMessage())); }
        });

        app.get("/api/schema/{connId}/{owner}/{type}", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner  = ctx.pathParam("owner").toUpperCase();
            String type   = ctx.pathParam("type").toUpperCase();
            DatabaseDialect d = ConnectionManager.getInstance().getDialect(connId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                ctx.json(QueryExecutor.execute(conn, d.objectsQuery(owner, type), 2000, d));
            } catch (Exception e) { ctx.json(QueryResult.error(e.getMessage())); }
        });

        app.get("/api/schema/{connId}/{owner}/table/{table}/columns", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner  = ctx.pathParam("owner").toUpperCase();
            String table  = ctx.pathParam("table").toUpperCase();
            DatabaseDialect d = ConnectionManager.getInstance().getDialect(connId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                ctx.json(QueryExecutor.execute(conn, d.columnsQuery(owner, table), 500, d));
            } catch (Exception e) { ctx.json(QueryResult.error(e.getMessage())); }
        });

        app.get("/api/schema/{connId}/{owner}/table/{table}/indexes", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner  = ctx.pathParam("owner").toUpperCase();
            String table  = ctx.pathParam("table").toUpperCase();
            DatabaseDialect d = ConnectionManager.getInstance().getDialect(connId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                ctx.json(QueryExecutor.execute(conn, d.indexesQuery(owner, table), 200, d));
            } catch (Exception e) { ctx.json(QueryResult.error(e.getMessage())); }
        });

        app.get("/api/schema/{connId}/{owner}/table/{table}/constraints", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner  = ctx.pathParam("owner").toUpperCase();
            String table  = ctx.pathParam("table").toUpperCase();
            DatabaseDialect d = ConnectionManager.getInstance().getDialect(connId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                ctx.json(QueryExecutor.execute(conn, d.constraintsQuery(owner, table), 200, d));
            } catch (Exception e) { ctx.json(QueryResult.error(e.getMessage())); }
        });

        app.get("/api/schema/{connId}/{owner}/{type}/{name}/ddl", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner  = ctx.pathParam("owner").toUpperCase();
            String type   = ctx.pathParam("type").toUpperCase();
            String name   = ctx.pathParam("name").toUpperCase();
            DatabaseDialect d = ConnectionManager.getInstance().getDialect(connId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                ctx.json(QueryExecutor.execute(conn, d.ddlQuery(owner, type, name), 1, d));
            } catch (Exception e) { ctx.json(QueryResult.error(e.getMessage())); }
        });

        app.get("/api/schema/{connId}/callable", ctx -> {
            String connId = ctx.pathParam("connId");
            DatabaseDialect d = ConnectionManager.getInstance().getDialect(connId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                ctx.json(QueryExecutor.execute(conn, d.callableObjectsQuery(), 5000, d));
            } catch (Exception e) { ctx.json(QueryResult.error(e.getMessage())); }
        });

        app.get("/api/schema/{connId}/callable/{name}/params", ctx -> {
            String connId = ctx.pathParam("connId");
            String name   = ctx.pathParam("name").toUpperCase();
            String pkg    = ctx.queryParam("pkg");
            DatabaseDialect d = ConnectionManager.getInstance().getDialect(connId);
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                ctx.json(QueryExecutor.execute(conn, d.callableParamsQuery(name, pkg), 200, d));
            } catch (Exception e) { ctx.json(QueryResult.error(e.getMessage())); }
        });
    }
}

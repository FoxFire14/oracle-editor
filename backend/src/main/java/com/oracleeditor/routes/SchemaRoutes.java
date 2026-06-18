package com.oracleeditor.routes;

import com.oracleeditor.db.ConnectionManager;
import com.oracleeditor.db.QueryExecutor;
import com.oracleeditor.model.QueryResult;
import io.javalin.Javalin;

import java.sql.Connection;

public class SchemaRoutes {
    public static void register(Javalin app) {

        // List schemas/owners visible to the user
        app.get("/api/schema/{connId}/owners", ctx -> {
            String connId = ctx.pathParam("connId");
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT DISTINCT OWNER FROM ALL_OBJECTS ORDER BY OWNER", 500);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // List object types for an owner
        app.get("/api/schema/{connId}/{owner}/types", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT DISTINCT OBJECT_TYPE FROM ALL_OBJECTS WHERE OWNER='" + owner + "' ORDER BY OBJECT_TYPE", 100);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // List objects of a given type for an owner
        app.get("/api/schema/{connId}/{owner}/{type}", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            String type = ctx.pathParam("type").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT OBJECT_NAME, STATUS, LAST_DDL_TIME FROM ALL_OBJECTS " +
                        "WHERE OWNER='" + owner + "' AND OBJECT_TYPE='" + type + "' ORDER BY OBJECT_NAME", 2000);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Table columns
        app.get("/api/schema/{connId}/{owner}/table/{table}/columns", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            String table = ctx.pathParam("table").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_PRECISION, DATA_SCALE, NULLABLE, DATA_DEFAULT " +
                        "FROM ALL_TAB_COLUMNS WHERE OWNER='" + owner + "' AND TABLE_NAME='" + table + "' ORDER BY COLUMN_ID", 500);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Table indexes
        app.get("/api/schema/{connId}/{owner}/table/{table}/indexes", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            String table = ctx.pathParam("table").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT i.INDEX_NAME, i.INDEX_TYPE, i.UNIQUENESS, ic.COLUMN_NAME, ic.COLUMN_POSITION " +
                        "FROM ALL_INDEXES i JOIN ALL_IND_COLUMNS ic ON i.INDEX_NAME=ic.INDEX_NAME AND i.OWNER=ic.INDEX_OWNER " +
                        "WHERE i.TABLE_OWNER='" + owner + "' AND i.TABLE_NAME='" + table + "' ORDER BY i.INDEX_NAME, ic.COLUMN_POSITION", 200);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Table constraints
        app.get("/api/schema/{connId}/{owner}/table/{table}/constraints", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            String table = ctx.pathParam("table").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT c.CONSTRAINT_NAME, c.CONSTRAINT_TYPE, c.STATUS, c.VALIDATED, " +
                        "cc.COLUMN_NAME, c.R_CONSTRAINT_NAME, c.SEARCH_CONDITION " +
                        "FROM ALL_CONSTRAINTS c LEFT JOIN ALL_CONS_COLUMNS cc ON c.CONSTRAINT_NAME=cc.CONSTRAINT_NAME AND c.OWNER=cc.OWNER " +
                        "WHERE c.OWNER='" + owner + "' AND c.TABLE_NAME='" + table + "' ORDER BY c.CONSTRAINT_NAME", 200);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // List callable objects — standalone functions/procedures + package subprograms
        app.get("/api/schema/{connId}/callable", ctx -> {
            String connId = ctx.pathParam("connId");
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT OBJECT_NAME AS NAME, OBJECT_TYPE AS TYPE, NULL AS PACKAGE_NAME " +
                        "FROM USER_OBJECTS WHERE OBJECT_TYPE IN ('FUNCTION','PROCEDURE') " +
                        "UNION ALL " +
                        "SELECT PROCEDURE_NAME, 'PACKAGE_MEMBER', OBJECT_NAME " +
                        "FROM USER_PROCEDURES WHERE PROCEDURE_NAME IS NOT NULL " +
                        "ORDER BY PACKAGE_NAME NULLS FIRST, NAME", 5000);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Get parameters — supports standalone and package members via ?pkg=PACKAGE_NAME
        // Position 0 = return type (functions only)
        app.get("/api/schema/{connId}/callable/{name}/params", ctx -> {
            String connId = ctx.pathParam("connId");
            String name = ctx.pathParam("name").toUpperCase();
            String pkg  = ctx.queryParam("pkg");
            String pkgClause = (pkg != null && !pkg.isBlank())
                    ? "AND PACKAGE_NAME = '" + pkg.toUpperCase() + "'"
                    : "AND PACKAGE_NAME IS NULL";
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT ARGUMENT_NAME, POSITION, IN_OUT, DATA_TYPE " +
                        "FROM USER_ARGUMENTS " +
                        "WHERE OBJECT_NAME='" + name + "' " + pkgClause + " " +
                        "ORDER BY POSITION", 200);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Get DDL source for any object
        app.get("/api/schema/{connId}/{owner}/{type}/{name}/ddl", ctx -> {
            String connId = ctx.pathParam("connId");
            String owner = ctx.pathParam("owner").toUpperCase();
            String type = ctx.pathParam("type").toUpperCase();
            String name = ctx.pathParam("name").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT DBMS_METADATA.GET_DDL('" + type + "','" + name + "','" + owner + "') AS DDL FROM DUAL", 1);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });
    }
}

package com.oracleeditor.routes;

import com.oracleeditor.db.ConnectionManager;
import com.oracleeditor.db.QueryExecutor;
import com.oracleeditor.model.QueryResult;
import io.javalin.Javalin;

import java.sql.Connection;
import java.util.List;

public class UserRoutes {

    record CreateUserRequest(String connectionId, String username, String password,
                             String defaultTablespace, String tempTablespace, List<String> roles) {}
    record GrantRequest(String connectionId, String username, List<String> privileges) {}
    record RevokeRequest(String connectionId, String username, List<String> privileges) {}
    record ChangePasswordRequest(String connectionId, String username, String newPassword) {}

    public static void register(Javalin app) {

        // List all DB users
        app.get("/api/users/{connId}", ctx -> {
            String connId = ctx.pathParam("connId");
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult r = QueryExecutor.execute(conn,
                        "SELECT USERNAME, ACCOUNT_STATUS, LOCK_DATE, EXPIRY_DATE, DEFAULT_TABLESPACE, TEMPORARY_TABLESPACE, CREATED " +
                        "FROM DBA_USERS ORDER BY USERNAME", 1000);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // User roles and privileges
        app.get("/api/users/{connId}/{username}/privileges", ctx -> {
            String connId = ctx.pathParam("connId");
            String username = ctx.pathParam("username").toUpperCase();
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                QueryResult roles = QueryExecutor.execute(conn,
                        "SELECT GRANTED_ROLE, ADMIN_OPTION, DEFAULT_ROLE FROM DBA_ROLE_PRIVS WHERE GRANTEE='" + username + "' ORDER BY GRANTED_ROLE", 200);
                QueryResult sysPrivs = QueryExecutor.execute(conn,
                        "SELECT PRIVILEGE, ADMIN_OPTION FROM DBA_SYS_PRIVS WHERE GRANTEE='" + username + "' ORDER BY PRIVILEGE", 200);
                QueryResult objPrivs = QueryExecutor.execute(conn,
                        "SELECT OWNER, TABLE_NAME, PRIVILEGE, GRANTABLE FROM DBA_TAB_PRIVS WHERE GRANTEE='" + username + "' ORDER BY TABLE_NAME", 500);
                ctx.json(java.util.Map.of("roles", roles, "systemPrivileges", sysPrivs, "objectPrivileges", objPrivs));
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Create user
        app.post("/api/users/create", ctx -> {
            CreateUserRequest req = ctx.bodyAsClass(CreateUserRequest.class);
            try (Connection conn = ConnectionManager.getInstance().getConnection(req.connectionId())) {
                StringBuilder ddl = new StringBuilder();
                ddl.append("CREATE USER \"").append(req.username()).append("\" IDENTIFIED BY \"").append(req.password()).append("\"");
                if (req.defaultTablespace() != null && !req.defaultTablespace().isBlank())
                    ddl.append(" DEFAULT TABLESPACE ").append(req.defaultTablespace());
                if (req.tempTablespace() != null && !req.tempTablespace().isBlank())
                    ddl.append(" TEMPORARY TABLESPACE ").append(req.tempTablespace());
                QueryResult r = QueryExecutor.execute(conn, ddl.toString(), 0);
                if (r.success && req.roles() != null) {
                    for (String role : req.roles()) {
                        QueryExecutor.execute(conn, "GRANT " + role + " TO \"" + req.username() + "\"", 0);
                    }
                }
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Grant privileges
        app.post("/api/users/grant", ctx -> {
            GrantRequest req = ctx.bodyAsClass(GrantRequest.class);
            try (Connection conn = ConnectionManager.getInstance().getConnection(req.connectionId())) {
                for (String priv : req.privileges()) {
                    QueryExecutor.execute(conn, "GRANT " + priv + " TO \"" + req.username() + "\"", 0);
                }
                ctx.json(java.util.Map.of("success", true));
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Revoke privileges
        app.post("/api/users/revoke", ctx -> {
            RevokeRequest req = ctx.bodyAsClass(RevokeRequest.class);
            try (Connection conn = ConnectionManager.getInstance().getConnection(req.connectionId())) {
                for (String priv : req.privileges()) {
                    QueryExecutor.execute(conn, "REVOKE " + priv + " FROM \"" + req.username() + "\"", 0);
                }
                ctx.json(java.util.Map.of("success", true));
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Lock/unlock user
        app.post("/api/users/{connId}/{username}/lock", ctx -> {
            String connId = ctx.pathParam("connId");
            String username = ctx.pathParam("username").toUpperCase();
            boolean lock = Boolean.parseBoolean(ctx.queryParam("lock"));
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                String action = lock ? "ACCOUNT LOCK" : "ACCOUNT UNLOCK";
                QueryResult r = QueryExecutor.execute(conn, "ALTER USER \"" + username + "\" " + action, 0);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Change password
        app.post("/api/users/password", ctx -> {
            ChangePasswordRequest req = ctx.bodyAsClass(ChangePasswordRequest.class);
            try (Connection conn = ConnectionManager.getInstance().getConnection(req.connectionId())) {
                QueryResult r = QueryExecutor.execute(conn,
                        "ALTER USER \"" + req.username() + "\" IDENTIFIED BY \"" + req.newPassword() + "\"", 0);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        // Drop user
        app.delete("/api/users/{connId}/{username}", ctx -> {
            String connId = ctx.pathParam("connId");
            String username = ctx.pathParam("username").toUpperCase();
            boolean cascade = Boolean.parseBoolean(ctx.queryParam("cascade"));
            try (Connection conn = ConnectionManager.getInstance().getConnection(connId)) {
                String ddl = "DROP USER \"" + username + "\"" + (cascade ? " CASCADE" : "");
                QueryResult r = QueryExecutor.execute(conn, ddl, 0);
                ctx.json(r);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });
    }
}

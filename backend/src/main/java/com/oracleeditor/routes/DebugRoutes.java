package com.oracleeditor.routes;

import com.oracleeditor.db.DebugSessionManager;
import com.oracleeditor.model.QueryResult;
import io.javalin.Javalin;

import java.util.Map;

public class DebugRoutes {

    record StartRequest(String connectionId) {}
    record ExecuteRequest(String sessionId, String sql) {}

    public static void register(Javalin app) {

        app.post("/api/debug/start", ctx -> {
            StartRequest req = ctx.bodyAsClass(StartRequest.class);
            try {
                DebugSessionManager.DebugSession session = DebugSessionManager.getInstance().create(req.connectionId());
                ctx.json(Map.of("sessionId", session.id(), "success", true));
            } catch (Exception e) {
                ctx.status(400).json(Map.of("success", false, "error", e.getMessage()));
            }
        });

        app.post("/api/debug/execute", ctx -> {
            ExecuteRequest req = ctx.bodyAsClass(ExecuteRequest.class);
            try {
                QueryResult result = DebugSessionManager.getInstance().execute(req.sessionId(), req.sql());
                ctx.json(result);
            } catch (Exception e) {
                ctx.json(QueryResult.error(e.getMessage()));
            }
        });

        app.post("/api/debug/{sessionId}/commit", ctx -> {
            try {
                DebugSessionManager.getInstance().commit(ctx.pathParam("sessionId"));
                ctx.json(Map.of("success", true));
            } catch (Exception e) {
                ctx.status(400).json(Map.of("success", false, "error", e.getMessage()));
            }
        });

        app.post("/api/debug/{sessionId}/rollback", ctx -> {
            try {
                DebugSessionManager.getInstance().rollback(ctx.pathParam("sessionId"));
                ctx.json(Map.of("success", true));
            } catch (Exception e) {
                ctx.status(400).json(Map.of("success", false, "error", e.getMessage()));
            }
        });

        app.delete("/api/debug/{sessionId}", ctx -> {
            DebugSessionManager.getInstance().close(ctx.pathParam("sessionId"));
            ctx.json(Map.of("success", true));
        });

        app.get("/api/debug/{sessionId}/status", ctx -> {
            try {
                ctx.json(DebugSessionManager.getInstance().status(ctx.pathParam("sessionId")));
            } catch (Exception e) {
                ctx.status(404).json(Map.of("error", e.getMessage()));
            }
        });

        app.get("/api/debug/sessions", ctx -> {
            ctx.json(DebugSessionManager.getInstance().listSessions());
        });
    }
}

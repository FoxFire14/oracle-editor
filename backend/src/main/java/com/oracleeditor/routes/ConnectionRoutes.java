package com.oracleeditor.routes;

import com.oracleeditor.db.ConnectionManager;
import com.oracleeditor.model.ConnectionConfig;
import io.javalin.Javalin;

import java.util.Map;
import java.util.UUID;

public class ConnectionRoutes {
    public static void register(Javalin app) {
        app.get("/api/connections", ctx -> {
            ctx.json(ConnectionManager.getInstance().listConnections());
        });

        app.post("/api/connections", ctx -> {
            ConnectionConfig config = ctx.bodyAsClass(ConnectionConfig.class);
            if (config.id == null || config.id.isBlank()) config.id = UUID.randomUUID().toString();
            ConnectionManager.getInstance().addConnection(config);
            ctx.json(Map.of("id", config.id, "success", true));
        });

        app.delete("/api/connections/{id}", ctx -> {
            ConnectionManager.getInstance().removeConnection(ctx.pathParam("id"));
            ctx.json(Map.of("success", true));
        });

        app.post("/api/connections/{id}/connect", ctx -> {
            try {
                ConnectionManager.getInstance().connect(ctx.pathParam("id"));
                ctx.json(Map.of("success", true));
            } catch (Exception e) {
                ctx.status(400).json(Map.of("success", false, "error", e.getMessage()));
            }
        });

        app.post("/api/connections/{id}/disconnect", ctx -> {
            ConnectionManager.getInstance().disconnect(ctx.pathParam("id"));
            ctx.json(Map.of("success", true));
        });

        app.get("/api/connections/{id}/status", ctx -> {
            boolean connected = ConnectionManager.getInstance().isConnected(ctx.pathParam("id"));
            ctx.json(Map.of("connected", connected));
        });
    }
}

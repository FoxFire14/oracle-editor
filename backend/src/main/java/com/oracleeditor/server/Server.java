package com.oracleeditor.server;

import com.oracleeditor.routes.*;
import io.javalin.Javalin;
import io.javalin.json.JavalinJackson;

public class Server {
    private final Javalin app;
    private final int port;

    public Server(int port) {
        this.port = port;
        this.app = Javalin.create(config -> {
            config.jsonMapper(new JavalinJackson());
            config.bundledPlugins.enableCors(cors -> cors.addRule(rule -> {
                rule.anyHost();
            }));
        });

        registerRoutes();
    }

    private void registerRoutes() {
        ConnectionRoutes.register(app);
        QueryRoutes.register(app);
        SchemaRoutes.register(app);
        ObjectRoutes.register(app);
        UserRoutes.register(app);
        TableRoutes.register(app);
        DebugRoutes.register(app);
    }

    public void start() {
        app.start(port);
    }

    public void stop() {
        app.stop();
    }
}

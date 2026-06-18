package com.oracleeditor;

import com.oracleeditor.server.Server;

public class Main {
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 7654;
        Server server = new Server(port);
        server.start();

        // Print the port so Electron can read it from stdout
        System.out.println("ORACLE_EDITOR_PORT=" + port);
        System.out.flush();

        Runtime.getRuntime().addShutdownHook(new Thread(server::stop));
    }
}

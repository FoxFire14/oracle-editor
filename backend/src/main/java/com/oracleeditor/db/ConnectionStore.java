package com.oracleeditor.db;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oracleeditor.model.ConnectionConfig;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class ConnectionStore {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final File file;

    public ConnectionStore() {
        String dir = System.getProperty("user.home") + File.separator + ".oracle-editor";
        new File(dir).mkdirs();
        this.file = new File(dir + File.separator + "connections.json");
    }

    public List<ConnectionConfig> load() {
        if (!file.exists()) return new ArrayList<>();
        try {
            return MAPPER.readValue(file,
                MAPPER.getTypeFactory().constructCollectionType(List.class, ConnectionConfig.class));
        } catch (Exception e) {
            System.err.println("Failed to load connections: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    public void save(Iterable<ConnectionConfig> configs) {
        try {
            MAPPER.writerWithDefaultPrettyPrinter().writeValue(file, configs);
        } catch (Exception e) {
            System.err.println("Failed to save connections: " + e.getMessage());
        }
    }
}

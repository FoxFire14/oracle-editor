package com.oracleeditor.db;

import com.oracleeditor.model.ConnectionConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ConnectionStoreTest {

    @TempDir
    Path tempDir;

    private ConnectionStore storeAt(String filename) {
        File file = tempDir.resolve(filename).toFile();
        return new ConnectionStore(file);
    }

    private ConnectionConfig config(String id, String name, String username) {
        ConnectionConfig c = new ConnectionConfig();
        c.id = id;
        c.name = name;
        c.username = username;
        c.host = "localhost";
        c.port = 1521;
        c.serviceName = "ORCL";
        return c;
    }

    // -------------------------------------------------------------------------
    // load()
    // -------------------------------------------------------------------------

    @Test
    void load_nonexistentFile_returnsEmptyList() {
        ConnectionStore store = storeAt("missing.json");

        List<ConnectionConfig> result = store.load();

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void load_corruptFile_returnsEmptyList() throws Exception {
        File file = tempDir.resolve("corrupt.json").toFile();
        java.nio.file.Files.writeString(file.toPath(), "NOT VALID JSON }{");
        ConnectionStore store = new ConnectionStore(file);

        List<ConnectionConfig> result = store.load();

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    // -------------------------------------------------------------------------
    // save() + load() round-trips
    // -------------------------------------------------------------------------

    @Test
    void saveAndLoad_singleConfig_roundTripsCorrectly() {
        ConnectionStore store = storeAt("single.json");
        ConnectionConfig original = config("id-1", "My DB", "scott");

        store.save(List.of(original));
        List<ConnectionConfig> loaded = store.load();

        assertEquals(1, loaded.size());
        assertEquals("id-1", loaded.get(0).id);
        assertEquals("My DB", loaded.get(0).name);
        assertEquals("scott", loaded.get(0).username);
    }

    @Test
    void saveAndLoad_emptyList_returnsEmptyList() {
        ConnectionStore store = storeAt("empty.json");

        store.save(new ArrayList<>());
        List<ConnectionConfig> loaded = store.load();

        assertNotNull(loaded);
        assertTrue(loaded.isEmpty());
    }

    @Test
    void saveAndLoad_twoConfigs_preservesCountAndOrder() {
        ConnectionStore store = storeAt("two.json");
        ConnectionConfig first = config("id-1", "First DB", "user1");
        ConnectionConfig second = config("id-2", "Second DB", "user2");

        store.save(List.of(first, second));
        List<ConnectionConfig> loaded = store.load();

        assertEquals(2, loaded.size());
        assertEquals("id-1", loaded.get(0).id);
        assertEquals("First DB", loaded.get(0).name);
        assertEquals("user1", loaded.get(0).username);
        assertEquals("id-2", loaded.get(1).id);
        assertEquals("Second DB", loaded.get(1).name);
        assertEquals("user2", loaded.get(1).username);
    }

    @Test
    void saveAndLoad_connectionConfigFields_roundTripsAllFields() {
        ConnectionStore store = storeAt("fields.json");
        ConnectionConfig original = new ConnectionConfig();
        original.id = "abc-123";
        original.name = "Prod DB";
        original.host = "dbprod.example.com";
        original.port = 1522;
        original.serviceName = "PROD";
        original.username = "admin";
        original.password = "secret";
        original.role = "SYSDBA";

        store.save(List.of(original));
        List<ConnectionConfig> loaded = store.load();

        assertEquals(1, loaded.size());
        ConnectionConfig c = loaded.get(0);
        assertEquals("abc-123", c.id);
        assertEquals("Prod DB", c.name);
        assertEquals("dbprod.example.com", c.host);
        assertEquals(1522, c.port);
        assertEquals("PROD", c.serviceName);
        assertEquals("admin", c.username);
        assertEquals("secret", c.password);
        assertEquals("SYSDBA", c.role);
    }

    @Test
    void save_overwritesPreviousData() {
        ConnectionStore store = storeAt("overwrite.json");
        store.save(List.of(config("old-id", "Old DB", "olduser")));

        store.save(List.of(config("new-id", "New DB", "newuser")));
        List<ConnectionConfig> loaded = store.load();

        assertEquals(1, loaded.size());
        assertEquals("new-id", loaded.get(0).id);
        assertEquals("New DB", loaded.get(0).name);
    }

    @Test
    void saveAndLoad_tnsAliasConfig_roundTripsUrl() {
        ConnectionStore store = storeAt("tns.json");
        ConnectionConfig original = new ConnectionConfig();
        original.id = "tns-1";
        original.name = "TNS DB";
        original.tnsAlias = "MYDB";

        store.save(List.of(original));
        List<ConnectionConfig> loaded = store.load();

        assertEquals(1, loaded.size());
        assertEquals("MYDB", loaded.get(0).tnsAlias);
        assertEquals("jdbc:oracle:thin:@MYDB", loaded.get(0).toJdbcUrl());
    }
}

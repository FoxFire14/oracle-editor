package com.oracleeditor.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ConnectionConfigTest {

    @Test
    void toJdbcUrl_basicMode_buildsHostPortServiceUrl() {
        ConnectionConfig config = new ConnectionConfig();
        config.host = "localhost";
        config.port = 1521;
        config.serviceName = "FREEPDB1";

        String url = config.toJdbcUrl();

        assertEquals("jdbc:oracle:thin:@//localhost:1521/FREEPDB1", url);
    }

    @Test
    void toJdbcUrl_defaultPort_is1521() {
        ConnectionConfig config = new ConnectionConfig();
        config.host = "dbserver";
        config.serviceName = "ORCL";
        // port defaults to 1521 via field initializer

        String url = config.toJdbcUrl();

        assertEquals("jdbc:oracle:thin:@//dbserver:1521/ORCL", url);
    }

    @Test
    void toJdbcUrl_customPort_usedInUrl() {
        ConnectionConfig config = new ConnectionConfig();
        config.host = "dbserver";
        config.port = 1522;
        config.serviceName = "ORCL";

        String url = config.toJdbcUrl();

        assertEquals("jdbc:oracle:thin:@//dbserver:1522/ORCL", url);
    }

    @Test
    void toJdbcUrl_tnsMode_buildsTnsUrl() {
        ConnectionConfig config = new ConnectionConfig();
        config.tnsAlias = "MYDB";

        String url = config.toJdbcUrl();

        assertEquals("jdbc:oracle:thin:@MYDB", url);
    }

    @Test
    void toJdbcUrl_tnsMode_takesOverBasicFields() {
        ConnectionConfig config = new ConnectionConfig();
        config.host = "localhost";
        config.port = 1521;
        config.serviceName = "FREEPDB1";
        config.tnsAlias = "MYDB";

        String url = config.toJdbcUrl();

        assertEquals("jdbc:oracle:thin:@MYDB", url);
    }

    @Test
    void toJdbcUrl_jdbcUrlMode_returnsJdbcUrlAsIs() {
        ConnectionConfig config = new ConnectionConfig();
        config.jdbcUrl = "jdbc:oracle:thin:@custom";
        config.host = "localhost";
        config.tnsAlias = "IGNORED";

        String url = config.toJdbcUrl();

        assertEquals("jdbc:oracle:thin:@custom", url);
    }

    @Test
    void toJdbcUrl_jdbcUrlMode_blankJdbcUrl_fallsBackToTns() {
        ConnectionConfig config = new ConnectionConfig();
        config.jdbcUrl = "   ";
        config.tnsAlias = "MYALIAS";

        String url = config.toJdbcUrl();

        assertEquals("jdbc:oracle:thin:@MYALIAS", url);
    }

    @Test
    void toJdbcUrl_jdbcUrlMode_blankJdbcUrl_blankTns_fallsBackToBasic() {
        ConnectionConfig config = new ConnectionConfig();
        config.jdbcUrl = "";
        config.tnsAlias = "";
        config.host = "myhost";
        config.port = 1521;
        config.serviceName = "SVC";

        String url = config.toJdbcUrl();

        assertEquals("jdbc:oracle:thin:@//myhost:1521/SVC", url);
    }

    @Test
    void toJdbcUrl_tnsAlias_blank_fallsBackToBasic() {
        ConnectionConfig config = new ConnectionConfig();
        config.tnsAlias = "  ";
        config.host = "myhost";
        config.port = 1521;
        config.serviceName = "SVC";

        String url = config.toJdbcUrl();

        assertEquals("jdbc:oracle:thin:@//myhost:1521/SVC", url);
    }
}

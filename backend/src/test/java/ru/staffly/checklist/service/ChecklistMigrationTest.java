package ru.staffly.checklist.service;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfSystemProperty(named = "checklist.test.postgres.url", matches = ".+")
class ChecklistMigrationTest {
    @Test void fullPostgresMigrationChainKeepsHistoricalReferencesAndAddsRevision() throws Exception {
        String url = System.getProperty("checklist.test.postgres.url");
        String user = System.getProperty("checklist.test.postgres.user", "checklist_audit");
        Flyway.configure().dataSource(url, user, "").locations("classpath:db/migration").load().migrate();
        try (var connection = DriverManager.getConnection(url, user, ""); var statement = connection.createStatement()) {
            try (var rows = statement.executeQuery("SELECT version, deleted_at FROM checklist LIMIT 0")) {
                assertEquals("int8", rows.getMetaData().getColumnTypeName(1));
                assertEquals("timestamptz", rows.getMetaData().getColumnTypeName(2));
            }
            try (var rows = statement.executeQuery("SELECT indexdef FROM pg_indexes WHERE indexname='uq_checklist_history_auto_reset'")) {
                assertTrue(rows.next()); assertTrue(rows.getString(1).contains("AUTO"));
            }
            try (var rows = statement.executeQuery("SELECT count(*) FROM pg_constraint WHERE conrelid='checklist_item_history'::regclass AND confdeltype='n'")) {
                rows.next(); assertTrue(rows.getInt(1) >= 1, "Deleting a source item must preserve its history with a null reference");
            }
        }
    }
}

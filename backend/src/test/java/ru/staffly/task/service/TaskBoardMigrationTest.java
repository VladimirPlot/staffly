package ru.staffly.task.service;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers(disabledWithoutDocker = true)
class TaskBoardMigrationTest {
    @Container static PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16");

    @Test void fullMigrationChainCreatesBoardSchemaInPostgres() throws Exception {
        Flyway.configure().dataSource(database.getJdbcUrl(), database.getUsername(), database.getPassword())
                .locations("classpath:db/migration").load().migrate();
        try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(), database.getPassword());
             var statement = connection.createStatement()) {
            try (var rows = statement.executeQuery("SELECT completion_mode, audience, activity_version, due_time FROM task LIMIT 0")) {
                assertEquals(4, rows.getMetaData().getColumnCount());
                assertEquals("time", rows.getMetaData().getColumnTypeName(4));
            }
            try (var rows = statement.executeQuery("SELECT completed_at, joined_at, left_at FROM task_participant LIMIT 0")) {
                assertEquals("timestamptz", rows.getMetaData().getColumnTypeName(1));
            }
            try (var rows = statement.executeQuery("SELECT task_decisions FROM invitation LIMIT 0")) {
                assertEquals("jsonb", rows.getMetaData().getColumnTypeName(1));
            }
        }
    }
}

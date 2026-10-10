package ru.staffly.checklist.service;

import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@EnabledIfSystemProperty(named = "checklist.test.postgres.url", matches = ".+")
@DataJpaTest(properties = {"spring.flyway.enabled=true", "spring.jpa.hibernate.ddl-auto=none"}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ChecklistPostgresPersistenceTest extends ChecklistPersistenceTest {
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> System.getProperty("checklist.test.postgres.url"));
        properties.add("spring.datasource.username", () -> System.getProperty("checklist.test.postgres.user", "checklist_audit"));
        properties.add("spring.datasource.password", () -> "");
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }
}

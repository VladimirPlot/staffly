package ru.staffly.training.repository;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.model.*;

import java.util.List;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

@EnabledIfSystemProperty(named = "training.test.postgres.url", matches = ".+")
@DataJpaTest(properties = {"spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop"}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TrainingQuestionPostgresPersistenceTest {
    @Autowired EntityManager em;
    @Autowired TrainingQuestionRepository questions;
    Restaurant restaurant;
    TrainingFolder folder;

    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        var url = System.getProperty("training.test.postgres.url");
        if (!url.split("\\?", 2)[0].endsWith("/staffly_training_query_test")) {
            throw new IllegalArgumentException("Use a disposable staffly_training_query_test database: this test creates and drops its schema.");
        }
        properties.add("spring.datasource.url", () -> url);
        properties.add("spring.datasource.username", () -> "postgres");
        properties.add("spring.datasource.password", () -> "fixture");
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    @BeforeEach void setup() {
        restaurant = Restaurant.builder().name("Fixture").code("training-query-fixture").timezone("Europe/Moscow").build();
        em.persist(restaurant);
        folder = TrainingFolder.builder().restaurant(restaurant).name("Questions").type(TrainingFolderType.QUESTION_BANK).build();
        em.persist(folder);
        add("Меню", "Какая температура подачи?", TrainingQuestionGroup.CERTIFICATION, true, 1);
        add("Кофе", "Как приготовить напиток?", TrainingQuestionGroup.CERTIFICATION, true, 0);
        add("Hidden", "Hidden", TrainingQuestionGroup.CERTIFICATION, false, 2);
        add("Practice", "Practice", TrainingQuestionGroup.PRACTICE, true, 3);
        em.flush(); em.clear();
    }

    void add(String title, String prompt, TrainingQuestionGroup group, boolean active, int order) {
        em.persist(TrainingQuestion.builder().restaurant(restaurant).folder(folder).title(title).prompt(prompt)
                .type(TrainingQuestionType.SINGLE).questionGroup(group).active(active).sortOrder(order).build());
    }

    @Test void sourceScopeMigrationPreservesLegacyDirectScopesAndPersistsRecursiveScopes() throws Exception {
        var exam = TrainingExam.builder().restaurant(em.getReference(Restaurant.class, restaurant.getId()))
                .title("Fixture exam").mode(TrainingExamMode.CERTIFICATION).questionCount(1).passPercent(80).attemptLimit(2).build();
        em.persist(exam);
        var source = TrainingExamSourceFolder.builder().exam(exam).folder(em.getReference(TrainingFolder.class, folder.getId()))
                .pickMode(TrainingExamSourcePickMode.ALL).build();
        em.persist(source);
        var spec = CertificationAssessmentSpecification.builder().exam(exam).version(1).questionCount(1)
                .passPercent(80).questionPoolJson("[]").build();
        em.persist(spec);
        var frozenSource = CertificationAssessmentFolderSource.builder().specification(spec).folderId(folder.getId())
                .pickMode(TrainingExamSourcePickMode.ALL).build();
        em.persist(frozenSource); em.flush(); em.clear();
        em.createNativeQuery("ALTER TABLE training_exam_source_folder DROP COLUMN include_descendants").executeUpdate();
        em.createNativeQuery("ALTER TABLE certification_assessment_folder_source DROP COLUMN include_descendants").executeUpdate();
        for (var sql : Files.readString(Path.of("src/main/resources/db/migration/V133__exam_source_folder_scope.sql")).split(";")) {
            if (!sql.isBlank()) em.createNativeQuery(sql).executeUpdate();
        }
        assertFalse(em.find(TrainingExamSourceFolder.class, source.getId()).isIncludeDescendants());
        assertFalse(em.find(CertificationAssessmentFolderSource.class, frozenSource.getId()).isIncludeDescendants());
        em.find(TrainingExamSourceFolder.class, source.getId()).setIncludeDescendants(true);
        em.flush(); em.clear();
        assertTrue(em.find(TrainingExamSourceFolder.class, source.getId()).isIncludeDescendants());
    }

    List<String> list(String query, TrainingQuestionGroup group, boolean inactive) {
        return questions.listForFolder(restaurant.getId(), folder.getId(), group, inactive, query)
                .stream().map(TrainingQuestion::getTitle).toList();
    }

    @Test void absentEmptyAndWhitespaceSearchLoadTheSameOrderedQuestions() {
        for (String query : new String[] { null, "", "   " }) {
            assertEquals(List.of("Кофе", "Меню"), list(query, TrainingQuestionGroup.CERTIFICATION, false));
        }
    }

    @Test void searchFindsTitlesAndPromptsIgnoringCase() {
        assertEquals(List.of("Меню"), list("МЕНЮ", TrainingQuestionGroup.CERTIFICATION, false));
        assertEquals(List.of("Кофе"), list("НАПИТОК", TrainingQuestionGroup.CERTIFICATION, false));
        assertEquals(List.of(), list("absent", TrainingQuestionGroup.CERTIFICATION, false));
    }

    @Test void optionalGroupAndVisibilityDoNotBreakIsolation() {
        assertEquals(List.of("Кофе", "Меню", "Hidden", "Practice"), list(null, null, true));
        assertEquals(List.of("Practice"), list(null, TrainingQuestionGroup.PRACTICE, false));
        assertEquals(List.of(), questions.listForFolder(restaurant.getId() + 1, folder.getId(), null, true, null));
        assertEquals(List.of(), questions.listForFolder(restaurant.getId(), folder.getId() + 1, null, true, null));
    }
}

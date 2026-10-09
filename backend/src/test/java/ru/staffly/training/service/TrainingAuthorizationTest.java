package ru.staffly.training.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.model.PositionSpecialization;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.security.UserPrincipal;
import ru.staffly.training.controller.TrainingController;
import ru.staffly.training.dto.CreateTrainingFolderRequest;
import ru.staffly.training.dto.UpdateTrainingFolderRequest;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Real method security, policies and listing services; repositories are isolated test doubles. */
class TrainingAuthorizationTest {
    @Mock RestaurantMemberRepository members;
    @Mock PositionRepository positions;
    @Mock RestaurantRepository restaurants;
    @Mock TrainingExamRepository exams;
    @Mock TrainingFolderRepository folders;
    @Mock TrainingExamSourceFolderRepository sourceFolders;
    @Mock TrainingExamSourceQuestionRepository sourceQuestions;
    @Mock TrainingExamAssignmentRepository assignments;
    @Mock TrainingExamAttemptRepository attempts;
    @Mock CertificationAnalyticsService certificationAnalyticsService;
    @InjectMocks ExamServiceImpl examService;
    @InjectMocks KnowledgeServiceImpl knowledgeService;

    TrainingPolicyService policy;
    TrainingExamAccessService access;
    TrainingController controller;
    AnnotationConfigApplicationContext context;
    AutoCloseable mocks;
    UserPrincipal principal;
    final Restaurant restaurant = Restaurant.builder().id(1L).build();
    final Position staffPosition = Position.builder().id(11L).restaurant(restaurant).level(RestaurantRole.STAFF).build();
    final Position managerPosition = Position.builder().id(12L).restaurant(restaurant).level(RestaurantRole.MANAGER).build();
    final Position adminPosition = Position.builder().id(13L).restaurant(restaurant).level(RestaurantRole.ADMIN).build();

    @Configuration(proxyBeanMethods = false)
    @EnableMethodSecurity
    static class MethodSecurityConfig {}

    @BeforeEach void setUp() {
        SecurityContextHolder.clearContext();
        mocks = MockitoAnnotations.openMocks(this);
        policy = new TrainingPolicyService(members, positions);
        access = new TrainingExamAccessService(exams, members, policy);
        var folderManagement = new CertificationFolderManagementService(folders, exams, policy);
        ReflectionTestUtils.setField(examService, "trainingPolicyService", policy);
        ReflectionTestUtils.setField(examService, "examAccessService", access);
        ReflectionTestUtils.setField(knowledgeService, "trainingPolicyService", policy);
        ReflectionTestUtils.setField(knowledgeService, "certificationFolderManagementService", folderManagement);
        ReflectionTestUtils.setField(knowledgeService, "activeContainerValidator", new TrainingActiveContainerValidator());
        var security = new SecurityService(members, restaurants);
        var target = new TrainingController(knowledgeService, mock(QuestionService.class), examService,
                mock(CertificationEmployeeAnalyticsService.class), folderManagement, security, policy);
        context = new AnnotationConfigApplicationContext();
        context.register(MethodSecurityConfig.class);
        context.registerBean("securityService", SecurityService.class, () -> security);
        context.registerBean("trainingPolicyService", TrainingPolicyService.class, () -> policy);
        context.registerBean(TrainingController.class, () -> target);
        context.refresh();
        controller = context.getBean(TrainingController.class);
        when(positions.findByRestaurantId(1L)).thenReturn(List.of(staffPosition, managerPosition, adminPosition));
    }

    @AfterEach void tearDown() throws Exception {
        SecurityContextHolder.clearContext();
        if (context != null) context.close();
        if (mocks != null) mocks.close();
    }

    void authenticate(boolean creator) {
        principal = new UserPrincipal(7L, "+79999999999", null, creator ? List.of("CREATOR") : List.of());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.authorities()));
    }

    void member(RestaurantRole role, boolean examiner) {
        authenticate(false);
        var position = Position.builder().id(20L).level(role)
                .specializations(examiner ? Set.of(PositionSpecialization.EXAMINER) : Set.of()).build();
        var member = RestaurantMember.builder().id(42L).restaurant(restaurant).position(position).build();
        when(members.findActiveByUserIdAndRestaurantId(7L, 1L)).thenReturn(Optional.of(member));
        when(members.findActiveByUserIdAndRestaurantIdWithPosition(7L, 1L)).thenReturn(Optional.of(member));
    }

    TrainingExam certification(long id, Position target, boolean active) {
        return TrainingExam.builder().id(id).restaurant(restaurant).title("Certification " + id)
                .mode(TrainingExamMode.CERTIFICATION).active(active).visibilityPositions(Set.of(target)).build();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void creatorListsCertificationManagementWithoutMembership(boolean includeInactive) {
        authenticate(true);
        var exam = certification(100L, adminPosition, !includeInactive);
        if (includeInactive) when(exams.findByRestaurantIdWithVisibilityOrderByCreatedAtDesc(1L)).thenReturn(List.of(exam));
        else when(exams.findByRestaurantIdAndActiveTrueWithVisibilityOrderByCreatedAtDesc(1L)).thenReturn(List.of(exam));

        assertEquals(List.of(100L), controller.listExams(1L, principal, includeInactive, true)
                .stream().map(dto -> dto.id()).toList());
        verifyNoInteractions(members, assignments, attempts);
    }

    @ParameterizedTest
    @EnumSource(TrainingFolderType.class)
    void creatorListsInactiveManagementFoldersWithoutMembership(TrainingFolderType type) {
        authenticate(true);
        var folder = TrainingFolder.builder().id(50L).restaurant(restaurant).name("Hidden folder")
                .type(type).active(false).visibilityPositions(Set.of(adminPosition)).build();
        when(folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(1L, type))
                .thenReturn(List.of(folder));
        assertEquals(List.of(50L), controller.listFolders(1L, principal, type, true)
                .stream().map(dto -> dto.id()).toList());
        verifyNoInteractions(members, assignments, attempts);
    }

    @Test void creatorListsKnowledgePracticeExamsWithoutMembership() {
        authenticate(true);
        var folder = TrainingFolder.builder().id(50L).restaurant(restaurant).name("Knowledge")
                .type(TrainingFolderType.KNOWLEDGE).visibilityPositions(Set.of(adminPosition)).build();
        var exam = TrainingExam.builder().id(101L).restaurant(restaurant).title("Practice")
                .mode(TrainingExamMode.PRACTICE).folder(folder).active(false).build();
        when(folders.findByIdAndRestaurantIdWithVisibility(50L, 1L)).thenReturn(Optional.of(folder));
        when(exams.listPracticeByKnowledgeFolder(1L, 50L, true, null)).thenReturn(List.of(exam));
        assertEquals(101L, controller.listKnowledgeExams(1L, principal, 50L, true).get(0).id());
        verifyNoInteractions(members, assignments, attempts);
    }

    @Test void creatorCreatesAndUpdatesCertificationFolderWithoutSyntheticMembership() {
        authenticate(true);
        when(folders.save(any())).thenAnswer(invocation -> {
            TrainingFolder folder = invocation.getArgument(0);
            folder.setId(50L);
            return folder;
        });
        when(positions.findAllById(Set.of(13L))).thenReturn(List.of(adminPosition));
        var request = new CreateTrainingFolderRequest(null, "Certification", null,
                TrainingFolderType.CERTIFICATION, 0, List.of(13L));
        var created = controller.createFolder(1L, principal, request);
        assertEquals(50L, created.id());
        var folder = TrainingFolder.builder().id(50L).restaurant(restaurant).type(TrainingFolderType.CERTIFICATION)
                .name("Certification").visibilityPositions(Set.of(adminPosition)).build();
        when(folders.findByIdAndRestaurantIdWithVisibility(50L, 1L)).thenReturn(Optional.of(folder));
        when(folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(1L, TrainingFolderType.CERTIFICATION))
                .thenReturn(List.of(folder));
        assertEquals("Renamed", controller.updateFolder(1L, 50L, principal,
                new UpdateTrainingFolderRequest("Renamed", null, null, null)).name());
        verifyNoInteractions(members, assignments, attempts);
    }

    @ParameterizedTest
    @ValueSource(strings = {"my-certifications", "my-result", "practice-progress", "start", "submit"})
    void creatorCannotInvokePersonalEndpointsWithoutMembership(String action) {
        authenticate(true);
        assertThrows(AccessDeniedException.class, () -> invokePersonal(action));
        verifyNoInteractions(exams, assignments, attempts);
    }

    void invokePersonal(String action) {
        switch (action) {
            case "my-certifications" -> controller.listCurrentUserCertifications(1L, principal);
            case "my-result" -> controller.getCurrentUserCertificationResult(1L, 100L, principal);
            case "practice-progress" -> controller.listPracticeExamProgress(1L, principal);
            case "start" -> controller.startExam(1L, 100L, principal);
            case "submit" -> controller.submitAttempt(1L, 100L, principal, null);
            default -> fail("Unknown personal endpoint");
        }
    }

    @Test void personalServicesAlsoRejectCreatorBeforeReadingOrRepairingAssignments() {
        authenticate(true);
        assertThrows(ForbiddenException.class, () -> examService.listCurrentUserCertificationExams(1L, 7L));
        assertThrows(ForbiddenException.class, () -> examService.getCurrentUserCertificationResult(1L, 100L, 7L, true));
        assertThrows(ForbiddenException.class, () -> examService.listCurrentUserPracticeExamProgress(1L, 7L));
        assertThrows(ForbiddenException.class, () -> examService.startExam(1L, 100L, 7L, true));
        assertThrows(ForbiddenException.class, () -> examService.submitAttempt(1L, 100L, 7L, null));
        verifyNoInteractions(exams, assignments, attempts);
    }

    @Test void ordinaryStaffCanReadKnowledgeButCannotManageOrIncludeInactiveExams() {
        member(RestaurantRole.STAFF, false);
        assertFalse(policy.canManageTraining(7L, 1L));
        assertDoesNotThrow(() -> controller.listFolders(1L, principal, TrainingFolderType.KNOWLEDGE, false));
        assertThrows(ForbiddenException.class, () -> controller.listFolders(1L, principal, TrainingFolderType.CERTIFICATION, false));
        assertThrows(ForbiddenException.class, () -> controller.listFolders(1L, principal, TrainingFolderType.QUESTION_BANK, false));
        assertThrows(AccessDeniedException.class, () -> controller.createFolder(1L, principal, null));
        assertThrows(AccessDeniedException.class, () -> controller.listQuestions(1L, principal, 50L, null, false, null));
        assertThrows(AccessDeniedException.class, () -> controller.createExam(1L, principal, null));
        assertThrows(ForbiddenException.class, () -> controller.listExams(1L, principal, true, true));
        assertDoesNotThrow(() -> controller.listCurrentUserCertifications(1L, principal));
    }

    @ParameterizedTest
    @EnumSource(value = RestaurantRole.class, names = {"MANAGER", "ADMIN"})
    void managementRolesRetainCertificationScopesAndPersonalMembership(RestaurantRole role) {
        member(role, false);
        var staffExam = certification(100L, staffPosition, false);
        var managerExam = certification(101L, managerPosition, false);
        var adminExam = certification(102L, adminPosition, false);
        when(exams.findByRestaurantIdWithVisibilityOrderByCreatedAtDesc(1L))
                .thenReturn(List.of(staffExam, managerExam, adminExam));
        var expected = role == RestaurantRole.MANAGER ? List.of(100L) : List.of(100L, 101L);
        assertEquals(expected, controller.listExams(1L, principal, true, true).stream().map(dto -> dto.id()).toList());
        verify(members, atLeastOnce()).findActiveByUserIdAndRestaurantIdWithPosition(7L, 1L);
        assertFalse(policy.canManageCertificationTargets(7L, 1L, Set.of(11L, 13L)));
        assertDoesNotThrow(() -> controller.listCurrentUserCertifications(1L, principal));
    }

    @Test void examinerRetainsFullManagementScopeAndRealMembership() {
        member(RestaurantRole.STAFF, true);
        var exam = certification(102L, adminPosition, false);
        when(exams.findByRestaurantIdWithVisibilityOrderByCreatedAtDesc(1L)).thenReturn(List.of(exam));
        assertEquals(102L, controller.listExams(1L, principal, true, true).get(0).id());
        assertTrue(policy.canManageCertificationTargets(7L, 1L, Set.of(11L, 12L, 13L)));
        verify(members, atLeastOnce()).findActiveByUserIdAndRestaurantIdWithPosition(7L, 1L);
        assertDoesNotThrow(() -> controller.listCurrentUserCertifications(1L, principal));
    }

    @Test void staffExamReadKeepsPositionFilterAndIgnoresInactiveFlag() {
        member(RestaurantRole.STAFF, false);
        access.listVisibleExams(1L, 7L, false, true, TrainingExamMode.PRACTICE);
        verify(exams).listVisibleForStaff(1L, 20L, TrainingExamMode.PRACTICE);
        verify(exams, never()).findByRestaurantIdWithVisibilityOrderByCreatedAtDesc(anyLong());
    }

    @Test void managementReadBypassDoesNotApplyToStartOrPersonalProgress() {
        authenticate(true);
        assertThrows(ForbiddenException.class, () -> access.ensureCanStartExam(
                certification(100L, adminPosition, true), 1L, 7L, true));
        assertThrows(ForbiddenException.class, () -> access.listVisiblePracticeExamIdsForUser(1L, 7L));
    }

    @Test void creatorAuthorityDoesNotGeneratePersonalAudienceAssignments() {
        authenticate(true);
        var service = new CertificationAssignmentService(assignments, attempts, members,
                mock(CertificationAssessmentSpecificationService.class), mock(CertificationAssignmentCycleRepository.class),
                mock(jakarta.persistence.EntityManager.class));
        var result = service.syncAudienceAssignmentsWithEffects(certification(100L, adminPosition, true));
        assertTrue(result.createdAssignments().isEmpty());
        verify(assignments, never()).save(any());
        verify(members, never()).save(any());
    }

    @ParameterizedTest
    @EnumSource(value = RestaurantRole.class, names = {"MANAGER", "ADMIN"})
    void certificationFolderNavigationDoesNotGrantAuthorityOverOutOfScopeDescendants(RestaurantRole role) {
        member(role, false);
        var parent = TrainingFolder.builder().id(50L).restaurant(restaurant).name("Parent")
                .type(TrainingFolderType.CERTIFICATION).visibilityPositions(Set.of(staffPosition)).build();
        var child = TrainingFolder.builder().id(51L).restaurant(restaurant).name("Admin child").parent(parent)
                .type(TrainingFolderType.CERTIFICATION).visibilityPositions(Set.of(adminPosition)).build();
        when(folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(1L, TrainingFolderType.CERTIFICATION))
                .thenReturn(List.of(parent, child));
        var visible = controller.listFolders(1L, principal, TrainingFolderType.CERTIFICATION, true);
        assertEquals(List.of(50L), visible.stream().map(dto -> dto.id()).toList());
        assertFalse(visible.get(0).manageable());
        when(folders.findByIdAndRestaurantIdWithVisibility(50L, 1L)).thenReturn(Optional.of(parent));
        assertThrows(ForbiddenException.class, () -> controller.updateFolder(1L, 50L, principal,
                new UpdateTrainingFolderRequest("Renamed", null, null, null)));
        verify(folders, never()).save(any());
    }

    @Test void creatorWithRealMembershipUsesTheExistingEmployeeFlow() {
        member(RestaurantRole.STAFF, false);
        authenticate(true);
        assertDoesNotThrow(() -> controller.listCurrentUserCertifications(1L, principal));
        verify(assignments).findActiveCertificationAssignmentsForUser(1L, 7L);
        verify(assignments, never()).save(any());
    }

    @Test void lockedRestaurantStillBlocksMemberSharedAndPersonalReads() {
        member(RestaurantRole.MANAGER, false);
        when(restaurants.findById(1L)).thenReturn(Optional.of(Restaurant.builder().id(1L).locked(true).build()));
        assertThrows(AccessDeniedException.class, () -> controller.listExams(1L, principal, true, true));
        assertThrows(AccessDeniedException.class, () -> controller.listCurrentUserCertifications(1L, principal));
    }
}

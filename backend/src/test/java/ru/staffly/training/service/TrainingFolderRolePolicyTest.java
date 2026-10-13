package ru.staffly.training.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
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
import ru.staffly.security.SecurityService;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TrainingFolderRolePolicyTest {
    final Restaurant restaurant = Restaurant.builder().id(1L).build();
    final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    final PositionRepository positions = mock(PositionRepository.class);
    final SecurityService security = mock(SecurityService.class);
    final TrainingPolicyService policy = new TrainingPolicyService(members, positions, security);

    @BeforeEach void unlocked() {
        SecurityContextHolder.clearContext();
        when(security.isRestaurantUnlocked(1L)).thenReturn(true);
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    void member(RestaurantRole role, boolean examiner) {
        var position = Position.builder().id(20L).restaurant(restaurant).level(role)
                .specializations(examiner ? Set.of(PositionSpecialization.EXAMINER) : Set.of()).build();
        when(members.findActiveByUserIdAndRestaurantIdWithPosition(7L, 1L))
                .thenReturn(Optional.of(RestaurantMember.builder().position(position).restaurant(restaurant).build()));
    }
    TrainingFolder folder(TrainingFolderType type, RestaurantRole role) {
        return TrainingFolder.builder().id(50L).restaurant(restaurant).type(type).targetRole(role).build();
    }

    @ParameterizedTest
    @CsvSource({
            "STAFF,false,STAFF,false", "STAFF,false,MANAGER,false", "STAFF,false,ADMIN,false",
            "MANAGER,false,STAFF,true", "MANAGER,false,MANAGER,false", "MANAGER,false,ADMIN,false",
            "ADMIN,false,STAFF,true", "ADMIN,false,MANAGER,true", "ADMIN,false,ADMIN,false",
            "STAFF,true,STAFF,true", "STAFF,true,MANAGER,true", "STAFF,true,ADMIN,true",
            "MANAGER,true,STAFF,true", "MANAGER,true,MANAGER,true", "MANAGER,true,ADMIN,true",
            "ADMIN,true,STAFF,true", "ADMIN,true,MANAGER,true", "ADMIN,true,ADMIN,true"
    })
    void allBaseRolesAndExaminerOverrides(RestaurantRole actor, boolean examiner, RestaurantRole target, boolean expected) {
        member(actor, examiner);
        for (var type : List.of(TrainingFolderType.QUESTION_BANK, TrainingFolderType.CERTIFICATION)) {
            var folder = folder(type, target);
            assertEquals(expected, policy.canAccessManagementFolder(7L, 1L, folder));
            if (expected) assertDoesNotThrow(() -> policy.assertCanAccessManagementFolder(7L, 1L, folder));
            else assertThrows(ForbiddenException.class, () -> policy.assertCanAccessManagementFolder(7L, 1L, folder));
        }
        // No position list is necessary: adding/deactivating a job title cannot change the role protection.
        verifyNoInteractions(positions);
    }

    @ParameterizedTest @EnumSource(RestaurantRole.class)
    void creatorWithoutRestaurantMembershipCanPrepareEveryRole(RestaurantRole target) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "support", null, List.of(new SimpleGrantedAuthority("ROLE_CREATOR"))));
        assertTrue(policy.canAccessManagementFolder(7L, 1L, folder(TrainingFolderType.QUESTION_BANK, target)));
        verifyNoInteractions(members, positions);
    }

    @Test void directChildIdCannotBypassProtectedParent() {
        member(RestaurantRole.MANAGER, false);
        var parent = folder(TrainingFolderType.QUESTION_BANK, RestaurantRole.MANAGER);
        var child = folder(TrainingFolderType.QUESTION_BANK, RestaurantRole.STAFF);
        child.setId(51L); child.setParent(parent);
        assertFalse(policy.canAccessManagementFolder(7L, 1L, child));
    }

    @Test void managerCannotReadOtherManagerQuestionsByDirectFolderId() {
        member(RestaurantRole.MANAGER, false);
        var folders = mock(TrainingFolderRepository.class);
        var questions = mock(TrainingQuestionRepository.class);
        var service = mock(QuestionServiceImpl.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service, "folders", folders);
        ReflectionTestUtils.setField(service, "questions", questions);
        ReflectionTestUtils.setField(service, "trainingPolicyService", policy);
        when(folders.findByIdAndRestaurantIdWithVisibility(50L, 1L))
                .thenReturn(Optional.of(folder(TrainingFolderType.QUESTION_BANK, RestaurantRole.MANAGER)));
        assertThrows(ForbiddenException.class, () -> service.listQuestions(1L, 7L, 50L, TrainingQuestionGroup.CERTIFICATION, false, null));
        verifyNoInteractions(questions);
    }

    @Test void recursiveQuestionSelectionCannotIncludeProtectedDescendant() {
        member(RestaurantRole.MANAGER, false);
        var root = folder(TrainingFolderType.QUESTION_BANK, RestaurantRole.STAFF);
        var child = folder(TrainingFolderType.QUESTION_BANK, RestaurantRole.MANAGER);
        child.setId(51L); child.setParent(root);
        var folders = mock(TrainingFolderRepository.class);
        when(folders.findByIdAndRestaurantIdWithVisibility(50L, 1L)).thenReturn(Optional.of(root));
        when(folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(1L, TrainingFolderType.QUESTION_BANK))
                .thenReturn(List.of(root, child));
        var resolver = new ExamQuestionPoolResolver(mock(TrainingExamSourceFolderRepository.class),
                mock(TrainingExamSourceQuestionRepository.class), mock(TrainingQuestionRepository.class), folders,
                policy, new TrainingActiveContainerValidator(), mock(CertificationQuestionSnapshotService.class));
        assertThrows(ForbiddenException.class, () -> resolver.resolveAvailableQuestionCount(1L, 7L, TrainingExamMode.CERTIFICATION,
                List.of(new ru.staffly.training.dto.ExamSourceFolderDto(50L, TrainingExamSourcePickMode.ALL, null, true)), List.of()));
    }

    @Test void legacyMixedBankScopeCannotBeReadThroughItsStaffPart() {
        member(RestaurantRole.MANAGER, false);
        var staff = Position.builder().id(11L).level(RestaurantRole.STAFF).build();
        var manager = Position.builder().id(12L).level(RestaurantRole.MANAGER).build();
        when(positions.findByRestaurantId(1L)).thenReturn(List.of(staff, manager));
        assertFalse(policy.canAccessQuestionBankByVisibility(7L, 1L, Set.of(11L, 12L)));
    }

    @Test void movingCertificationCannotPutStaffAudienceIntoManagerFolder() {
        member(RestaurantRole.ADMIN, false);
        var exams = mock(TrainingExamRepository.class);
        var folders = mock(TrainingFolderRepository.class);
        var oldFolder = folder(TrainingFolderType.CERTIFICATION, RestaurantRole.STAFF);
        var target = folder(TrainingFolderType.CERTIFICATION, RestaurantRole.MANAGER); target.setId(51L);
        var exam = TrainingExam.builder().id(100L).restaurant(restaurant).mode(TrainingExamMode.CERTIFICATION)
                .folder(oldFolder).visibilityPositions(Set.of(Position.builder().level(RestaurantRole.STAFF).build())).build();
        var policyMock = mock(TrainingPolicyService.class);
        var service = mock(ExamServiceImpl.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service, "exams", exams);
        ReflectionTestUtils.setField(service, "folders", folders);
        ReflectionTestUtils.setField(service, "entityManager", mock(jakarta.persistence.EntityManager.class));
        var mutex = mock(ru.staffly.member.lifecycle.RestaurantLifecycleMutex.class);
        ReflectionTestUtils.setField(service, "lifecycleMutex", mutex);
        ReflectionTestUtils.setField(service, "trainingPolicyService", policyMock);
        ReflectionTestUtils.setField(service, "activeContainerValidator", new TrainingActiveContainerValidator());
        ReflectionTestUtils.setField(service, "certificationFolderManagementService", mock(CertificationFolderManagementService.class));
        when(exams.findByIdAndRestaurantIdWithVisibility(100L, 1L)).thenReturn(Optional.of(exam));
        when(folders.findByIdAndRestaurantIdWithVisibility(51L, 1L)).thenReturn(Optional.of(target));
        assertThrows(ru.staffly.common.exception.BadRequestException.class, () -> service.moveCertificationExam(1L, 7L, 100L,
                new ru.staffly.training.dto.MoveTrainingCertificationExamRequest(51L, null)));
        assertSame(oldFolder, exam.getFolder());
        verify(mutex).lock(1L);
        verify(exams, never()).flush();
    }
}

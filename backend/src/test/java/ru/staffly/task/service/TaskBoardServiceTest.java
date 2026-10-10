package ru.staffly.task.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.*;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.task.dto.*;
import ru.staffly.task.model.*;
import ru.staffly.task.repository.TaskRepository;
import ru.staffly.user.model.User;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TaskBoardServiceTest {
 private final TaskRepository tasks=mock(TaskRepository.class);
 private final RestaurantMemberRepository members=mock(RestaurantMemberRepository.class);
 private final PositionRepository positions=mock(PositionRepository.class);
 private final RestaurantRepository restaurants=mock(RestaurantRepository.class);
 private final InboxMessageService inbox=mock(InboxMessageService.class);
 private final Instant now=Instant.parse("2026-10-09T21:30:00Z");
 private final Restaurant restaurant=Restaurant.builder().id(1L).timezone("Europe/Moscow").build();
 private final TaskBoardService board=new TaskBoardService(tasks,members,positions,restaurants,
  new RestaurantTimeService(restaurants,Clock.fixed(now,ZoneOffset.UTC)),mock(RestaurantLifecycleMutex.class),mock(SecurityService.class),inbox);
 private final RestaurantMember owner=member(10,100,RestaurantRole.MANAGER,1);
 private final RestaurantMember a=member(20,200,RestaurantRole.STAFF,2);
 private final RestaurantMember b=member(30,300,RestaurantRole.STAFF,3);
 private final Task task=Task.builder().id(5L).restaurant(restaurant).title("Инструкция").priority(TaskPriority.MEDIUM)
  .dueDate(LocalDate.parse("2026-10-10")).status(TaskStatus.ACTIVE).completionMode(TaskCompletionMode.EACH)
  .audience(TaskAudience.POSITIONS).positionIds(new HashSet<>(Set.of(2L,3L))).createdAt(now).createdBy(owner.getUser()).setterMember(owner).build();
 private RestaurantMember member(long id,long uid,RestaurantRole role,long positionId) {
  return RestaurantMember.builder().id(id).restaurant(restaurant).user(User.builder().id(uid).firstName("Сотрудник").lastName(String.valueOf(id)).build())
   .position(Position.builder().id(positionId).restaurant(restaurant).name("Должность "+positionId).active(true).level(role).build()).build();
 }
 private TaskParticipant participant(RestaurantMember m,boolean done) {
  var p=new TaskParticipant();p.setTask(task);p.setMember(m);p.setActive(true);p.setJoinedAt(now.minusSeconds(3600));p.setCompletedAt(done?now.minusSeconds(60):null);task.getParticipants().add(p);return p;
 }
 @BeforeEach void setup() {
  when(tasks.findBoard(1L)).thenReturn(List.of(task));when(tasks.findRestaurantIdByActiveId(5L)).thenReturn(Optional.of(1L));
  when(tasks.findAllForUpdate(1L,List.of(5L))).thenReturn(List.of(task));when(tasks.findActiveById(5L)).thenReturn(Optional.of(task));
  when(tasks.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));when(tasks.save(any())).thenAnswer(i->i.getArgument(0));
  when(restaurants.findById(1L)).thenReturn(Optional.of(restaurant));
  for(var m:List.of(owner,a,b)) {when(members.findActiveByUserIdAndRestaurantId(m.getUser().getId(),1L)).thenReturn(Optional.of(m));when(positions.findById(m.getPosition().getId())).thenReturn(Optional.of(m.getPosition()));}
  when(members.findActiveWithUserAndPositionByRestaurantId(1L)).thenReturn(List.of(owner,a,b));
 }
 @Test void deadlineTimeIsSavedAndReturnedWithoutResettingPersonalProgress() {
  participant(a,true); participant(b,false);
  var dto=board.update(5L,100L,new TaskWriteRequest("Инструкция",null,TaskPriority.MEDIUM,
   "2026-10-10",TaskCompletionMode.EACH,TaskAudience.POSITIONS,List.of(2L,3L),List.of(),10L,0L,false,"12:15"));
  assertEquals(LocalTime.of(12,15),task.getDueTime());assertEquals("12:15",dto.dueTime());
  assertEquals(1,dto.completedCount());
 }
 @Test void overdueUsesRestaurantTimeAndQuarterHourDeadline() {
  task.setDueTime(LocalTime.of(0,45));assertFalse(board.isOverdue(task));
  task.setDueTime(LocalTime.of(0,30));assertTrue(board.isOverdue(task));
  board.notifyOverdue(5L);board.notifyOverdue(5L);
  verify(inbox,times(1)).createEvent(any(),any(),any(),any(),any(),any(),any());
  task.setDueTime(null);assertFalse(board.isOverdue(task));
 }
 @Test void rejectsNonQuarterHourAndPastNewDeadline() {
  assertThrows(BadRequestException.class,()->board.update(5L,100L,new TaskWriteRequest("Инструкция",null,
   TaskPriority.MEDIUM,"2026-10-10",TaskCompletionMode.EACH,TaskAudience.POSITIONS,List.of(2L,3L),List.of(),10L,0L,false,"12:17")));
  assertThrows(BadRequestException.class,()->board.update(5L,100L,new TaskWriteRequest("Инструкция",null,
   TaskPriority.MEDIUM,"2026-10-10",TaskCompletionMode.EACH,TaskAudience.POSITIONS,List.of(2L,3L),List.of(),10L,0L,false,"00:15")));
 }
 @Test void eachRequiresAllCurrentParticipantsAndRepeatedCompletionIsIdempotent() {
  participant(a,false);participant(b,false);
  assertEquals(1,board.complete(5L,200L,false).completedCount());assertEquals(TaskStatus.ACTIVE,task.getStatus());verifyNoInteractions(inbox);
  board.complete(5L,200L,false);assertEquals(1,task.getEvents().size());
  var dto=board.complete(5L,300L,false);assertEquals("COMPLETED",dto.status());assertEquals(2,dto.completedCount());assertEquals(now.toString(),dto.completedAt());
  verify(inbox,times(1)).createEvent(any(),any(),any(),any(),any(),any(),any());
 }
 @Test void managerCannotCompleteSomeoneElsesPersonalObligation(){participant(a,false);assertThrows(ForbiddenException.class,()->board.complete(5L,100L,false));}
 @Test void undoOwnResultReopensTaskButPreservesEvents(){participant(a,true);task.setStatus(TaskStatus.COMPLETED);task.setCompletedAt(LocalDateTime.ofInstant(now,ZoneOffset.UTC));board.complete(5L,200L,true);assertEquals(TaskStatus.ACTIVE,task.getStatus());assertNull(task.getParticipants().get(0).getCompletedAt());assertTrue(task.getEvents().get(0).getText().contains("Отменил"));}
 @Test void movingBetweenSelectedPositionsDoesNotResetCompletionOrAskForDecision(){var p=participant(a,true);participant(b,false);assertTrue(board.opportunities(1L,3L,a).isEmpty());a.setPosition(b.getPosition());board.changePosition(a,3L,List.of(),owner);assertEquals(now.minusSeconds(60),p.getCompletedAt());assertTrue(p.isActive());assertTrue(task.getEvents().isEmpty());}
 @Test void leavingCompletedParticipantChangesBothCountsAndRetainsResult(){var p=participant(a,true);participant(b,false);board.leave(a,owner);var dto=board.dto(task,owner);assertEquals(0,dto.completedCount());assertEquals(1,dto.participantCount());assertFalse(p.isActive());assertNotNull(p.getCompletedAt());assertEquals(TaskStatus.ACTIVE,task.getStatus());}
 @Test void leavingLastPendingParticipantClosesWithAudienceReason(){participant(a,false);participant(b,true);board.leave(a,owner);assertEquals(TaskStatus.COMPLETED,task.getStatus());assertEquals("AUDIENCE_CHANGED",task.getCompletionReason());}
 @Test void emptyRosterNeverCountsAsCompleted(){participant(a,false);board.leave(a,owner);assertEquals(TaskStatus.ACTIVE,task.getStatus());assertEquals(0,board.dto(task,owner).participantCount());}
 @Test void incomingEachNeedsExplicitChoiceAndCanBeSkipped(){participant(b,false);var choices=board.opportunities(1L,2L,a);assertEquals(1,choices.size());assertThrows(ConflictException.class,()->board.validateChoices(1L,2L,a,List.of()));board.validateChoices(1L,2L,a,List.of(new TaskAudienceDecision(5L,0,TaskAudienceDecision.Action.SKIP)));board.changePosition(a,2L,List.of(new TaskAudienceDecision(5L,0,TaskAudienceDecision.Action.SKIP)),owner);assertEquals(1,board.dto(task,owner).participantCount());}
 @Test void rehiringDoesNotCarryCompletionUntilExplicitlyRestored(){var old=participant(a,true);old.setActive(false);a.setEndedAt(now);participant(b,false);var rehire=member(40,200,RestaurantRole.STAFF,2);board.changePosition(rehire,2L,List.of(new TaskAudienceDecision(5L,0,TaskAudienceDecision.Action.ADD)),owner);assertNull(task.getParticipants().get(2).getCompletedAt());}
 @Test void explicitRestoreUsesPreviousResultWithoutReactivatingOldMembership(){var old=participant(a,true);old.setActive(false);a.setEndedAt(now);participant(b,false);var rehire=member(40,200,RestaurantRole.STAFF,2);board.changePosition(rehire,2L,List.of(new TaskAudienceDecision(5L,0,TaskAudienceDecision.Action.RESTORE)),owner);assertFalse(old.isActive());assertEquals(old.getCompletedAt(),task.getParticipants().get(2).getCompletedAt());assertEquals(1,board.dto(task,owner).completedCount());}
 @Test void sharedTaskUsesDynamicPositionUnionAndClosesForEveryone(){task.setCompletionMode(TaskCompletionMode.ANY);participant(b,false);var dto=board.complete(5L,200L,false);assertEquals("COMPLETED",dto.status());assertEquals(2,dto.participantCount());assertEquals(200L,dto.completedBy().id());}
 @Test void completedTaskDoesNotGainNewPeopleOrLoseHistory(){task.setStatus(TaskStatus.COMPLETED);var p=participant(a,true);participant(b,true);var newcomer=member(40,400,RestaurantRole.STAFF,2);board.changePosition(newcomer,2L,List.of(),owner);board.leave(a,owner);a.setEndedAt(now);assertTrue(p.isActive());assertEquals(2,board.dto(task,owner).participantCount());assertFalse(TaskBoardService.visible(task,newcomer));}
 @Test void explicitlyAssignedEmployeeKeepsTaskOnPositionChange(){task.setAudience(TaskAudience.MEMBERS);var p=participant(a,true);a.setPosition(owner.getPosition());board.changePosition(a,1L,List.of(),owner);assertTrue(p.isActive());assertNotNull(p.getCompletedAt());}
 @Test void deadlineOnlyEditDoesNotAddPreviouslySkippedPeopleOrResetResults(){participant(a,true);participant(b,false);var newcomer=member(40,400,RestaurantRole.STAFF,2);when(members.findActiveWithUserAndPositionByRestaurantId(1L)).thenReturn(List.of(owner,a,b,newcomer));var dto=board.update(5L,100L,new TaskWriteRequest("Инструкция",null,TaskPriority.MEDIUM,"2026-10-11",TaskCompletionMode.EACH,TaskAudience.POSITIONS,List.of(2L,3L),List.of(),10L,0L,false));assertEquals(2,dto.participantCount());assertEquals(1,dto.completedCount());}
 @Test void instructionChangeRequiresExplicitReset(){participant(a,true);assertThrows(ConflictException.class,()->board.update(5L,100L,new TaskWriteRequest("Новая инструкция",null,TaskPriority.MEDIUM,"2026-10-10",TaskCompletionMode.EACH,TaskAudience.POSITIONS,List.of(2L,3L),List.of(),10L,0L,false)));assertNotNull(task.getParticipants().get(0).getCompletedAt());}
 @Test void staleEditCannotOverwriteNewerTask(){task.setVersion(3);assertThrows(ConflictException.class,()->board.update(5L,100L,new TaskWriteRequest("Новая",null,TaskPriority.MEDIUM,"2026-10-10",TaskCompletionMode.EACH,TaskAudience.POSITIONS,List.of(2L),List.of(),10L,2L,true)));assertEquals("Инструкция",task.getTitle());}
 @Test void restaurantMidnightDeterminesTodayAndOverdueIsNotRepeated(){assertEquals("2026-10-10",board.dto(task,owner).restaurantToday());board.notifyOverdue(5L);verifyNoInteractions(inbox);task.setDueDate(LocalDate.parse("2026-10-09"));board.notifyOverdue(5L);board.notifyOverdue(5L);verify(inbox,times(1)).createEvent(any(),any(),any(),any(),any(),any(),any());}
 @Test void closedTaskCannotBeEditedUntilReopened(){task.setStatus(TaskStatus.COMPLETED);assertThrows(BadRequestException.class,()->board.update(5L,100L,new TaskWriteRequest("Новая",null,TaskPriority.MEDIUM,"2026-10-10",TaskCompletionMode.EACH,TaskAudience.NONE,List.of(),List.of(),10L,0L,false)));}
}

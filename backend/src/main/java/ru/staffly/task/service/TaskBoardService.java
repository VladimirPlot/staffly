package ru.staffly.task.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.task.dto.*;
import ru.staffly.task.model.*;
import ru.staffly.task.repository.TaskRepository;
import java.time.*;
import java.util.*;

@Service @RequiredArgsConstructor
public class TaskBoardService {
 private final TaskRepository tasks;
 private final RestaurantMemberRepository members;
 private final PositionRepository positions;
 private final RestaurantRepository restaurants;
 private final RestaurantTimeService time;
 private final RestaurantLifecycleMutex mutex;
 private final SecurityService security;
 private final InboxMessageService inbox;

 public static boolean manager(RestaurantMember m) {
  return m != null && m.isActive() && (m.effectiveRole()==RestaurantRole.MANAGER || m.effectiveRole()==RestaurantRole.ADMIN);
 }
 public static boolean matches(Task t, Long positionId) {
  return t.getAudience()==TaskAudience.ALL || (t.getAudience()==TaskAudience.POSITIONS && t.getPositionIds().contains(positionId));
 }
 public static boolean current(TaskParticipant p) { return p.isActive() && p.getMember().isActive(); }
 private List<RestaurantMember> currentMembers(Task t) {
  if(t.getStatus()==TaskStatus.COMPLETED) return t.getParticipants().stream().filter(TaskParticipant::isActive).map(TaskParticipant::getMember).toList();
  if(t.getCompletionMode()==TaskCompletionMode.ANY && (t.getAudience()==TaskAudience.ALL || t.getAudience()==TaskAudience.POSITIONS))
   return members.findActiveWithUserAndPositionByRestaurantId(t.getRestaurant().getId()).stream()
    .filter(m->matches(t,m.getPosition()==null?null:m.getPosition().getId())).toList();
  return t.getParticipants().stream().filter(TaskBoardService::current).map(TaskParticipant::getMember).toList();
 }
 public static boolean visible(Task t, RestaurantMember m) {
  if(manager(m)) return true;
  if(m==null || !m.isActive()) return false;
  if(t.getStatus()==TaskStatus.ACTIVE && t.getCompletionMode()==TaskCompletionMode.ANY && matches(t,m.getPosition()==null?null:m.getPosition().getId())) return true;
  return t.getParticipants().stream().anyMatch(p->Objects.equals(p.getMember().getId(),m.getId()) && (t.getStatus()==TaskStatus.COMPLETED ? p.isActive() : current(p)));
 }
 private RestaurantMember actor(Long userId, Long restaurantId) {
  security.assertMember(userId,restaurantId);
  return members.findActiveByUserIdAndRestaurantId(userId,restaurantId).orElseThrow(()->new ForbiddenException("Нет действующего участия в ресторане"));
 }
 private void manage(RestaurantMember m) { if(!manager(m)) throw new ForbiddenException("Нужны права руководителя"); }
 private Task locked(Long id) {
  Long rid=tasks.findRestaurantIdByActiveId(id).orElseThrow(()->new NotFoundException("Задача не найдена"));
  mutex.lock(rid);
  return tasks.findAllForUpdate(rid,List.of(id)).stream().filter(t->t.getDeletedAt()==null).findFirst().orElseThrow(()->new NotFoundException("Задача не найдена"));
 }
 @Transactional(readOnly=true) public List<TaskDto> list(Long rid, Long uid, TaskService.TaskScope scope) {
  return list(rid,uid,scope,null,null);
 }
 @Transactional(readOnly=true) public List<TaskDto> list(Long rid, Long uid, TaskService.TaskScope scope, TaskStatus status, Boolean overdue) {
  var m=actor(uid,rid);
  return tasks.findBoard(rid).stream().filter(t->scope==TaskService.TaskScope.ALL && manager(m) || isMine(t,m))
   .filter(t->status==null||t.getStatus()==status)
   .filter(t->overdue==null||!overdue||isOverdue(t)).map(t->dto(t,m)).toList();
 }
 private boolean isMine(Task t, RestaurantMember m) {
  return currentMembers(t).stream().anyMatch(x->Objects.equals(x.getId(),m.getId()));
 }
 @Transactional(readOnly=true) public TaskDto get(Long id, Long uid) {
  Task t=tasks.findActiveById(id).orElseThrow(()->new NotFoundException("Задача не найдена"));
  var m=actor(uid,t.getRestaurant().getId());
  if(!visible(t,m)) throw new NotFoundException("Задача не найдена");
  return dto(t,m);
 }
 @Transactional public TaskDto create(Long rid, Long uid, TaskWriteRequest r) {
  mutex.lock(rid); var m=actor(uid,rid); manage(m);
  Task t=Task.builder().restaurant(restaurants.findById(rid).orElseThrow(()->new NotFoundException("Ресторан не найден")))
   .createdBy(m.getUser()).setterMember(m).createdAt(time.nowInstant()).status(TaskStatus.ACTIVE).build();
  applyWrite(t,r,m,true); event(t,m,"Создал задачу");
  tasks.saveAndFlush(t); notify(t,m,"Новая задача: "+t.getTitle(),"created",currentMembers(t));
  return dto(t,m);
 }
 @Transactional public TaskDto update(Long id, Long uid, TaskWriteRequest r) {
  Task t=locked(id); var m=actor(uid,t.getRestaurant().getId()); manage(m);
  if(r.expectedVersion()==null || r.expectedVersion()!=t.getVersion()) throw new ConflictException("Задача изменилась. Откройте её заново.");
  if(t.getStatus()==TaskStatus.COMPLETED) throw new BadRequestException("Сначала верните задачу в работу");
  String oldDeadline=String.valueOf(t.getDueDate())+" "+t.getDueTime();
  var previous=currentMembers(t).stream().map(RestaurantMember::getId).collect(java.util.stream.Collectors.toSet());
  applyWrite(t,r,m,false); t.setDefinitionVersion(t.getDefinitionVersion()+1);
  event(t,m,"Изменил задачу"+(oldDeadline.equals(String.valueOf(t.getDueDate())+" "+t.getDueTime())?"":" · срок: "+t.getDueDate()+(t.getDueTime()==null?"":" "+t.getDueTime())));
  settle(t,m,"AUDIENCE_CHANGED"); tasks.saveAndFlush(t);
  notify(t,m,"Вам назначена задача: "+t.getTitle(),"assigned",currentMembers(t).stream().filter(x->!previous.contains(x.getId())).toList());
  return dto(t,m);
 }
 @Transactional public TaskDto assign(Long id, Long uid, TaskAssignRequest request) {
  Task t=locked(id);var m=actor(uid,t.getRestaurant().getId());manage(m);
  if(t.getVersion()!=request.expectedVersion() || t.getStatus()!=TaskStatus.ACTIVE || !currentMembers(t).isEmpty() || t.getAudience()!=TaskAudience.NONE)
   throw new ConflictException("Задача изменилась. Откройте её заново.");
  return update(id,uid,new TaskWriteRequest(t.getTitle(),t.getDescription(),t.getPriority(),
   (t.getDueDate()==null?time.today(t.getRestaurant()):t.getDueDate()).toString(),
   t.getCompletionMode(),TaskAudience.MEMBERS,List.of(),List.of(request.memberId()),
   t.getSetterMember()==null?m.getId():t.getSetterMember().getId(),request.expectedVersion(),false,t.getDueTime()==null?null:t.getDueTime().toString()));
 }
 private void applyWrite(Task t,TaskWriteRequest r,RestaurantMember actor,boolean creating) {
  var rid=t.getRestaurant().getId();
  LocalDate due;
  try { due=LocalDate.parse(r.dueDate()); } catch(Exception ex) { throw new BadRequestException("Некорректный срок"); }
  if(due.isBefore(time.today(t.getRestaurant())) && (creating || !due.equals(t.getDueDate()))) throw new BadRequestException("Новый срок не может быть в прошлом");
  LocalTime deadlineTime=null;
  if(r.dueTime()!=null) {
   if(!r.dueTime().matches("(?:[01][0-9]|2[0-3]):(?:00|15|30|45)")) throw new BadRequestException("Выберите время с шагом 15 минут");
   deadlineTime=LocalTime.parse(r.dueTime());
  }
  if(deadlineTime!=null && (creating || !due.equals(t.getDueDate()) || !deadlineTime.equals(t.getDueTime()))
   && !due.atTime(deadlineTime).atZone(time.zoneFor(t.getRestaurant())).toInstant().isAfter(time.nowInstant()))
   throw new BadRequestException("Новый срок должен быть в будущем");
  Set<Long> pos=new HashSet<>(r.positionIds()); Set<Long> ids=new HashSet<>(r.memberIds());
  if(pos.contains(null)||ids.contains(null)) throw new BadRequestException("Некорректные участники");
  if(r.audience()==TaskAudience.POSITIONS && pos.isEmpty() || r.audience()==TaskAudience.MEMBERS && ids.isEmpty()) throw new BadRequestException("Выберите исполнителей");
  if((r.audience()==TaskAudience.ALL || r.audience()==TaskAudience.NONE) && (!pos.isEmpty()||!ids.isEmpty())
   || r.audience()==TaskAudience.POSITIONS && !ids.isEmpty()) throw new BadRequestException("Некорректный состав исполнителей");
  for(Long p:pos) {
   var position=positions.findById(p).orElseThrow(()->new BadRequestException("Должность не найдена"));
   if(!Objects.equals(position.getRestaurant().getId(),rid)||!position.isActive()) throw new BadRequestException("Должность недоступна");
  }
  var roster=members.findActiveWithUserAndPositionByRestaurantId(rid);
  boolean preserveRoster=!creating && t.getCompletionMode()==TaskCompletionMode.EACH && r.completionMode()==TaskCompletionMode.EACH
   && t.getAudience()==r.audience() && t.getPositionIds().equals(pos) && r.audience()!=TaskAudience.MEMBERS;
  var retained=t.getParticipants().stream().filter(TaskBoardService::current).map(p->p.getMember().getId()).collect(java.util.stream.Collectors.toSet());
  var selected=roster.stream().filter(m->r.audience()==TaskAudience.ALL || r.audience()==TaskAudience.POSITIONS && pos.contains(m.getPosition().getId())
   || r.audience()==TaskAudience.MEMBERS && ids.contains(m.getId())).toList();
  if(preserveRoster) selected=selected.stream().filter(m->retained.contains(m.getId())).toList();
  if(r.audience()==TaskAudience.MEMBERS && selected.size()!=ids.size()) throw new BadRequestException("Сотрудник больше не работает в ресторане");
  boolean contentChanged=!creating && (!Objects.equals(t.getTitle(),r.title().trim()) || !Objects.equals(t.getDescription(),normalize(r.description())) || t.getCompletionMode()!=r.completionMode());
  boolean hasResults=t.getParticipants().stream().anyMatch(p->p.getCompletedAt()!=null);
  if(contentChanged && hasResults && !r.confirmResetProgress()) throw new ConflictException("Изменение инструкции или режима сбросит личные отметки. Подтвердите сброс.");
  if(contentChanged && hasResults) { t.getParticipants().forEach(p->p.setCompletedAt(null)); event(t,actor,"Сбросил отметки после изменения инструкции"); }
  var owner=r.ownerMemberId()==null?(t.getSetterMember()==null?actor:t.getSetterMember()):roster.stream().filter(m->Objects.equals(m.getId(),r.ownerMemberId())&&manager(m)).findFirst().orElseThrow(()->new BadRequestException("Владельцем должен быть действующий руководитель"));
  if(owner==null) throw new BadRequestException("Назначьте владельца задачи");
  if(t.getSetterMember()==null || !Objects.equals(owner.getId(),t.getSetterMember().getId())) { t.setOverdueNotifiedFor(null); event(t,actor,"Передал ответственность: "+owner.getUser().getFullName()); notify(t,actor,"Вам передали ответственность за задачу: "+r.title(),"owner:"+owner.getId(),List.of(owner)); }
  if(!Objects.equals(t.getDueDate(),due)||!Objects.equals(t.getDueTime(),deadlineTime)) t.setOverdueNotifiedFor(null);
  t.setTitle(r.title().trim()); t.setDescription(normalize(r.description())); t.setDueDate(due); t.setDueTime(deadlineTime); t.setPriority(r.priority()); t.setSetterMember(owner);
  t.setAudience(r.audience()); t.setCompletionMode(r.completionMode()); t.setPositionIds(pos);
  t.setAssignedToAll(r.audience()==TaskAudience.ALL); t.setAssignedPosition(null); t.setAssignedMember(null); t.setAssignedUser(null);
  // Existing EACH participants remain individually selectable; edits explicitly define the new roster.
  var wanted=selected.stream().map(RestaurantMember::getId).collect(java.util.stream.Collectors.toSet());
  for(var p:t.getParticipants()) if(p.isActive()&&!wanted.contains(p.getMember().getId())) deactivate(p);
  for(var m:selected) add(t,m,false);
 }
 private String normalize(String s){return s==null||s.isBlank()?null:s.trim();}
 @Transactional(readOnly=true) public List<TaskOpportunityDto> opportunities(Long rid,Long positionId,RestaurantMember member) {
  return tasks.findBoard(rid).stream().filter(t->t.getStatus()==TaskStatus.ACTIVE && (t.getAudience()==TaskAudience.ALL || t.getAudience()==TaskAudience.POSITIONS))
   .filter(t->matches(t,positionId) || member!=null && t.getParticipants().stream().anyMatch(p->current(p)&&Objects.equals(p.getMember().getId(),member.getId())))
   .filter(t->member==null || !matches(t,positionId) || !t.getParticipants().stream().anyMatch(p->current(p)&&Objects.equals(p.getMember().getId(),member.getId())))
   .map(t->new TaskOpportunityDto(t.getId(),t.getTitle(),t.getDefinitionVersion(),t.getCompletionMode().name(),
    (int)t.getParticipants().stream().filter(TaskBoardService::current).filter(p->p.getCompletedAt()!=null).count(),currentMembers(t).size(),
    member==null||previousCompletion(t,member.getUser().getId())==null?null:previousCompletion(t,member.getUser().getId()).toString(),!matches(t,positionId))).toList();
 }
 public void validateChoices(Long rid,Long positionId,RestaurantMember member,List<TaskAudienceDecision> decisions) {
  var relevant=opportunities(rid,positionId,member).stream().filter(o->o.completionMode().equals("EACH")&&!o.leaving()).toList();
  Map<Long,TaskAudienceDecision> choices=new HashMap<>();
  for(var d:decisions) if(d==null||d.action()==null||choices.put(d.taskId(),d)!=null) throw new BadRequestException("Укажите одно решение для каждой задачи");
  if(!choices.keySet().equals(relevant.stream().map(TaskOpportunityDto::taskId).collect(java.util.stream.Collectors.toSet()))) throw new ConflictException("Список задач изменился. Обновите последствия.");
  for(var o:relevant) if(choices.get(o.taskId()).expectedVersion()!=o.version()) throw new ConflictException("Задача изменилась. Обновите последствия.");
 }
 public void changePosition(RestaurantMember member,Long newPositionId,List<TaskAudienceDecision> choices,RestaurantMember actor) {
  var decisions=new HashMap<Long,TaskAudienceDecision>();for(var d:choices) decisions.put(d.taskId(),d);
  for(var t:tasks.findBoard(member.getRestaurant().getId())) {
   if(t.getStatus()!=TaskStatus.ACTIVE || t.getAudience()==TaskAudience.MEMBERS || t.getAudience()==TaskAudience.NONE) continue;
   var p=t.getParticipants().stream().filter(x->Objects.equals(x.getMember().getId(),member.getId())&&x.isActive()).findFirst().orElse(null);
   boolean eligible=matches(t,newPositionId);boolean changed=false;
   if(!eligible && p!=null) { deactivate(p);event(t,actor,"Исключён из текущего состава: "+member.getUser().getFullName()); changed=true; }
   if(eligible && p==null) {
    var d=decisions.get(t.getId());
    if(t.getCompletionMode()==TaskCompletionMode.ANY || d!=null && d.action()!=TaskAudienceDecision.Action.SKIP) {
     add(t,member,d!=null&&d.action()==TaskAudienceDecision.Action.RESTORE);event(t,actor,"Добавлен участник: "+member.getUser().getFullName());changed=true;
     notify(t,actor,"Вам назначена задача: "+t.getTitle(),"joined:"+member.getId(),List.of(member));
    }
   }
   if(changed){settle(t,actor,"AUDIENCE_CHANGED");tasks.save(t);}
  }
 }
 public void leave(RestaurantMember member,RestaurantMember actor) {
  for(var t:tasks.findBoard(member.getRestaurant().getId())) if(t.getStatus()==TaskStatus.ACTIVE) {
   boolean changed=false;
   for(var p:t.getParticipants()) if(p.isActive()&&Objects.equals(p.getMember().getId(),member.getId())) {deactivate(p);changed=true;}
   if(changed){
    // Legacy single-assignee tasks may have been transferred by the termination handler.
    if(t.getAudience()==TaskAudience.MEMBERS && t.getAssignedMember()!=null && !Objects.equals(t.getAssignedMember().getId(),member.getId())) add(t,t.getAssignedMember(),false);
    event(t,actor,"Участник выбыл: "+member.getUser().getFullName());settle(t,actor,"AUDIENCE_CHANGED");tasks.save(t);
    if(currentMembers(t).isEmpty()) notify(t,actor,"Задача осталась без исполнителей: "+t.getTitle(),"empty:"+member.getId(),Collections.singletonList(t.getSetterMember()));}
  }
 }
 public boolean isOverdue(Task t) {
  if(t.getStatus()!=TaskStatus.ACTIVE || t.getDueDate()==null) return false;
  var deadline=t.getDueTime()==null?t.getDueDate().plusDays(1).atStartOfDay(time.zoneFor(t.getRestaurant())):
   t.getDueDate().atTime(t.getDueTime()).atZone(time.zoneFor(t.getRestaurant()));
  return !time.nowInstant().isBefore(deadline.toInstant());
 }
 @Transactional public void notifyOverdue(Long id) {
  Task t=locked(id);
  if(t.getStatus()!=TaskStatus.ACTIVE||t.getDueDate()==null||!isOverdue(t)||t.getDueDate().equals(t.getOverdueNotifiedFor())) return;
  t.setOverdueNotifiedFor(t.getDueDate());tasks.saveAndFlush(t);
  notify(t,null,"Задача просрочена: "+t.getTitle(),"overdue",Collections.singletonList(t.getSetterMember()));
 }
 @Transactional public void delete(Long id,Long uid) {
  Task t=locked(id);var m=actor(uid,t.getRestaurant().getId());manage(m);t.setDeletedAt(time.nowInstant());tasks.save(t);
 }
 public void add(Task t,RestaurantMember m,boolean restore) {
  var p=t.getParticipants().stream().filter(x->Objects.equals(x.getMember().getId(),m.getId())).findFirst().orElse(null);
  if(p!=null && p.isActive()) return;
  if(p==null) { p=new TaskParticipant(); p.setTask(t); p.setMember(m); p.setJoinedAt(time.nowInstant()); t.getParticipants().add(p); }
  if(!restore) p.setCompletedAt(null);
  else if(p.getCompletedAt()==null) p.setCompletedAt(previousCompletion(t,m.getUser().getId()));
  p.setActive(true); p.setLeftAt(null);
 }
 private Instant previousCompletion(Task t,Long userId) {
  return t.getParticipants().stream().filter(p->Objects.equals(p.getMember().getUser().getId(),userId))
   .map(TaskParticipant::getCompletedAt).filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
 }
 private void deactivate(TaskParticipant p){p.setActive(false);p.setLeftAt(time.nowInstant());}
 @Transactional public TaskDto complete(Long id,Long uid,boolean undo) {
  Task t=locked(id); var m=actor(uid,t.getRestaurant().getId());
  if(!visible(t,m)) throw new NotFoundException("Задача не найдена");
  if(t.getCompletionMode()==TaskCompletionMode.ANY) {
   if(undo) throw new BadRequestException("Общую задачу возвращает в работу руководитель");
   if(t.getStatus()==TaskStatus.COMPLETED) return dto(t,m);
   if(!isMine(t,m)) throw new ForbiddenException("Вы не назначены исполнителем");
   t.setCompletedByMember(m); finish(t,m,"COMPLETED");
  } else {
   var p=t.getParticipants().stream().filter(x->current(x)&&Objects.equals(x.getMember().getId(),m.getId())).findFirst().orElseThrow(()->new ForbiddenException("Вы не назначены исполнителем"));
   if(undo) {
    if(p.getCompletedAt()==null) return dto(t,m);
    p.setCompletedAt(null); t.setStatus(TaskStatus.ACTIVE); t.setCompletedAt(null); t.setCompletionReason(null); t.setOverdueNotifiedFor(null);
    event(t,m,"Отменил своё выполнение");
   } else {
    if(p.getCompletedAt()!=null) return dto(t,m);
    p.setCompletedAt(time.nowInstant()); event(t,m,"Отметил своё выполнение"); settle(t,m,"COMPLETED");
   }
  }
  tasks.saveAndFlush(t); return dto(t,m);
 }
 @Transactional public TaskDto reopen(Long id,Long uid,long version) {
  Task t=locked(id); var m=actor(uid,t.getRestaurant().getId()); manage(m);
  if(t.getVersion()!=version) throw new ConflictException("Задача изменилась. Откройте её заново.");
  t.setStatus(TaskStatus.ACTIVE); t.setCompletedAt(null); t.setCompletedByMember(null); t.setCompletionReason(null); t.setOverdueNotifiedFor(null);
  t.getParticipants().forEach(p->p.setCompletedAt(null)); event(t,m,"Вернул задачу в работу и сбросил отметки");
  tasks.saveAndFlush(t); return dto(t,m);
 }
 private void finish(Task t,RestaurantMember actor,String reason) {
  if(t.getCompletionMode()==TaskCompletionMode.ANY) {
   var roster=currentMembers(t); var ids=roster.stream().map(RestaurantMember::getId).collect(java.util.stream.Collectors.toSet());
   t.getParticipants().forEach(p->{if(!ids.contains(p.getMember().getId())) deactivate(p);});
   roster.forEach(m->add(t,m,false));
  }
  t.setStatus(TaskStatus.COMPLETED); t.setCompletedAt(LocalDateTime.ofInstant(time.nowInstant(),ZoneOffset.UTC)); t.setCompletionReason(reason);
  event(t,actor,"AUDIENCE_CHANGED".equals(reason)?"Задача завершена после изменения состава":"Задача выполнена");
  notify(t,actor,"Задача выполнена: "+t.getTitle(),"completed:"+time.nowInstant(),Collections.singletonList(t.getSetterMember()));
 }
 public void settle(Task t,RestaurantMember actor,String reason) {
  var active=t.getParticipants().stream().filter(TaskBoardService::current).toList();
  if(t.getStatus()==TaskStatus.ACTIVE && t.getCompletionMode()==TaskCompletionMode.EACH && !active.isEmpty() && active.stream().allMatch(p->p.getCompletedAt()!=null)) finish(t,actor,reason);
 }
 public void event(Task t,RestaurantMember actor,String text) {
  // Dirty the parent even when only an inverse participant/event collection changed.
  t.setActivityVersion(t.getActivityVersion()+1);
  TaskEvent e=new TaskEvent();e.setTask(t);e.setActorName(actor==null?"Система":actor.getUser().getFullName());e.setText(text);e.setCreatedAt(time.nowInstant());t.getEvents().add(e);
 }
 private void notify(Task t,RestaurantMember actor,String text,String key,List<RestaurantMember> targets) {
  var valid=targets.stream().filter(Objects::nonNull).filter(RestaurantMember::isActive).toList();
  if(!valid.isEmpty()) inbox.createEvent(t.getRestaurant(),actor==null?null:actor.getUser(),text,InboxEventSubtype.TASK,"task-board:"+t.getId()+":"+key+":"+t.getVersion(),valid,null);
 }
 private TaskUserDto user(RestaurantMember m){return m==null?null:new TaskUserDto(m.getUser().getId(),m.getUser().getFullName(),m.getUser().getFirstName(),m.getUser().getLastName(),m.getPosition()==null?null:m.getPosition().getId(),m.getPosition()==null?null:m.getPosition().getName());}
 public TaskDto dto(Task t,RestaurantMember actor) {
  var roster=currentMembers(t); var active=t.getParticipants().stream().filter(p->t.getStatus()==TaskStatus.COMPLETED?p.isActive():current(p)).toList();
  int done=(int)active.stream().filter(p->p.getCompletedAt()!=null).count();
  boolean mine=roster.stream().anyMatch(m->Objects.equals(m.getId(),actor.getId()));
  boolean myDone=active.stream().anyMatch(p->Objects.equals(p.getMember().getId(),actor.getId())&&p.getCompletedAt()!=null);
  List<TaskDto.Participant> participants=new ArrayList<>();
  for(var p:t.getParticipants()) participants.add(new TaskDto.Participant(p.getMember().getId(),p.getMember().getUser().getId(),p.getMember().getUser().getFullName(),p.getMember().getPosition()==null?null:p.getMember().getPosition().getName(),t.getStatus()==TaskStatus.COMPLETED?p.isActive():current(p),p.getCompletedAt()==null?null:p.getCompletedAt().toString()));
  if(t.getCompletionMode()==TaskCompletionMode.ANY && (t.getAudience()==TaskAudience.ALL||t.getAudience()==TaskAudience.POSITIONS)) {
   participants.replaceAll(p->new TaskDto.Participant(p.memberId(),p.userId(),p.name(),p.positionName(),roster.stream().anyMatch(m->Objects.equals(m.getId(),p.memberId())),p.completedAt()));
   for(var m:roster) if(participants.stream().noneMatch(p->Objects.equals(p.memberId(),m.getId()))) participants.add(new TaskDto.Participant(m.getId(),m.getUser().getId(),m.getUser().getFullName(),m.getPosition().getName(),true,null));
  }
  var creator=t.getCreatedBy();
  return new TaskDto(t.getId(),t.getRestaurant().getId(),t.getTitle(),t.getDescription(),t.getPriority().name(),t.getDueDate()==null?null:t.getDueDate().toString(),t.getStatus().name(),t.getCompletedAt()==null?null:t.getCompletedAt().toInstant(ZoneOffset.UTC).toString(),t.isAssignedToAll(),t.getAssignedPosition()==null?null:new TaskPositionDto(t.getAssignedPosition().getId(),t.getAssignedPosition().getName()),user(t.getAssignedMember()),creator==null?null:new TaskUserDto(creator.getId(),creator.getFullName(),creator.getFirstName(),creator.getLastName(),null,null),user(t.getSetterMember()),t.getCreatedAt()==null?null:t.getCreatedAt().toString(),t.getVersion(),t.getCompletionMode().name(),t.getAudience().name(),t.getPositionIds().stream().sorted().toList(),participants,t.getEvents().stream().map(e->new TaskDto.Event(e.getId(),e.getActorName(),e.getText(),e.getCreatedAt().toString())).toList(),done,roster.size(),myDone,mine&&(t.getStatus()==TaskStatus.ACTIVE||myDone),t.getRestaurant().getTimezone(),time.today(t.getRestaurant()).toString(),user(t.getCompletedByMember()),t.getCompletionReason(),t.getSetterMember()==null?null:t.getSetterMember().getId(),t.getDueTime()==null?null:t.getDueTime().toString());
 }
}

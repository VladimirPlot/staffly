package ru.staffly.schedule.service.impl.autobuild;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Component;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ScheduleAutoBuildPlannerImpl implements ScheduleAutoBuildPlanner {
    private static final int END_OF_DAY_MINUTES = 24 * 60;
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final RestaurantMemberRepository members;
    private final SchedulePreferenceSubmissionRepository submissions;

    @Override
    public ScheduleAutoBuildPlan build(Long restaurantId, Schedule schedule, ScheduleBuildTemplate template) {
        initializeTemplateCollections(template);
        List<String> topWarnings = new ArrayList<>();
        List<Long> schedulePositions = schedule.getPositionIds() == null ? List.of() : schedule.getPositionIds();
        Set<Long> templatePositionIds = template.getPositionConfigs().stream().map(pc -> pc.getPosition().getId()).collect(Collectors.toSet());

        for (ScheduleBuildPositionConfig config : template.getPositionConfigs()) {
            if (!schedulePositions.contains(config.getPosition().getId())) topWarnings.add("В шаблоне есть позиция вне графика: " + config.getPosition().getName());
            if (config.getMinRestHours() != null || config.getMaxShiftsPerPeriod() != null) topWarnings.add("Ограничения minRestHours/maxShiftsPerPeriod будут применены на следующем этапе");
        }
        for (Long schedulePositionId : schedulePositions) {
            if (!templatePositionIds.contains(schedulePositionId)) topWarnings.add("Для одной из позиций графика нет конфигурации в шаблоне (positionId=" + schedulePositionId + ")");
        }

        Map<Long, List<SchedulePreferenceCell>> prefByMember = submissions.findWithCellsByScheduleId(schedule.getId()).stream()
                .filter(s -> s.getMember() != null)
                .collect(Collectors.toMap(s -> s.getMember().getId(), SchedulePreferenceSubmission::getCells, (a,b)->a));

        List<PositionPlan> positions = new ArrayList<>();
        for (ScheduleBuildPositionConfig config : template.getPositionConfigs()) {
            if (!schedulePositions.contains(config.getPosition().getId())) continue;
            positions.add(buildPosition(restaurantId, schedule, config, prefByMember));
        }
        List<String> distinctTopWarnings = topWarnings.stream().distinct().toList();
        Set<Long> affected = positions.stream().map(PositionPlan::positionId).collect(Collectors.toSet());
        int totalAssignments = positions.stream().mapToInt(PositionPlan::totalAssignments).sum();
        int unfilledCount = positions.stream().mapToInt(PositionPlan::unfilledCount).sum();
        int negativeAssignmentsCount = positions.stream().mapToInt(PositionPlan::negativeAssignmentsCount).sum();
        int warningsCount = distinctTopWarnings.size() + positions.stream().mapToInt(PositionPlan::warningsCount).sum();
        return new ScheduleAutoBuildPlan(schedule.getId(), template.getId(), template.getName(), affected, positions, distinctTopWarnings,
                totalAssignments, warningsCount, unfilledCount, negativeAssignmentsCount);
    }

    private PositionPlan buildPosition(Long restaurantId, Schedule schedule, ScheduleBuildPositionConfig config, Map<Long, List<SchedulePreferenceCell>> prefByMember) { /* trimmed */
        List<RestaurantMember> candidates = members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(restaurantId, List.of(config.getPosition().getId())).stream().filter(m -> m.getUser()!=null).toList();
        List<String> warnings=new ArrayList<>(); List<AssignmentPlan> cells=new ArrayList<>(); Map<LocalDate, Set<Long>> usedByDay=new HashMap<>(); int unfilled=0; int negativeCnt=0;
        for(LocalDate day=schedule.getStartDate(); !day.isAfter(schedule.getEndDate()); day=day.plusDays(1)){
            int dow=day.getDayOfWeek().getValue();
            List<ScheduleBuildCoverageRule> rules=config.getCoverageRules().stream().filter(r->r.getDayOfWeek()==dow).toList();
            for (ScheduleBuildCoverageRule rule: rules){
                ScheduleBuildShiftOption option=findShiftOption(config.getShiftOptions(),rule);
                if(option==null){warnings.add("Не найден shiftOption для правила "+rule.getStartTime()+"-"+rule.getEndTime());continue;}
                for(int i=0;i<Optional.ofNullable(rule.getRequiredCount()).orElse(0);i++){
                    RestaurantMember selected=pickMember(candidates,prefByMember,day,option,usedByDay.computeIfAbsent(day,k->new HashSet<>()));
                    if(selected==null){warnings.add("Недостаточно сотрудников для покрытия "+day+" "+formatShift(option)); unfilled++; continue;}
                    List<String> cellWarnings=new ArrayList<>(); PreferenceGrade g=grade(prefByMember.getOrDefault(selected.getId(),List.of()),day,option);
                    String reason=reasonFor(prefByMember.getOrDefault(selected.getId(),List.of()),day,option,cellWarnings,g);
                    cells.add(new AssignmentPlan(selected.getId(),displayName(selected),day.toString(),formatShift(option),option.getId(),option.getLabel(),reason,cellWarnings));
                    if(g==PreferenceGrade.NEGATIVE) negativeCnt++; usedByDay.get(day).add(selected.getId());
                }
            }
        }
        List<String> distinct=warnings.stream().distinct().toList(); int wc=distinct.size()+cells.stream().mapToInt(c->c.warnings().size()).sum();
        return new PositionPlan(config.getPosition().getId(),config.getPosition().getName(),cells,distinct,cells.size(),wc,unfilled,negativeCnt);
    }
    private RestaurantMember pickMember(List<RestaurantMember> c, Map<Long,List<SchedulePreferenceCell>> p, LocalDate d, ScheduleBuildShiftOption o, Set<Long> u){List<RestaurantMember> pos=new ArrayList<>(),none=new ArrayList<>(),neg=new ArrayList<>(); for(RestaurantMember m:c){if(u.contains(m.getId())) continue; PreferenceGrade g=grade(p.getOrDefault(m.getId(),List.of()),d,o); if(g==PreferenceGrade.POSITIVE) pos.add(m); else if(g==PreferenceGrade.NONE) none.add(m); else neg.add(m);} if(!pos.isEmpty()) return pos.get(0); if(!none.isEmpty()) return none.get(0); return neg.isEmpty()?null:neg.get(0);}    
    private String reasonFor(List<SchedulePreferenceCell> cells, LocalDate day, ScheduleBuildShiftOption option, List<String> warnings, PreferenceGrade grade){ if(grade==PreferenceGrade.POSITIVE){ if(hasPartialOverlap(cells,day,option)) warnings.add("Пожелание частично пересекается со сменой"); return "Подходит по пожеланию";} if(grade==PreferenceGrade.NEGATIVE){warnings.add("Есть отрицательное пожелание на этот день"); return "Поставлен для покрытия потребности";} return "Нет пожелания, выбран по доступности";}
    private boolean hasPartialOverlap(List<SchedulePreferenceCell> cells, LocalDate day, ScheduleBuildShiftOption option){int ss=toMinute(option.getStartTime(),false), se=toMinute(option.getEndTime(),true); return cells.stream().anyMatch(c->c.getDay().equals(day)&&!c.isFullDay()&&isPositiveType(c.getType())&&c.getStartTime()!=null&&c.getEndTime()!=null&&overlaps(toMinute(c.getStartTime(),false),toMinute(c.getEndTime(),true),ss,se)&&!coversInterval(c.getStartTime(),c.getEndTime(),option.getStartTime(),option.getEndTime())&&!intervalsEqual(c.getStartTime(),c.getEndTime(),option.getStartTime(),option.getEndTime()));}
    private PreferenceGrade grade(List<SchedulePreferenceCell> cells, LocalDate day, ScheduleBuildShiftOption option){List<SchedulePreferenceCell> dayCells=cells.stream().filter(c->c.getDay().equals(day)).toList(); if(dayCells.isEmpty()) return PreferenceGrade.NONE; if(dayCells.stream().anyMatch(c->isPositive(c,option))) return PreferenceGrade.POSITIVE; return dayCells.stream().anyMatch(c->isNegativeForShift(c,option))?PreferenceGrade.NEGATIVE:PreferenceGrade.NONE;}
    private boolean isPositive(SchedulePreferenceCell c, ScheduleBuildShiftOption o){if(!isPositiveType(c.getType())) return false; if(c.isFullDay()) return true; if(c.getStartTime()==null||c.getEndTime()==null) return false; return overlaps(toMinute(c.getStartTime(),false),toMinute(c.getEndTime(),true),toMinute(o.getStartTime(),false),toMinute(o.getEndTime(),true));}
    private boolean isNegativeForShift(SchedulePreferenceCell c, ScheduleBuildShiftOption o){if(c.getType()!=SchedulePreferenceType.UNAVAILABLE&&c.getType()!=SchedulePreferenceType.PREFER_DAY_OFF) return false; if(c.isFullDay()) return true; if(c.getStartTime()==null||c.getEndTime()==null) return false; return overlaps(toMinute(c.getStartTime(),false),toMinute(c.getEndTime(),true),toMinute(o.getStartTime(),false),toMinute(o.getEndTime(),true));}
    private boolean isPositiveType(SchedulePreferenceType t){return t==SchedulePreferenceType.AVAILABLE||t==SchedulePreferenceType.PREFER_WORK;}
    private ScheduleBuildShiftOption findShiftOption(List<ScheduleBuildShiftOption> opts, ScheduleBuildCoverageRule r){for(ScheduleBuildShiftOption o:opts){if(o.getStartTime().equals(r.getStartTime())&&o.getEndTime().equals(r.getEndTime())) return o;} for(ScheduleBuildShiftOption o:opts){if(covers(toMinute(o.getStartTime(),false),toMinute(o.getEndTime(),true),toMinute(r.getStartTime(),false),toMinute(r.getEndTime(),true))) return o;} return null;}
    private String displayName(RestaurantMember m){String full=Optional.ofNullable(m.getUser().getFullName()).map(String::trim).orElse(""); if(!full.isBlank()) return full; String first=Optional.ofNullable(m.getUser().getFirstName()).orElse(""),last=Optional.ofNullable(m.getUser().getLastName()).orElse(""); String fl=(first+" "+last).trim(); return fl.isBlank()?"Сотрудник #"+m.getId():fl;}
    private String formatShift(ScheduleBuildShiftOption option){return option.getStartTime().format(HH_MM)+"-"+option.getEndTime().format(HH_MM);} private int toMinute(LocalTime t, boolean end){if(end&&LocalTime.MIDNIGHT.equals(t)) return END_OF_DAY_MINUTES; return t.getHour()*60+t.getMinute();}
    private boolean overlaps(int a1,int a2,int b1,int b2){return a1<b2&&b1<a2;} private boolean covers(int s1,int e1,int s2,int e2){return s1<=s2&&e1>=e2;} private boolean coversInterval(LocalTime a,LocalTime b,LocalTime c,LocalTime d){return covers(toMinute(a,false),toMinute(b,true),toMinute(c,false),toMinute(d,true));} private boolean intervalsEqual(LocalTime a,LocalTime b,LocalTime c,LocalTime d){return toMinute(a,false)==toMinute(c,false)&&toMinute(b,true)==toMinute(d,true);}    
    private void initializeTemplateCollections(ScheduleBuildTemplate template){for(ScheduleBuildPositionConfig pc:template.getPositionConfigs()){Hibernate.initialize(pc.getShiftOptions()); Hibernate.initialize(pc.getCoverageRules());}}
    private enum PreferenceGrade {POSITIVE, NONE, NEGATIVE}
}

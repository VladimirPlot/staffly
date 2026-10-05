package ru.staffly.schedule.lifecycle;
import java.util.*;
import ru.staffly.member.dto.*;
import ru.staffly.member.lifecycle.*;
import ru.staffly.schedule.model.Schedule;
public record SchedulePositionChangePreparation(List<Schedule> lockedSchedules, Set<Long> affectedScheduleIds,
 List<String> cleanup, Map<Long, EnumSet<PositionChangeScheduleEffectType>> appliedEffects,
 Map<Long,Integer> cancelledBySchedule, int cancelledFutureShiftCount) implements PositionChangeModulePreparation {
 @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
}

package ru.staffly.reminder.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.reminder.dto.ReminderDto;
import ru.staffly.reminder.dto.ReminderMemberDto;
import ru.staffly.reminder.dto.ReminderPositionDto;
import ru.staffly.reminder.model.Reminder;

@Component
public class ReminderMapper {

    public ReminderDto toDto(Reminder reminder) {
        return new ReminderDto(
                reminder.getId(),
                reminder.getRestaurant() != null ? reminder.getRestaurant().getId() : null,
                reminder.getTitle(),
                reminder.getDescription(),
                reminder.isVisibleToAdmin(),
                reminder.getTargetType() == null ? null : reminder.getTargetType().name(),
                toPositionDto(reminder.getTargetPosition()),
                toMemberDto(reminder.getTargetMember()),
                reminder.getPeriodicity() == null ? null : reminder.getPeriodicity().name(),
                reminder.getTime() == null ? null : reminder.getTime().toString(),
                reminder.getDayOfWeek(),
                reminder.getDayOfMonth(),
                reminder.isMonthlyLastDay(),
                reminder.getOnceDate() == null ? null : reminder.getOnceDate().toString(),
                reminder.getNextFireAt() == null ? null : reminder.getNextFireAt().toString(),
                reminder.isActive(),
                toMemberDto(reminder.getCreatedByMember())
        );
    }

    public ReminderPositionDto toPositionDto(Position position) {
        if (position == null) {
            return null;
        }
        return new ReminderPositionDto(position.getId(), position.getName());
    }

    public ReminderMemberDto toMemberDto(RestaurantMember member) {
        if (member == null || member.getUser() == null) {
            return null;
        }
        Long positionId = null;
        String positionName = null;
        if (member.getPosition() != null) {
            positionId = member.getPosition().getId();
            positionName = member.getPosition().getName();
        }
        return new ReminderMemberDto(
                member.getId(),
                member.getUser().getId(),
                member.getUser().getFullName(),
                member.getUser().getFirstName(),
                member.getUser().getLastName(),
                positionId,
                positionName
        );
    }
}

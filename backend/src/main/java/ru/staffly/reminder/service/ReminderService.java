package ru.staffly.reminder.service;

import ru.staffly.reminder.dto.ReminderDto;
import ru.staffly.reminder.dto.ReminderRequest;

import java.util.List;

public interface ReminderService {

    List<ReminderDto> list(Long restaurantId, Long currentUserId, List<String> globalRoles, Long positionFilterId);

    ReminderDto create(Long restaurantId, Long currentUserId, ReminderRequest request);

    ReminderDto update(Long restaurantId, Long currentUserId, Long reminderId, ReminderRequest request);

    void delete(Long restaurantId, Long currentUserId, Long reminderId);
}

package ru.staffly.schedule.service;

import ru.staffly.schedule.dto.SaveScheduleBuildTemplateRequest;
import ru.staffly.schedule.dto.ScheduleBuildTemplateDto;

import java.util.List;

public interface ScheduleBuildTemplateService {
    List<ScheduleBuildTemplateDto> list(Long restaurantId, Long actorUserId);
    ScheduleBuildTemplateDto get(Long restaurantId, Long templateId, Long actorUserId);
    ScheduleBuildTemplateDto create(Long restaurantId, Long actorUserId, SaveScheduleBuildTemplateRequest request);
    ScheduleBuildTemplateDto update(Long restaurantId, Long templateId, Long actorUserId, SaveScheduleBuildTemplateRequest request);
    void archive(Long restaurantId, Long templateId, Long actorUserId);
}

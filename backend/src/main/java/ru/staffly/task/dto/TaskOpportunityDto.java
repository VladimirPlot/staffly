package ru.staffly.task.dto;
public record TaskOpportunityDto(Long taskId, String title, long version, String completionMode,
 int completedCount, int participantCount, String previousCompletedAt, boolean leaving) {}

package ru.staffly.inbox.dto;

public record InboxUnreadCountDto(
        long count,
        long eventCount,
        long scheduleEventCount
) {
}
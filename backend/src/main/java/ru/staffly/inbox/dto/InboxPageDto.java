package ru.staffly.inbox.dto;

import java.util.List;

public record InboxPageDto(
        List<InboxMessageDto> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasNext
) {
}
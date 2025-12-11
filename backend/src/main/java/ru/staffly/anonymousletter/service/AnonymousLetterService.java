package ru.staffly.anonymousletter.service;

import ru.staffly.anonymousletter.dto.AnonymousLetterDto;
import ru.staffly.anonymousletter.dto.AnonymousLetterRequest;
import ru.staffly.anonymousletter.dto.AnonymousLetterSummaryDto;
import ru.staffly.anonymousletter.dto.UnreadLettersDto;

import java.util.List;

public interface AnonymousLetterService {
    List<AnonymousLetterSummaryDto> list(Long restaurantId, Long currentUserId);

    AnonymousLetterDto get(Long restaurantId, Long currentUserId, Long letterId);

    AnonymousLetterDto create(Long restaurantId, Long currentUserId, AnonymousLetterRequest request);

    UnreadLettersDto hasUnread(Long restaurantId, Long currentUserId);
}
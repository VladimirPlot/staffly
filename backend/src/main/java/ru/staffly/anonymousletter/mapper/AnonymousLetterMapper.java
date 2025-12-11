package ru.staffly.anonymousletter.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.anonymousletter.dto.AnonymousLetterDto;
import ru.staffly.anonymousletter.dto.AnonymousLetterSummaryDto;
import ru.staffly.anonymousletter.model.AnonymousLetter;

@Component
public class AnonymousLetterMapper {

    public AnonymousLetterSummaryDto toSummary(AnonymousLetter letter) {
        return new AnonymousLetterSummaryDto(
                letter.getId(),
                letter.getSubject(),
                letter.getCreatedAt(),
                letter.getReadAt(),
                resolveRecipientName(letter),
                resolveRecipientPosition(letter)
        );
    }

    public AnonymousLetterDto toDto(AnonymousLetter letter) {
        return new AnonymousLetterDto(
                letter.getId(),
                letter.getSubject(),
                letter.getContent(),
                letter.getCreatedAt(),
                letter.getReadAt(),
                resolveRecipientName(letter),
                resolveRecipientPosition(letter)
        );
    }

    private String resolveRecipientName(AnonymousLetter letter) {
        var recipientUser = letter.getRecipient().getUser();
        if (recipientUser.getFullName() != null && !recipientUser.getFullName().isBlank()) {
            return recipientUser.getFullName();
        }
        String first = recipientUser.getFirstName();
        String last = recipientUser.getLastName();
        if ((first != null && !first.isBlank()) || (last != null && !last.isBlank())) {
            return String.format("%s %s",
                    last != null ? last.trim() : "",
                    first != null ? first.trim() : "").trim();
        }
        return null;
    }

    private String resolveRecipientPosition(AnonymousLetter letter) {
        var position = letter.getRecipient().getPosition();
        return position != null ? position.getName() : null;
    }
}
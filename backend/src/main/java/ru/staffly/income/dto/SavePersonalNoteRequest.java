package ru.staffly.income.dto;

import jakarta.validation.constraints.Size;

public record SavePersonalNoteRequest(
        @Size(max = 255)
        String title,

        @Size(max = 4000)
        String content
) {
}
package ru.staffly.contact.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ContactRequest(
        @NotBlank(message = "Название контакта обязательно")
        @Size(max = 200, message = "Слишком длинное название")
        String name,

        @Size(max = 2000, message = "Слишком длинное описание")
        String description,

        @NotBlank(message = "Телефон обязателен")
        @Size(max = 100, message = "Слишком длинный номер телефона")
        String phone
) {
}
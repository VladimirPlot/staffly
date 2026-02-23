package ru.staffly.training.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record SubmitAttemptRequestDto(@NotEmpty List<@Valid SubmitAttemptAnswerDto> answers) {}

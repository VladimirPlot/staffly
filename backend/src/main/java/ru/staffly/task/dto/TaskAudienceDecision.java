package ru.staffly.task.dto;
import jakarta.validation.constraints.NotNull;
public record TaskAudienceDecision(@NotNull Long taskId, long expectedVersion, @NotNull Action action) {
 public enum Action { ADD, SKIP, RESTORE }
}

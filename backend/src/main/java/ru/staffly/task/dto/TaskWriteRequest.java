package ru.staffly.task.dto;
import jakarta.validation.constraints.*;
import ru.staffly.task.model.*;
import java.util.List;
public record TaskWriteRequest(@NotBlank @Size(max=200) String title, @Size(max=20000) String description,
 @NotNull TaskPriority priority, @NotBlank String dueDate, @NotNull TaskCompletionMode completionMode,
 @NotNull TaskAudience audience, @NotNull List<Long> positionIds, @NotNull List<Long> memberIds,
 Long ownerMemberId, Long expectedVersion, boolean confirmResetProgress,
 @Pattern(regexp="(?:[01][0-9]|2[0-3]):(?:00|15|30|45)") String dueTime) {
 public TaskWriteRequest(String title, String description, TaskPriority priority, String dueDate,
  TaskCompletionMode completionMode, TaskAudience audience, List<Long> positionIds, List<Long> memberIds,
  Long ownerMemberId, Long expectedVersion, boolean confirmResetProgress) {
  this(title, description, priority, dueDate, completionMode, audience, positionIds, memberIds,
   ownerMemberId, expectedVersion, confirmResetProgress, null);
 }
}

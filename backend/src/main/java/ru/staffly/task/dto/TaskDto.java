package ru.staffly.task.dto;

public record TaskDto(
        Long id,
        Long restaurantId,
        String title,
        String description,
        String priority,
        String dueDate,
        String status,
        String completedAt,
        boolean assignedToAll,
        TaskPositionDto assignedPosition,
        TaskUserDto assignedUser,
        TaskUserDto createdBy,
        TaskUserDto setter,
        String createdAt,
        long version,
        String completionMode,
        String audience,
        java.util.List<Long> positionIds,
        java.util.List<Participant> participants,
        java.util.List<Event> events,
        int completedCount,
        int participantCount,
        boolean myCompleted,
        boolean canComplete,
        String timezone,
        String restaurantToday,
        TaskUserDto completedBy,
        String completionReason,
        Long ownerMemberId,
        String dueTime
) {
    public record Participant(Long memberId, Long userId, String name, String positionName, boolean active, String completedAt) {}
    public record Event(Long id, String actorName, String text, String createdAt) {}
    public TaskDto(Long id, Long restaurantId, String title, String description, String priority, String dueDate,
        String status, String completedAt, boolean assignedToAll, TaskPositionDto assignedPosition,
        TaskUserDto assignedUser, TaskUserDto createdBy, TaskUserDto setter, String createdAt, long version) {
        this(id, restaurantId, title, description, priority, dueDate, status, completedAt, assignedToAll,
            assignedPosition, assignedUser, createdBy, setter, createdAt, version, "ANY", "NONE",
            java.util.List.of(), java.util.List.of(), java.util.List.of(), 0, 0, false, false,
            "Europe/Moscow", null, null, null, null, null);
    }
}

package ru.staffly.schedule.dto;

import java.util.List;

/** id is persistence identity only; it is not planner or fingerprint identity. */
public record ScheduleBuildMarkerDto(Long id, String name, List<Long> memberIds) {}

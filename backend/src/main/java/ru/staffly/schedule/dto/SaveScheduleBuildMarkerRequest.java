package ru.staffly.schedule.dto;

import java.util.List;

public record SaveScheduleBuildMarkerRequest(Long id, String name, List<Long> memberIds) {
    public SaveScheduleBuildMarkerRequest(String name, List<Long> memberIds) {
        this(null, name, memberIds);
    }
}

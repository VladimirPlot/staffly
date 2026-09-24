package ru.staffly.schedule.dto;

import java.util.List;

public record SaveScheduleBuildMarkerRequest(String name, List<Long> memberIds) {}

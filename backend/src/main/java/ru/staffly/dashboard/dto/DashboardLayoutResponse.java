package ru.staffly.dashboard.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class DashboardLayoutResponse {
    List<String> layout;
}
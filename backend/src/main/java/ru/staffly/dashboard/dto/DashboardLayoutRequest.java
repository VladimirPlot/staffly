package ru.staffly.dashboard.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class DashboardLayoutRequest {

    @NotEmpty
    private List<String> layout;
}
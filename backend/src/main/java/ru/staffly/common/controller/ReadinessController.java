package ru.staffly.common.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("!worker")
@RequiredArgsConstructor
public class ReadinessController {
    private final ApplicationAvailability availability;
    private final JdbcTemplate jdbc;

    @GetMapping("/api/ready")
    public ResponseEntity<String> ready() {
        // ACCEPTING_TRAFFIC is published after startup (including Flyway and runners).
        if (availability.getReadinessState() != ReadinessState.ACCEPTING_TRAFFIC) {
            return ResponseEntity.status(503).body("not ready");
        }
        try {
            if (!Integer.valueOf(1).equals(jdbc.queryForObject("SELECT 1", Integer.class))) {
                return ResponseEntity.status(503).body("not ready");
            }
        } catch (DataAccessException ex) {
            return ResponseEntity.status(503).body("not ready");
        }
        return ResponseEntity.ok("ready");
    }
}

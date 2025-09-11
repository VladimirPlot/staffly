package ru.staffly.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
public class HealthController {

    @GetMapping("/api/ping")
    public String ping() {
        return "pong";
    }
}
package ru.staffly.schedule.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.schedule.dto.SaveScheduleBuildTemplateRequest;
import ru.staffly.schedule.dto.ScheduleBuildTemplateDto;
import ru.staffly.schedule.service.ScheduleBuildTemplateService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/schedules/build-templates")
@RequiredArgsConstructor
public class ScheduleBuildTemplateController {
    private final ScheduleBuildTemplateService templates;

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping
    public List<ScheduleBuildTemplateDto> list(@PathVariable Long restaurantId, @AuthenticationPrincipal UserPrincipal principal) {
        return templates.list(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping("/{templateId}")
    public ScheduleBuildTemplateDto get(@PathVariable Long restaurantId, @PathVariable Long templateId, @AuthenticationPrincipal UserPrincipal principal) {
        return templates.get(restaurantId, templateId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping
    public ScheduleBuildTemplateDto create(@PathVariable Long restaurantId, @AuthenticationPrincipal UserPrincipal principal, @RequestBody SaveScheduleBuildTemplateRequest request) {
        return templates.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/{templateId}")
    public ScheduleBuildTemplateDto update(@PathVariable Long restaurantId, @PathVariable Long templateId, @AuthenticationPrincipal UserPrincipal principal, @RequestBody SaveScheduleBuildTemplateRequest request) {
        return templates.update(restaurantId, templateId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/{templateId}")
    public void archive(@PathVariable Long restaurantId, @PathVariable Long templateId, @AuthenticationPrincipal UserPrincipal principal) {
        templates.archive(restaurantId, templateId, principal.userId());
    }
}

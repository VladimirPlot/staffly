package ru.staffly.schedule.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.staffly.schedule.dto.PreviewScheduleAutoBuildRequest;
import ru.staffly.schedule.dto.ScheduleAutoBuildPreviewResponse;
import ru.staffly.schedule.dto.SchedulePreferenceMyResponse;
import ru.staffly.schedule.dto.SchedulePreferenceProgressResponse;
import ru.staffly.schedule.dto.SchedulePreferenceSubmissionsResponse;
import ru.staffly.schedule.dto.UpsertMySchedulePreferenceRequest;
import ru.staffly.schedule.service.ScheduleAutoBuildPreviewService;
import ru.staffly.schedule.service.SchedulePreferenceService;
import ru.staffly.security.UserPrincipal;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/schedules/{scheduleId}/preferences")
@RequiredArgsConstructor
public class SchedulePreferenceController {

    private final SchedulePreferenceService schedulePreferences;
    private final ScheduleAutoBuildPreviewService autoBuildPreviewService;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/me")
    public SchedulePreferenceMyResponse getMyPreference(@PathVariable Long restaurantId,
                                                        @PathVariable Long scheduleId,
                                                        @AuthenticationPrincipal UserPrincipal principal) {
        return schedulePreferences.getMyPreference(restaurantId, scheduleId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PutMapping("/me")
    public SchedulePreferenceMyResponse upsertMyPreference(@PathVariable Long restaurantId,
                                                           @PathVariable Long scheduleId,
                                                           @AuthenticationPrincipal UserPrincipal principal,
                                                           @Valid @RequestBody UpsertMySchedulePreferenceRequest request) {
        return schedulePreferences.upsertMyPreference(restaurantId, scheduleId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping("/progress")
    public SchedulePreferenceProgressResponse getProgress(@PathVariable Long restaurantId,
                                                          @PathVariable Long scheduleId,
                                                          @AuthenticationPrincipal UserPrincipal principal) {
        return schedulePreferences.getProgress(restaurantId, scheduleId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping("/submissions")
    public SchedulePreferenceSubmissionsResponse getSubmissions(@PathVariable Long restaurantId,
                                                                @PathVariable Long scheduleId,
                                                                @AuthenticationPrincipal UserPrincipal principal) {
        return schedulePreferences.getSubmissions(restaurantId, scheduleId, principal.userId());
    }
    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/auto-build-preview")
    public ScheduleAutoBuildPreviewResponse previewAutoBuild(@PathVariable Long restaurantId,
                                                             @PathVariable Long scheduleId,
                                                             @AuthenticationPrincipal UserPrincipal principal,
                                                             @Valid @RequestBody PreviewScheduleAutoBuildRequest request) {
        return autoBuildPreviewService.preview(restaurantId, scheduleId, principal.userId(), request);
    }

}

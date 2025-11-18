package ru.staffly.checklist.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.checklist.dto.ChecklistDto;
import ru.staffly.checklist.dto.ChecklistRequest;
import ru.staffly.checklist.service.ChecklistService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/checklists")
@RequiredArgsConstructor
public class ChecklistController {

    private final ChecklistService service;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping
    public List<ChecklistDto> list(@PathVariable Long restaurantId,
                                   @AuthenticationPrincipal UserPrincipal principal,
                                   @RequestParam(name = "positionId", required = false) Long positionId) {
        return service.list(restaurantId, principal.userId(), principal.roles(), positionId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping
    public ChecklistDto create(@PathVariable Long restaurantId,
                               @AuthenticationPrincipal UserPrincipal principal,
                               @Valid @RequestBody ChecklistRequest request) {
        return service.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/{checklistId}")
    public ChecklistDto update(@PathVariable Long restaurantId,
                               @PathVariable Long checklistId,
                               @AuthenticationPrincipal UserPrincipal principal,
                               @Valid @RequestBody ChecklistRequest request) {
        return service.update(restaurantId, principal.userId(), checklistId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/{checklistId}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long checklistId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        service.delete(restaurantId, principal.userId(), checklistId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping(value = "/{checklistId}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long restaurantId,
                                           @PathVariable Long checklistId,
                                           @AuthenticationPrincipal UserPrincipal principal,
                                           @RequestParam(name = "format", defaultValue = "txt") String format) {
        byte[] data = service.download(restaurantId, principal.userId(), checklistId, format);
        String filename = switch (format == null ? "" : format.trim().toLowerCase()) {
            case "docx" -> "checklist-" + checklistId + ".docx";
            default -> "checklist-" + checklistId + ".txt";
        };
        MediaType mediaType = filename.endsWith(".docx")
                ? MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                : MediaType.TEXT_PLAIN;
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(mediaType)
                .body(data);
    }
}
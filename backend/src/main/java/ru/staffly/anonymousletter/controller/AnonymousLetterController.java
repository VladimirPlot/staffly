package ru.staffly.anonymousletter.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.anonymousletter.dto.AnonymousLetterDto;
import ru.staffly.anonymousletter.dto.AnonymousLetterRequest;
import ru.staffly.anonymousletter.dto.AnonymousLetterSummaryDto;
import ru.staffly.anonymousletter.dto.UnreadLettersDto;
import ru.staffly.anonymousletter.service.AnonymousLetterService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/anonymous-letters")
@RequiredArgsConstructor
public class AnonymousLetterController {

    private final AnonymousLetterService letters;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping
    public List<AnonymousLetterSummaryDto> list(@PathVariable Long restaurantId,
                                                @AuthenticationPrincipal UserPrincipal principal) {
        return letters.list(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/{letterId}")
    public AnonymousLetterDto get(@PathVariable Long restaurantId,
                                  @PathVariable Long letterId,
                                  @AuthenticationPrincipal UserPrincipal principal) {
        return letters.get(restaurantId, principal.userId(), letterId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping
    public AnonymousLetterDto create(@PathVariable Long restaurantId,
                                     @AuthenticationPrincipal UserPrincipal principal,
                                     @Valid @RequestBody AnonymousLetterRequest request) {
        return letters.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.isAdmin(principal.userId, #restaurantId)")
    @GetMapping("/unread")
    public UnreadLettersDto hasUnread(@PathVariable Long restaurantId,
                                      @AuthenticationPrincipal UserPrincipal principal) {
        return letters.hasUnread(restaurantId, principal.userId());
    }
}
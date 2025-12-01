package ru.staffly.contact.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.contact.dto.ContactDto;
import ru.staffly.contact.dto.ContactRequest;
import ru.staffly.contact.service.ContactService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contacts;

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping
    public List<ContactDto> list(@PathVariable Long restaurantId,
                                 @AuthenticationPrincipal UserPrincipal principal) {
        return contacts.list(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping
    public ContactDto create(@PathVariable Long restaurantId,
                             @AuthenticationPrincipal UserPrincipal principal,
                             @Valid @RequestBody ContactRequest request) {
        return contacts.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/{contactId}")
    public ContactDto update(@PathVariable Long restaurantId,
                             @PathVariable Long contactId,
                             @AuthenticationPrincipal UserPrincipal principal,
                             @Valid @RequestBody ContactRequest request) {
        return contacts.update(restaurantId, principal.userId(), contactId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/{contactId}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long contactId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        contacts.delete(restaurantId, principal.userId(), contactId);
    }
}
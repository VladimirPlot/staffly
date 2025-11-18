package ru.staffly.income.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.income.dto.PersonalNoteDto;
import ru.staffly.income.dto.SavePersonalNoteRequest;
import ru.staffly.income.service.PersonalNotesService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/me/notes")
@RequiredArgsConstructor
public class PersonalNotesController {

    private final PersonalNotesService notesService;

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public List<PersonalNoteDto> list(@AuthenticationPrincipal UserPrincipal principal) {
        return notesService.list(principal.userId());
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping
    public PersonalNoteDto create(@AuthenticationPrincipal UserPrincipal principal,
                                  @Valid @RequestBody SavePersonalNoteRequest request) {
        return notesService.create(principal.userId(), request);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{noteId}")
    public PersonalNoteDto get(@AuthenticationPrincipal UserPrincipal principal,
                               @PathVariable Long noteId) {
        return notesService.get(principal.userId(), noteId);
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/{noteId}")
    public PersonalNoteDto update(@AuthenticationPrincipal UserPrincipal principal,
                                  @PathVariable Long noteId,
                                  @Valid @RequestBody SavePersonalNoteRequest request) {
        return notesService.update(principal.userId(), noteId, request);
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{noteId}")
    public void delete(@AuthenticationPrincipal UserPrincipal principal,
                       @PathVariable Long noteId) {
        notesService.delete(principal.userId(), noteId);
    }
}
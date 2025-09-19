package ru.staffly.dictionary.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.dictionary.dto.PositionDto;
import ru.staffly.dictionary.dto.ShiftDto;
import ru.staffly.dictionary.service.DictionaryService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}")
@RequiredArgsConstructor
public class DictionaryController {

    private final DictionaryService dictionaries;

    // Positions
    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/positions")
    public List<PositionDto> listPositions(@PathVariable Long restaurantId,
                                           @AuthenticationPrincipal UserPrincipal principal) {
        return dictionaries.listPositions(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/positions")
    public PositionDto createPosition(@PathVariable Long restaurantId,
                                      @AuthenticationPrincipal UserPrincipal principal,
                                      @Valid @RequestBody PositionDto dto) {
        return dictionaries.createPosition(restaurantId, principal.userId(), dto);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/positions/{positionId}")
    public PositionDto updatePosition(@PathVariable Long restaurantId,
                                      @PathVariable Long positionId,
                                      @AuthenticationPrincipal UserPrincipal principal,
                                      @Valid @RequestBody PositionDto dto) {
        return dictionaries.updatePosition(restaurantId, principal.userId(), positionId, dto);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/positions/{positionId}")
    public void deletePosition(@PathVariable Long restaurantId,
                               @PathVariable Long positionId,
                               @AuthenticationPrincipal UserPrincipal principal) {
        dictionaries.deletePosition(restaurantId, principal.userId(), positionId);
    }

    // Shifts
    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/shifts")
    public List<ShiftDto> listShifts(@PathVariable Long restaurantId,
                                     @AuthenticationPrincipal UserPrincipal principal) {
        return dictionaries.listShifts(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/shifts")
    public ShiftDto createShift(@PathVariable Long restaurantId,
                                @AuthenticationPrincipal UserPrincipal principal,
                                @Valid @RequestBody ShiftDto dto) {
        return dictionaries.createShift(restaurantId, principal.userId(), dto);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/shifts/{shiftId}")
    public ShiftDto updateShift(@PathVariable Long restaurantId,
                                @PathVariable Long shiftId,
                                @AuthenticationPrincipal UserPrincipal principal,
                                @Valid @RequestBody ShiftDto dto) {
        return dictionaries.updateShift(restaurantId, principal.userId(), shiftId, dto);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/shifts/{shiftId}")
    public void deleteShift(@PathVariable Long restaurantId,
                            @PathVariable Long shiftId,
                            @AuthenticationPrincipal UserPrincipal principal) {
        dictionaries.deleteShift(restaurantId, principal.userId(), shiftId);
    }
}
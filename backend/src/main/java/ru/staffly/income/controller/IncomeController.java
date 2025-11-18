package ru.staffly.income.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.income.dto.*;
import ru.staffly.income.service.IncomeService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/me/income")
@RequiredArgsConstructor
public class IncomeController {

    private final IncomeService incomes;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/periods")
    public List<IncomePeriodSummaryDto> list(@AuthenticationPrincipal UserPrincipal principal) {
        return incomes.listPeriods(principal.userId());
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/periods")
    public IncomePeriodSummaryDto create(@AuthenticationPrincipal UserPrincipal principal,
                                         @Valid @RequestBody SaveIncomePeriodRequest request) {
        return incomes.createPeriod(principal.userId(), request);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/periods/{periodId}")
    public IncomePeriodDetailDto get(@AuthenticationPrincipal UserPrincipal principal,
                                     @PathVariable Long periodId) {
        return incomes.getPeriod(principal.userId(), periodId);
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/periods/{periodId}")
    public IncomePeriodSummaryDto update(@AuthenticationPrincipal UserPrincipal principal,
                                         @PathVariable Long periodId,
                                         @Valid @RequestBody SaveIncomePeriodRequest request) {
        return incomes.updatePeriod(principal.userId(), periodId, request);
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/periods/{periodId}")
    public void delete(@AuthenticationPrincipal UserPrincipal principal,
                       @PathVariable Long periodId) {
        incomes.deletePeriod(principal.userId(), periodId);
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/periods/{periodId}/shifts")
    public IncomeShiftDto createShift(@AuthenticationPrincipal UserPrincipal principal,
                                      @PathVariable Long periodId,
                                      @Valid @RequestBody SaveIncomeShiftRequest request) {
        return incomes.createShift(principal.userId(), periodId, request);
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/shifts/{shiftId}")
    public IncomeShiftDto updateShift(@AuthenticationPrincipal UserPrincipal principal,
                                      @PathVariable Long shiftId,
                                      @Valid @RequestBody SaveIncomeShiftRequest request) {
        return incomes.updateShift(principal.userId(), shiftId, request);
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/shifts/{shiftId}")
    public void deleteShift(@AuthenticationPrincipal UserPrincipal principal,
                            @PathVariable Long shiftId) {
        incomes.deleteShift(principal.userId(), shiftId);
    }
}
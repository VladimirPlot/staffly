package ru.staffly.income.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.income.model.IncomeShift;

import java.util.List;
import java.util.Optional;

public interface IncomeShiftRepository extends JpaRepository<IncomeShift, Long> {
    List<IncomeShift> findByPeriodIdAndUserIdOrderByDateDesc(Long periodId, Long userId);

    Optional<IncomeShift> findByIdAndUserId(Long id, Long userId);
}
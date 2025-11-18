package ru.staffly.income.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.income.model.IncomePeriod;

import java.util.List;
import java.util.Optional;

public interface IncomePeriodRepository extends JpaRepository<IncomePeriod, Long> {
    List<IncomePeriod> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<IncomePeriod> findByIdAndUserId(Long id, Long userId);
}
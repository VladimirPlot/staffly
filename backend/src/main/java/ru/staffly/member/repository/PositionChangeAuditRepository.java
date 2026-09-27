package ru.staffly.member.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.member.model.PositionChangeAudit;

public interface PositionChangeAuditRepository extends JpaRepository<PositionChangeAudit, Long> { }

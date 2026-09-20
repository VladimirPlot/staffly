package ru.staffly.member.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.member.model.EmployeeRemovalAudit;

public interface EmployeeRemovalAuditRepository extends JpaRepository<EmployeeRemovalAudit, Long> {
}

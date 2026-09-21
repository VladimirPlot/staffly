package ru.staffly.invite.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.invite.model.InvitationScheduleIntent;

public interface InvitationScheduleIntentRepository extends JpaRepository<InvitationScheduleIntent, Long> {
}

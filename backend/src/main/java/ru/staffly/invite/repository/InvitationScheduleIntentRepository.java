package ru.staffly.invite.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.invite.model.InvitationScheduleIntent;

import java.util.List;

public interface InvitationScheduleIntentRepository extends JpaRepository<InvitationScheduleIntent, Long> {
    List<InvitationScheduleIntent> findByInvitationIdOrderByExpectedScheduleIdAsc(Long invitationId);
}

package ru.staffly.invite.service;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
/** Serializes contact replacement even when no pending row exists; never locks schedules. */
@Component
@RequiredArgsConstructor
public class InvitationContactLock {
    private final EntityManager entityManager;
    public void lock(Long restaurantId, String canonicalContact) {
        entityManager.createNativeQuery("select 1 from pg_advisory_xact_lock(hashtextextended(:key, 0))")
                .setParameter("key", "invitation:" + restaurantId + ":" + canonicalContact).getResultList();
    }
}

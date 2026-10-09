package ru.staffly.invite.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import ru.staffly.invite.dto.MyInviteDto;
import ru.staffly.invite.model.Invitation;
import ru.staffly.invite.model.InvitationStatus;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface InvitationRepository extends JpaRepository<Invitation, Long> {

    Optional<Invitation> findByToken(String token);
    /** Scalar projection only: do not load the mutable Invitation before lifecycle/contact locks. */
    interface AdmissionIdentity {
        Long getRestaurantId();
        String getContact();
    }

    @Query("select i.restaurant.id as restaurantId, i.phoneOrEmail as contact from Invitation i where i.token = :token")
    Optional<AdmissionIdentity> findAdmissionIdentityByToken(String token);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invitation i where i.token = :token")
    Optional<Invitation> findForUpdateByToken(String token);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invitation i where i.id = :id")
    Optional<Invitation> findForUpdateById(Long id);

    @Query("""
           select i.id from Invitation i
           where i.status = :status and i.expiresAt <= :now
           order by i.id asc
           """)
    List<Long> findExpiredPendingIds(InvitationStatus status, Instant now, Pageable pageable);

    List<Invitation> findByRestaurantIdAndStatus(Long restaurantId, InvitationStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
           select i from Invitation i
           where i.restaurant.id = :restaurantId
             and lower(i.phoneOrEmail) = lower(:contact)
             and i.status = :status
           """)
    Optional<Invitation> findPendingForUpdateByContact(Long restaurantId, String contact, InvitationStatus status);

    @Query("""
       select i from Invitation i join fetch i.restaurant
       where i.status = :status
         and i.expiresAt > :now
         and (
              (:phone is not null and i.phoneOrEmail = :phone)
           or (:email is not null and lower(i.phoneOrEmail) = lower(:email))
         )
       order by i.expiresAt asc
    """)
    List<Invitation> findMyPending(String phone, String email, Instant now, InvitationStatus status);

    /** Map Hibernate's typed JSON snapshot; the fetched restaurant avoids per-invitation queries. */
    default List<MyInviteDto> findMyPendingDtos(String phone, String email, Instant now, InvitationStatus status) {
        return findMyPending(phone, email, now, status).stream().map(MyInviteDto::from).toList();
    }
}

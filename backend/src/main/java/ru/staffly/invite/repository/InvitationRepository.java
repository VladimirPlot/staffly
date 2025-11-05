package ru.staffly.invite.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.invite.dto.MyInviteDto;
import ru.staffly.invite.model.Invitation;
import ru.staffly.invite.model.InvitationStatus;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface InvitationRepository extends JpaRepository<Invitation, Long> {

    Optional<Invitation> findByToken(String token);

    List<Invitation> findByRestaurantIdAndStatus(Long restaurantId, InvitationStatus status);

    @Query("""
           select (count(i) > 0) from Invitation i
           where i.restaurant.id = :restaurantId
             and lower(i.phoneOrEmail) = lower(:contact)
             and i.status = :status
           """)
    boolean existsInviteForContact(Long restaurantId, String contact, InvitationStatus status);

    @Query("""
       select i from Invitation i
       where i.status = :status
         and i.expiresAt > :now
         and (
              (:phone is not null and i.phoneOrEmail = :phone)
           or (:email is not null and lower(i.phoneOrEmail) = lower(:email))
         )
       order by i.expiresAt asc
    """)
    List<Invitation> findMyPending(String phone, String email, Instant now, InvitationStatus status);

    @Modifying
    @Query("delete from Invitation i where i.status = :status and i.expiresAt < :before")
    int deleteByStatusAndExpiresAtBefore(InvitationStatus status, Instant before);

    @Query("""
   select new ru.staffly.invite.dto.MyInviteDto(
     i.token,
     r.id,
     r.name,
     i.desiredRole,
     p.id,
     p.name,
     i.expiresAt
   )
   from Invitation i
     join i.restaurant r
     left join i.position p
   where i.status = :status
     and i.expiresAt > :now
     and (
          (:phone is not null and i.phoneOrEmail = :phone)
       or (:email is not null and lower(i.phoneOrEmail) = lower(:email))
     )
   order by i.expiresAt asc
""")
    List<MyInviteDto> findMyPendingDtos(String phone, String email, Instant now, InvitationStatus status);
}
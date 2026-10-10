package ru.staffly.announcement.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.announcement.model.AnnouncementOperation;
import java.util.Optional;
import java.util.UUID;

public interface AnnouncementOperationRepository extends JpaRepository<AnnouncementOperation, Long> {
    Optional<AnnouncementOperation> findByRestaurantIdAndActorIdAndOperationId(Long restaurantId, Long actorId, UUID operationId);

    @Modifying
    @Query("update AnnouncementOperation o set o.messageId = null where o.messageId = :messageId")
    void detachMessage(@Param("messageId") Long messageId);
}

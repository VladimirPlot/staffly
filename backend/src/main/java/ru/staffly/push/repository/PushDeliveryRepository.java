package ru.staffly.push.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.push.model.PushDelivery;

import java.time.Instant;
import java.util.List;

public interface PushDeliveryRepository extends JpaRepository<PushDelivery, Long> {

    @Modifying
    @Query(value = """
            insert into push_deliveries (ref_type, ref_id, restaurant_id, user_id, payload, status, run_at, created_at, updated_at)
            values (:refType, :refId, :restaurantId, :userId, cast(:payload as jsonb), :status, :runAt, :now, :now)
            on conflict (ref_type, ref_id, user_id) do nothing
            """, nativeQuery = true)
    int enqueueDelivery(@Param("refType") String refType,
                        @Param("refId") Long refId,
                        @Param("restaurantId") Long restaurantId,
                        @Param("userId") Long userId,
                        @Param("payload") String payload,
                        @Param("status") String status,
                        @Param("runAt") Instant runAt,
                        @Param("now") Instant now);

    @Query(value = """
            select id from push_deliveries
            where (
                (status = 'PENDING' and run_at <= :now)
                or (status = 'RETRY' and next_attempt_at <= :now)
            )
            and (locked_until is null or locked_until < :now)
            order by created_at
            limit :batch
            for update skip locked
            """, nativeQuery = true)
    List<Long> lockBatchForSending(@Param("now") Instant now, @Param("batch") int batch);

    @Modifying
    @Query(value = """
            update push_deliveries
            set status = 'SENDING',
                lock_owner = :owner,
                locked_until = :lockedUntil,
                attempts = attempts + 1,
                updated_at = :now
            where id in (:ids)
            """, nativeQuery = true)
    int markAsSending(@Param("ids") List<Long> ids,
                      @Param("owner") String owner,
                      @Param("lockedUntil") Instant lockedUntil,
                      @Param("now") Instant now);

    @Modifying
    @Query(value = """
            update push_deliveries
            set status = :status,
                next_attempt_at = :nextAttemptAt,
                locked_until = null,
                lock_owner = null,
                last_error = :lastError,
                last_http_status = :lastHttpStatus,
                updated_at = :now
            where id = :id
            """, nativeQuery = true)
    int updateRetry(@Param("id") Long id,
                    @Param("status") String status,
                    @Param("nextAttemptAt") Instant nextAttemptAt,
                    @Param("lastError") String lastError,
                    @Param("lastHttpStatus") Integer lastHttpStatus,
                    @Param("now") Instant now);

    @Modifying
    @Query(value = """
            update push_deliveries
            set status = :status,
                sent_at = :sentAt,
                next_attempt_at = null,
                locked_until = null,
                lock_owner = null,
                last_error = :lastError,
                last_http_status = :lastHttpStatus,
                updated_at = :now
            where id = :id
            """, nativeQuery = true)
    int markSent(@Param("id") Long id,
                 @Param("status") String status,
                 @Param("sentAt") Instant sentAt,
                 @Param("lastError") String lastError,
                 @Param("lastHttpStatus") Integer lastHttpStatus,
                 @Param("now") Instant now);

    @Modifying
    @Query(value = """
            update push_deliveries
            set status = :status,
                next_attempt_at = null,
                locked_until = null,
                lock_owner = null,
                last_error = :lastError,
                last_http_status = :lastHttpStatus,
                updated_at = :now
            where id = :id
            """, nativeQuery = true)
    int markFailed(@Param("id") Long id,
                   @Param("status") String status,
                   @Param("lastError") String lastError,
                   @Param("lastHttpStatus") Integer lastHttpStatus,
                   @Param("now") Instant now);
}

package ru.staffly.push.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.push.model.PushDevice;

import java.time.Instant;
import java.util.List;

public interface PushDeviceRepository extends JpaRepository<PushDevice, Long> {

    @Query("select d from PushDevice d where d.user.id = :userId and d.disabledAt is null")
    List<PushDevice> findActiveDevicesByUserId(@Param("userId") Long userId);

    @Modifying
    @Query(value = """
            insert into push_devices (user_id, endpoint, p256dh, auth, expiration_time, user_agent, platform, created_at, updated_at, last_seen_at)
            values (:userId, :endpoint, :p256dh, :auth, :expirationTime, :userAgent, :platform, :now, :now, :now)
            on conflict (endpoint) do update set
                user_id = excluded.user_id,
                p256dh = excluded.p256dh,
                auth = excluded.auth,
                expiration_time = excluded.expiration_time,
                user_agent = excluded.user_agent,
                platform = excluded.platform,
                disabled_at = null,
                last_seen_at = :now,
                updated_at = :now
            """, nativeQuery = true)
    int upsertDevice(@Param("userId") Long userId,
                     @Param("endpoint") String endpoint,
                     @Param("p256dh") String p256dh,
                     @Param("auth") String auth,
                     @Param("expirationTime") Long expirationTime,
                     @Param("userAgent") String userAgent,
                     @Param("platform") String platform,
                     @Param("now") Instant now);

    @Modifying
    @Query(value = """
            update push_devices
            set disabled_at = :now,
                updated_at = :now
            where endpoint = :endpoint and disabled_at is null
            """, nativeQuery = true)
    int disableByEndpoint(@Param("endpoint") String endpoint, @Param("now") Instant now);

    @Modifying
    @Query(value = """
            update push_devices
            set disabled_at = :now,
                updated_at = :now
            where id = :id and disabled_at is null
            """, nativeQuery = true)
    int disableById(@Param("id") Long id, @Param("now") Instant now);
}

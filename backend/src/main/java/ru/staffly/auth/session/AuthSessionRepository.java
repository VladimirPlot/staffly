package ru.staffly.auth.session;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuthSessionRepository extends JpaRepository<AuthSession, Long> {
    Optional<AuthSession> findByRefreshHashAndRevokedAtIsNull(String refreshHash);
}
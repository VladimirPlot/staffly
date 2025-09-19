package ru.staffly.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.user.model.User;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByPhone(String phone);
    Optional<User> findByEmail(String email);
    // Поиск либо по телефону, либо по email
    @Query("""
       select u from User u
       where u.phone = :value
          or lower(u.email) = lower(:value)
       """)
    Optional<User> findByPhoneOrEmail(String value);
}
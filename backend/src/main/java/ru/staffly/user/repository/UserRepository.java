package ru.staffly.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.user.model.User;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByPhone(String phone);
    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByPhone(String phone);
    boolean existsByEmailIgnoreCase(String email);

    // НОВОЕ: проверки уникальности, исключая текущего пользователя (id != :id)
    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);
    boolean existsByPhoneAndIdNot(String phone, Long id);

    @Query("""
       select u from User u
       where u.phone = :value
          or lower(u.email) = lower(:value)
       """)
    Optional<User> findByPhoneOrEmail(String value);
}
package ru.staffly.income.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.income.model.PersonalNote;

import java.util.List;
import java.util.Optional;

public interface PersonalNoteRepository extends JpaRepository<PersonalNote, Long> {
    List<PersonalNote> findByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<PersonalNote> findByIdAndUserId(Long id, Long userId);
}
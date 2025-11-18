package ru.staffly.income.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import ru.staffly.income.dto.PersonalNoteDto;
import ru.staffly.income.dto.SavePersonalNoteRequest;
import ru.staffly.income.model.PersonalNote;
import ru.staffly.income.repository.PersonalNoteRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PersonalNotesService {

    private final PersonalNoteRepository notes;

    public List<PersonalNoteDto> list(Long userId) {
        return notes.findByUserIdOrderByUpdatedAtDesc(userId).stream().map(this::toDto).toList();
    }

    public PersonalNoteDto create(Long userId, SavePersonalNoteRequest request) {
        PersonalNote note = PersonalNote.builder()
                .userId(userId)
                .title(request.title())
                .content(request.content())
                .build();
        return toDto(notes.save(note));
    }

    public PersonalNoteDto get(Long userId, Long noteId) {
        PersonalNote note = notes.findByIdAndUserId(noteId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Заметка не найдена"));
        return toDto(note);
    }

    public PersonalNoteDto update(Long userId, Long noteId, SavePersonalNoteRequest request) {
        PersonalNote note = notes.findByIdAndUserId(noteId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Заметка не найдена"));
        note.setTitle(request.title());
        note.setContent(request.content());
        return toDto(notes.save(note));
    }

    public void delete(Long userId, Long noteId) {
        PersonalNote note = notes.findByIdAndUserId(noteId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Заметка не найдена"));
        notes.delete(note);
    }

    private PersonalNoteDto toDto(PersonalNote note) {
        return new PersonalNoteDto(
                note.getId(),
                note.getTitle(),
                note.getContent(),
                note.getCreatedAt(),
                note.getUpdatedAt()
        );
    }
}
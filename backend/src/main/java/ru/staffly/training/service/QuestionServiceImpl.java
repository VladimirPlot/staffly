package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.util.List;

@Service
@RequiredArgsConstructor
public class QuestionServiceImpl implements QuestionService {
    private final TrainingFolderRepository folders;
    private final TrainingQuestionRepository questions;
    private final TrainingQuestionOptionRepository options;
    private final TrainingQuestionMatchPairRepository pairs;

    @Override
    public List<TrainingQuestionDto> listQuestions(Long restaurantId, Long folderId) {
        return questions.findByRestaurantIdAndFolderIdOrderBySortOrderAscIdAsc(restaurantId, folderId).stream().map(this::toDto).toList();
    }

    @Override
    @Transactional
    public TrainingQuestionDto createQuestion(Long restaurantId, TrainingQuestionDto dto) {
        var folder = folders.findByIdAndRestaurantId(dto.folderId(), restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != TrainingFolderType.QUESTION_BANK) throw new BadRequestException("Wrong folder type");
        var entity = questions.save(TrainingQuestion.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .folder(folder)
                .type(dto.type())
                .prompt(dto.prompt())
                .explanation(dto.explanation())
                .sortOrder(dto.sortOrder() == null ? 0 : dto.sortOrder())
                .active(dto.active() == null || dto.active())
                .build());
        saveNested(entity, dto);
        return toDto(entity);
    }

    @Override
    @Transactional
    public TrainingQuestionDto updateQuestion(Long restaurantId, Long questionId, TrainingQuestionDto dto) {
        var entity = questions.findByIdAndRestaurantId(questionId, restaurantId).orElseThrow(() -> new NotFoundException("Question not found"));
        entity.setPrompt(dto.prompt());
        entity.setExplanation(dto.explanation());
        entity.setType(dto.type());
        entity.setSortOrder(dto.sortOrder() == null ? entity.getSortOrder() : dto.sortOrder());
        entity.setActive(dto.active() == null ? entity.isActive() : dto.active());
        if (dto.folderId() != null && !dto.folderId().equals(entity.getFolder().getId())) {
            var folder = folders.findByIdAndRestaurantId(dto.folderId(), restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
            if (folder.getType() != TrainingFolderType.QUESTION_BANK) throw new BadRequestException("Wrong folder type");
            entity.setFolder(folder);
        }
        options.deleteByQuestionId(entity.getId());
        pairs.deleteByQuestionId(entity.getId());
        saveNested(entity, dto);
        return toDto(entity);
    }

    @Override
    @Transactional
    public void deleteQuestion(Long restaurantId, Long questionId) {
        var entity = questions.findByIdAndRestaurantId(questionId, restaurantId).orElseThrow(() -> new NotFoundException("Question not found"));
        options.deleteByQuestionId(entity.getId());
        pairs.deleteByQuestionId(entity.getId());
        questions.delete(entity);
    }

    private void saveNested(TrainingQuestion question, TrainingQuestionDto dto) {
        if (dto.options() != null) {
            options.saveAll(dto.options().stream().map(x -> TrainingQuestionOption.builder()
                    .question(question).text(x.text()).correct(x.correct()).sortOrder(x.sortOrder() == null ? 0 : x.sortOrder()).build()).toList());
        }
        if (dto.matchPairs() != null) {
            pairs.saveAll(dto.matchPairs().stream().map(x -> TrainingQuestionMatchPair.builder()
                    .question(question).leftText(x.leftText()).rightText(x.rightText()).sortOrder(x.sortOrder() == null ? 0 : x.sortOrder()).build()).toList());
        }
    }

    private TrainingQuestionDto toDto(TrainingQuestion q) {
        return new TrainingQuestionDto(q.getId(), q.getRestaurant().getId(), q.getFolder().getId(), q.getType(), q.getPrompt(), q.getExplanation(), q.getSortOrder(), q.isActive(),
                options.findByQuestionIdOrderBySortOrderAscIdAsc(q.getId()).stream().map(o -> new TrainingQuestionOptionDto(o.getId(), o.getText(), o.isCorrect(), o.getSortOrder())).toList(),
                pairs.findByQuestionIdOrderBySortOrderAscIdAsc(q.getId()).stream().map(p -> new TrainingQuestionMatchPairDto(p.getId(), p.getLeftText(), p.getRightText(), p.getSortOrder())).toList());
    }
}

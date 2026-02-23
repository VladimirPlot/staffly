package ru.staffly.training.repository;

import java.time.Instant;

public interface TrainingExamProgressProjection {
    Long getExamId();

    Instant getLastAttemptAt();

    Integer getScorePercent();
}
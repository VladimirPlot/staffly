package ru.staffly.training.repository;

import java.time.Instant;

public interface TrainingExamResultProjection {
    Long getUserId();
    String getFullName();
    Integer getAttemptsUsed();
    Integer getBestScore();
    Instant getLastAttemptAt();
    Boolean getPassed();
}

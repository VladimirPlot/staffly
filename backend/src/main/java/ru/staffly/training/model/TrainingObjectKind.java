package ru.staffly.training.model;

/**
 * Independently ordered kinds in a training container. New material types get a
 * new enum value and their own reorder strategy; their order is never mixed.
 */
public enum TrainingObjectKind {
    FOLDER,
    KNOWLEDGE_ITEM,
    QUESTION,
    PRACTICE_EXAM
}

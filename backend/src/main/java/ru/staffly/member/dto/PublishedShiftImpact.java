package ru.staffly.member.dto;

/** Physical-time classification of cells in an active published schedule row. */
public record PublishedShiftImpact(int elapsedPreserved, int currentPreserved,
                                   int futureToCancel, int legacyUnstructuredPreserved) { }

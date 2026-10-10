package ru.staffly.auth.dto;

// A compatibility hint for sessions created before restaurant context was persisted.
// It is always checked against the refresh-session user's current permissions.
public record RefreshRequest(Long restaurantId) {}

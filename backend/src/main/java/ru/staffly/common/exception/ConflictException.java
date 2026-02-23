package ru.staffly.common.exception;

import java.util.Map;

public class ConflictException extends RuntimeException {
    private final Map<String, Object> meta;

    public ConflictException(String message) {
        super(message);
        this.meta = null;
    }

    public ConflictException(String message, Map<String, Object> meta) {
        super(message);
        this.meta = meta;
    }

    public Map<String, Object> getMeta() {
        return meta;
    }
}

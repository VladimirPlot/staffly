package ru.staffly.common.exception;

import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class ErrorResponse {
    private String error;
    private String message;
    private Map<String, Object> meta;

    public ErrorResponse(String error) {
        this.error = error;
        this.message = error;
    }

    public ErrorResponse(String error, String message, Map<String, Object> meta) {
        this.error = error;
        this.message = message;
        this.meta = meta;
    }
}

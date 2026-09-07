package ru.staffly.schedule.exception;

public class ScheduleDomainConflictException extends RuntimeException {
    private final String errorCode;

    public ScheduleDomainConflictException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}

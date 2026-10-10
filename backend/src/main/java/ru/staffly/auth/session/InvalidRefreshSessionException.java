package ru.staffly.auth.session;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.UNAUTHORIZED)
public class InvalidRefreshSessionException extends RuntimeException {
    public InvalidRefreshSessionException(String message) {
        super(message);
    }
}

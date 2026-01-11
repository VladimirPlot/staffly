package ru.staffly.common.time;

import org.springframework.stereotype.Component;

import java.time.Clock;

@Component
public class TimeProviderInitializer {

    public TimeProviderInitializer(Clock clock) {
        TimeProvider.setClock(clock);
    }
}
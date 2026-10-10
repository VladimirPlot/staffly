package ru.staffly.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import ru.staffly.user.model.User;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/** The configured global User authority used both for token issuance and resource-owner validation. */
@Component
public class GlobalCreatorPolicy {
    private final Set<String> creatorPhones;

    public GlobalCreatorPolicy(@Value("${app.creator.phones:+79999999999}") String creatorPhonesCsv) {
        creatorPhones = Arrays.stream(creatorPhonesCsv.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toUnmodifiableSet());
    }

    public boolean isCreator(User user) {
        return user != null && user.getPhone() != null && creatorPhones.contains(user.getPhone());
    }
}

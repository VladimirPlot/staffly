package ru.staffly.push.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class PushPayloadFactory {

    private static final int MAX_BODY_LENGTH = 160;

    private final ObjectMapper objectMapper;

    public String buildForMessage(InboxMessage message) {
        Long restaurantId = message.getRestaurant().getId();
        String restaurantName = message.getRestaurant().getName();
        Long messageId = message.getId();
        InboxMessageType type = message.getType();

        String title = resolveTitle(type);
        String body = resolveBody(type, message.getContent());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", title);
        payload.put("body", body);
        payload.put("tag", "inbox:" + messageId);
        payload.put("rid", restaurantId);
        payload.put("to", "/inbox");
        payload.put("mid", messageId);
        payload.put("url", "/push?rid=" + restaurantId + "&to=/inbox&mid=" + messageId);
        payload.put("restaurantId", restaurantId);
        payload.put("restaurantName", restaurantName);
        payload.put("messageId", messageId);
        payload.put("type", type.name());

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize push payload", e);
        }
    }

    private String resolveTitle(InboxMessageType type) {
        return switch (type) {
            case ANNOUNCEMENT -> "Объявление";
            case EVENT -> "Событие";
            case BIRTHDAY -> "День рождения";
            case ANONYMOUS_LETTER -> "Анонимное письмо";
        };
    }

    private String resolveBody(InboxMessageType type, String content) {
        if (type == InboxMessageType.ANONYMOUS_LETTER) {
            return "Новое сообщение";
        }
        String normalized = normalize(content);
        return truncate(normalized, MAX_BODY_LENGTH);
    }

    private String normalize(String content) {
        if (content == null) {
            return "";
        }
        return content.replaceAll("\\s+", " ").trim();
    }

    private String truncate(String content, int maxLen) {
        if (content.length() <= maxLen) {
            return content;
        }
        return content.substring(0, Math.max(0, maxLen - 1)) + "…";
    }
}

package ru.staffly.push.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.restaurant.model.Restaurant;

import static org.assertj.core.api.Assertions.assertThat;

class PushPayloadFactoryTest {
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final PushPayloadFactory factory = new PushPayloadFactory(objectMapper);

    @Test
    void usesPushSpecificTextWhenPresent() throws Exception {
        JsonNode payload = payloadFor("Detailed Inbox text", "Short Push text");

        assertThat(payload.get("body").asText()).isEqualTo("Short Push text");
    }

    @Test
    void legacyContentOnlyMessageRemainsThePushFallback() throws Exception {
        JsonNode payload = payloadFor("Legacy content", null);

        assertThat(payload.get("body").asText()).isEqualTo("Legacy content");
    }

    private JsonNode payloadFor(String content, String pushText) throws Exception {
        InboxMessage message = InboxMessage.builder()
                .id(5L)
                .restaurant(Restaurant.builder().id(7L).name("Staffly").build())
                .type(InboxMessageType.EVENT)
                .content(content)
                .pushText(pushText)
                .meta("test")
                .build();
        return objectMapper.readTree(factory.buildForMessage(message));
    }
}

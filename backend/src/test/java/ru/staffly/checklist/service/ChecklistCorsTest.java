package ru.staffly.checklist.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import ru.staffly.config.CorsConfig;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class ChecklistCorsTest {
    @Test void versionHeaderIsAllowedInBrowserPreflight() {
        var request = new MockHttpServletRequest("OPTIONS", "/api/restaurants/1/checklists/1/items/1/complete");
        var config = new CorsConfig().corsConfigurationSource().getCorsConfiguration(request);
        assertNotNull(config);
        assertNotNull(config.checkHeaders(List.of("authorization", "content-type", "x-checklist-version")));
    }
}

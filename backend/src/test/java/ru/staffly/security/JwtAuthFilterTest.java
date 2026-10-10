package ru.staffly.security;

import jakarta.servlet.ServletException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtAuthFilterTest {
    @Test void invalidTokenReturnsUnauthorizedWithoutCallingApplication() throws Exception {
        var jwt = mock(JwtService.class);
        when(jwt.parse("invalid")).thenThrow(new io.jsonwebtoken.MalformedJwtException("invalid"));
        var request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer invalid");
        var response = new MockHttpServletResponse();
        new JwtAuthFilter(jwt).doFilter(request, response, (req, res) -> fail("Must not dispatch invalid token"));
        assertEquals(401, response.getStatus());
    }

    @Test void applicationExceptionDoesNotBecomeInvalidTokenResponse() {
        var filter = new JwtAuthFilter(mock(JwtService.class));
        var response = new MockHttpServletResponse();
        assertThrows(ServletException.class, () -> filter.doFilter(new MockHttpServletRequest(), response,
                (request, res) -> { throw new ServletException("application failure"); }));
        assertEquals(200, response.getStatus());
    }
}

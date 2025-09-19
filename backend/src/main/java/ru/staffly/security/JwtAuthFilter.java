package ru.staffly.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws IOException, ServletException {
        String auth = request.getHeader(HttpHeaders.AUTHORIZATION);
        try {
            if (auth != null && auth.startsWith("Bearer ")) {
                String token = auth.substring(7);
                Map<String, Object> c = jwt.parse(token);

                // userId из sub
                String sub = (String) c.get("sub");
                Long userId = (sub != null) ? Long.valueOf(sub) : null;

                // phone
                String phone = (String) c.get("phone");

                // restaurantId может отсутствовать
                Long restaurantId = null;
                Object ridClaim = c.get("restaurantId");
                if (ridClaim instanceof Number n) {
                    restaurantId = n.longValue();
                }

                // roles → нормализуем к List<String>
                Object rolesClaim = c.get("roles");
                List<String> roles;
                if (rolesClaim instanceof List<?> list) {
                    roles = list.stream().map(String::valueOf).toList();
                } else if (rolesClaim instanceof String s) {
                    roles = List.of(s);
                } else if (rolesClaim == null) {
                    roles = List.of();
                } else {
                    roles = List.of(String.valueOf(rolesClaim));
                }

                var principal = new UserPrincipal(userId, phone, restaurantId, roles);

                var authToken = new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        principal.authorities()
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }

            chain.doFilter(request, response);
        } catch (Exception ex) {
            SecurityContextHolder.clearContext();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            new ObjectMapper().writeValue(response.getWriter(),
                    Map.of("error", "invalid_token", "message", ex.getMessage()));
        }
    }
}
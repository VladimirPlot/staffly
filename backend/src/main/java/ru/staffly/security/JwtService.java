package ru.staffly.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtService {
    private final Key key;
    private final long ttlMinutes;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.ttl-minutes}") long ttlMinutes) {
        this.key = deriveHmacKey(secret);
        this.ttlMinutes = ttlMinutes;
    }

    private static Key deriveHmacKey(String secret) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            try {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                bytes = md.digest(bytes); // гарантированно 32 байта
            } catch (Exception e) {
                throw new IllegalStateException("Cannot init JWT key", e);
            }
        }
        return Keys.hmacShaKeyFor(bytes);
    }

    public String generateToken(UserPrincipal principal) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(ttlMinutes * 60);

        var builder = Jwts.builder()
                .setSubject(String.valueOf(principal.userId()))
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(exp))
                .claim("phone", principal.phone())
                .claim("roles", principal.roles());

        // НЕ пишем restaurantId, если он null
        if (principal.restaurantId() != null) {
            builder.claim("restaurantId", principal.restaurantId());
        }

        return builder.signWith(key, SignatureAlgorithm.HS256).compact();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> parse(String token) {
        var jws = Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token);

        var claims = jws.getBody();

        // ВАЖНО: НЕЛЬЗЯ Map.of(...) — он ломается на null.
        Map<String, Object> out = new HashMap<>();
        out.put("sub", claims.getSubject());
        out.put("phone", claims.get("phone"));

        Object rid = claims.get("restaurantId");
        if (rid != null) out.put("restaurantId", rid);

        Object roles = claims.get("roles");
        if (roles != null) out.put("roles", roles);

        out.put("iat", claims.getIssuedAt());
        out.put("exp", claims.getExpiration());
        return out;
    }
}
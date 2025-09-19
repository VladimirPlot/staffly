package ru.staffly.me;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import ru.staffly.security.UserPrincipal;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/me")
public class MeController {

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public Map<String, Object> me(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }

        boolean isCreator = principal.roles() != null && principal.roles().contains("CREATOR");

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("userId", principal.userId());
        res.put("phone", principal.phone());
        res.put("roles", principal.roles() == null ? List.of() : principal.roles());
        res.put("isCreator", isCreator);
        if (principal.restaurantId() != null) {
            res.put("restaurantId", principal.restaurantId());
        }
        return res;
    }
}
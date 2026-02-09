package ru.staffly.me;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.dto.MyMembershipDto;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.security.UserPrincipal;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MeController {

    private final RestaurantMemberRepository members;
    private final MemberMapper mapper;
    private final UserRepository users;

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public Map<String, Object> me(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }

        boolean isCreator = principal.roles() != null && principal.roles().contains("CREATOR");

        // Подтянем пользователя и аватар
        User u = users.findById(principal.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        String avatarUrl = u.getAvatarUrl();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("userId", principal.userId());
        res.put("phone", principal.phone());
        res.put("roles", principal.roles() == null ? List.of() : principal.roles());
        res.put("isCreator", isCreator);
        res.put("firstName", u.getFirstName());
        res.put("lastName", u.getLastName());
        if (u.getBirthDate() != null) res.put("birthDate", u.getBirthDate());
        res.put("theme", u.getTheme());
        if (avatarUrl != null) {
            res.put("avatarUrl", withBust(avatarUrl, u.getUpdatedAt()));
        }
        if (principal.restaurantId() != null) {
            res.put("restaurantId", principal.restaurantId());
        }
        return res;
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/memberships")
    public List<MyMembershipDto> memberships(@AuthenticationPrincipal UserPrincipal principal) {
        return members.findMembershipsDtoByUserId(principal.userId());
    }

    private static String withBust(String url, LocalDateTime updatedAt) {
        long v = (updatedAt == null)
                ? TimeProvider.now().getEpochSecond()
                : updatedAt.toInstant(ZoneOffset.UTC).getEpochSecond();
        return url + (url.contains("?") ? "&" : "?") + "v=" + v;
    }
}
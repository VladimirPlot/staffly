package ru.staffly.restaurant.service.impl;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.dto.CreateRestaurantRequest;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.restaurant.service.RestaurantService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class RestaurantServiceImpl implements RestaurantService {

    private final RestaurantRepository restaurants;
    private final UserRepository users;
    private final RestaurantMemberRepository members;

    @Override
    @Transactional
    public Restaurant create(CreateRestaurantRequest req) {
        String name = req.name().trim();
        if (name.isBlank()) throw new ConflictException("Name is required");

        String code = req.code() == null || req.code().isBlank()
                ? slugify(name)
                : normalizeCode(req.code());

        // обеспечить уникальность кода (регистр неважен)
        restaurants.findByCode(code).ifPresent(r -> {
            throw new ConflictException("Restaurant code already exists: " + code);
        });

        Restaurant r = Restaurant.builder()
                .name(name)
                .code(code)
                .active(true)
                .build();

        return restaurants.save(r);
    }

    @Override
    @Transactional
    public void assignAdmin(Long restaurantId, Long userId) {
        Restaurant r = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        User u = users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));

        var existing = members.findByUserIdAndRestaurantId(userId, restaurantId);
        if (existing.isPresent()) {
            var m = existing.get();
            m.setRole(RestaurantRole.ADMIN);
            members.save(m);
        } else {
            var m = RestaurantMember.builder()
                    .user(u)
                    .restaurant(r)
                    .role(RestaurantRole.ADMIN)
                    .build();
            members.save(m);
        }
    }

    /* ------- helpers ------- */

    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9-]");
    private static final Pattern DASHES = Pattern.compile("-+");

    private String slugify(String s) {
        // упростим: латинизация + нижний регистр + дефисы
        String n = Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replace(' ', '-');
        n = NON_ALNUM.matcher(n).replaceAll("-");
        n = DASHES.matcher(n).replaceAll("-");
        n = trimDashes(n);
        if (n.isBlank()) n = "rest-" + System.currentTimeMillis();
        // ограничим до 64 символов
        return n.length() > 64 ? n.substring(0, 64) : n;
    }

    private String normalizeCode(String code) {
        String c = code.trim().toLowerCase(Locale.ROOT);
        c = NON_ALNUM.matcher(c.replace(' ', '-')).replaceAll("-");
        c = DASHES.matcher(c).replaceAll("-");
        c = trimDashes(c);
        if (c.isBlank()) throw new ConflictException("Invalid code");
        return c.length() > 64 ? c.substring(0, 64) : c;
    }

    private String trimDashes(String s) {
        int i = 0, j = s.length();
        while (i < j && s.charAt(i) == '-') i++;
        while (j > i && s.charAt(j - 1) == '-') j--;
        return s.substring(i, j);
    }
}
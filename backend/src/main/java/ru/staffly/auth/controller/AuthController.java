package ru.staffly.auth.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import ru.staffly.auth.config.AuthProperties;
import ru.staffly.auth.dto.AuthResponse;
import ru.staffly.auth.dto.LoginRequest;
import ru.staffly.auth.dto.RegisterRequest;
import ru.staffly.auth.dto.SwitchRestaurantRequest;
import ru.staffly.auth.session.AuthSessionService;
import ru.staffly.auth.session.RefreshCookieService;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.security.JwtService;
import ru.staffly.security.UserPrincipal;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final RestaurantMemberRepository memberRepository;
    private final Set<String> creatorPhones;
    private final AuthSessionService authSessionService;
    private final RefreshCookieService refreshCookieService;
    private final AuthProperties authProperties;

    @Autowired
    public AuthController(UserRepository users,
                          PasswordEncoder encoder,
                          JwtService jwt,
                          RestaurantMemberRepository memberRepository,
                          AuthSessionService authSessionService,
                          RefreshCookieService refreshCookieService,
                          AuthProperties authProperties,
                          @Value("${app.creator.phones:+79999999999}") String creatorPhonesCsv) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.memberRepository = memberRepository;
        this.authSessionService = authSessionService;
        this.refreshCookieService = refreshCookieService;
        this.authProperties = authProperties;
        this.creatorPhones = Arrays.stream(creatorPhonesCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody @Valid RegisterRequest req,
                                                 HttpServletRequest request) {
        // нормализация
        String phone = req.phone().trim();
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        String firstName = req.firstName().trim();
        String lastName  = req.lastName().trim();

        // проверки уникальности
        if (users.existsByPhone(phone)) {
            throw new BadRequestException("Номер телефона уже используется");
        }
        if (users.existsByEmailIgnoreCase(email)) {
            throw new BadRequestException("Email уже используется");
        }
        LocalDate bd = null;
        if (req.birthDate() != null && !req.birthDate().isBlank()) {
            try {
                bd = LocalDate.parse(req.birthDate());
                if (bd.isAfter(LocalDate.now())) {
                    throw new BadRequestException("День рождение не может быть в будущем");
                }
            } catch (DateTimeParseException e) {
                throw new BadRequestException("Неверный формат даты(expected yyyy-MM-dd)");
            }
        }

        User u = users.save(User.builder()
                .phone(phone)
                .email(email)
                .firstName(firstName)
                .lastName(lastName)
                .passwordHash(encoder.encode(req.password()))
                .birthDate(bd)
                .active(true)
                .build());

        // авто-логин
        List<String> roles = creatorPhones.contains(u.getPhone()) ? List.of("CREATOR") : List.of();
        var principal = new UserPrincipal(u.getId(), u.getPhone(), null, roles);
        String token = jwt.generateToken(principal);
        String refreshToken = authSessionService.createSession(u.getId(), request.getHeader("User-Agent"), resolveIp(request));
        var cookie = refreshCookieService.buildRefreshCookie(refreshToken, request);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new AuthResponse(token));
    }

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<AuthResponse> login(@RequestBody @Valid LoginRequest req,
                                              HttpServletRequest request) {
        var u = users.findByPhone(req.phone())
                .orElseThrow(() -> new NotFoundException("Пользователь не найдет"));
        if (!encoder.matches(req.password(), u.getPasswordHash())) {
            throw new BadRequestException("Неверные учетные данные");
        }
        List<String> roles = creatorPhones.contains(u.getPhone()) ? List.of("CREATOR") : List.of();
        var principal = new UserPrincipal(u.getId(), u.getPhone(), null, roles);
        String token = jwt.generateToken(principal);
        String refreshToken = authSessionService.createSession(u.getId(), request.getHeader("User-Agent"), resolveIp(request));
        var cookie = refreshCookieService.buildRefreshCookie(refreshToken, request);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(new AuthResponse(token));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest request) {
        String refreshToken = extractRefreshToken(request);
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            var rotation = authSessionService.rotateSession(refreshToken, request.getHeader("User-Agent"), resolveIp(request));
            var user = users.findById(rotation.userId()).orElseThrow();
            List<String> roles = creatorPhones.contains(user.getPhone()) ? List.of("CREATOR") : List.of();
            var principal = new UserPrincipal(user.getId(), user.getPhone(), null, roles);
            String token = jwt.generateToken(principal);
            var cookie = refreshCookieService.buildRefreshCookie(rotation.refreshToken(), request);
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, cookie.toString())
                    .body(new AuthResponse(token));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        String refreshToken = extractRefreshToken(request);
        if (refreshToken != null && !refreshToken.isBlank()) {
            authSessionService.revokeSession(refreshToken);
        }
        var cookie = refreshCookieService.clearRefreshCookie(request);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .build();
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/switch-restaurant")
    public ResponseEntity<AuthResponse> switchRestaurant(@AuthenticationPrincipal UserPrincipal principal,
                                                         @RequestBody @Valid SwitchRestaurantRequest req) {
        Long userId = principal.userId();
        Long restaurantId = req.restaurantId();

        boolean member = memberRepository.findByUserIdAndRestaurantId(userId, restaurantId).isPresent();
        if (!member) throw new ForbiddenException("Не является сотрудником ресторана");

        var newPrincipal = new UserPrincipal(
                userId,
                principal.phone(),
                restaurantId,
                principal.roles() == null ? List.of() : principal.roles()
        );
        String token = jwt.generateToken(newPrincipal);
        return ResponseEntity.ok(new AuthResponse(token));
    }

    private String extractRefreshToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (authProperties.refreshCookieName().equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private String resolveIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp;
        }
        return request.getRemoteAddr();
    }
}
package ru.staffly.auth.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import ru.staffly.auth.dto.AuthResponse;
import ru.staffly.auth.dto.LoginRequest;
import ru.staffly.auth.dto.RegisterRequest;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.security.JwtService;
import ru.staffly.security.UserPrincipal;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    // список телефонов с глобальной ролью CREATOR
    private final Set<String> creatorPhones;

    // внедрение через конструктор
    @Autowired
    public AuthController(UserRepository users,
                          PasswordEncoder encoder,
                          JwtService jwt,
                          @Value("${app.creator.phones:+79999999999}") String creatorPhonesCsv) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.creatorPhones = Arrays.stream(creatorPhonesCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody @Valid RegisterRequest req) {
        users.findByPhone(req.phone()).ifPresent(u -> { throw new BadRequestException("Phone already registered"); });
        if (req.email() != null && !req.email().isBlank()) {
            users.findByEmail(req.email()).ifPresent(u -> { throw new BadRequestException("Email already registered"); });
        }

        User u = users.save(User.builder()
                .phone(req.phone())
                .email(req.email())
                .firstName(req.firstName())
                .lastName(req.lastName())
                .passwordHash(encoder.encode(req.password()))
                .active(true)
                .build());

        // опционально — авто-логин после регистрации
        List<String> roles = creatorPhones.contains(u.getPhone()) ? List.of("CREATOR") : List.of();
        var principal = new UserPrincipal(u.getId(), u.getPhone(), null, roles);
        String token = jwt.generateToken(principal);
        return ResponseEntity.ok(new AuthResponse(token));
    }

    @PostMapping("/login")
    @Transactional(readOnly = true)
    public ResponseEntity<AuthResponse> login(@RequestBody @Valid LoginRequest req) {
        var u = users.findByPhone(req.phone())
                .orElseThrow(() -> new NotFoundException("User not found"));
        if (!encoder.matches(req.password(), u.getPasswordHash())) {
            throw new BadRequestException("Bad credentials");
        }

        // Глобальные роли (только CREATOR). Роли в ресторане — НЕ сюда.
        List<String> roles = creatorPhones.contains(u.getPhone()) ? List.of("CREATOR") : List.of();

        var principal = new UserPrincipal(u.getId(), u.getPhone(), null, roles);
        String token = jwt.generateToken(principal);
        return ResponseEntity.ok(new AuthResponse(token));
    }
}
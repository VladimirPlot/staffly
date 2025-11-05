package ru.staffly.user.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.media.AvatarStorage;
import ru.staffly.security.UserPrincipal;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Map;

import static ru.staffly.common.util.InviteUtils.normalizeEmail;
import static ru.staffly.common.util.InviteUtils.normalizePhone;

@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AvatarStorage avatarStorage;

    /* ===== DTO ===== */

    // Патч-модель: все поля опциональные. Валидируются если переданы.
    public static record UpdateUserRequest(
            @Size(max = 35) String firstName,
            @Size(max = 35) String lastName,
            @Pattern(regexp = "\\+?\\d{10,15}") String phone,
            @Email @Size(max = 255) String email,
            @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$") String birthDate
    ) {}

    public static record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 6, max = 64) String newPassword
    ) {}

    public static record UserProfileDto(
            Long id, String phone, String email, String firstName, String lastName, String fullName, String birthDate
    ) {
        public static UserProfileDto from(User u) {
            return new UserProfileDto(
                    u.getId(), u.getPhone(), u.getEmail(), u.getFirstName(), u.getLastName(), u.getFullName(), u.getBirthDate() == null ? null : u.getBirthDate().toString()
            );
        }
    }

    /* ===== Endpoints ===== */

    // (опционально) отдать профиль в едином формате
    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public UserProfileDto get(@AuthenticationPrincipal UserPrincipal principal) {
        User u = users.findById(principal.userId())
                .orElseThrow(() -> new NotFoundException("User not found: " + principal.userId()));
        return UserProfileDto.from(u);
    }

    // PATCH /api/users/me — обновить имя/фамилию/телефон/email (любой подмножество полей)
    @PreAuthorize("isAuthenticated()")
    @PatchMapping
    public UserProfileDto update(@AuthenticationPrincipal UserPrincipal principal,
                                 @Valid @RequestBody UpdateUserRequest req) {
        User u = users.findById(principal.userId())
                .orElseThrow(() -> new NotFoundException("User not found: " + principal.userId()));

        boolean changed = false;

        if (req.firstName() != null) {
            String fn = req.firstName().trim();
            if (!fn.equals(u.getFirstName())) { u.setFirstName(fn); changed = true; }
        }
        if (req.lastName() != null) {
            String ln = req.lastName().trim();
            if (!ln.equals(u.getLastName())) { u.setLastName(ln); changed = true; }
        }
        if (req.phone() != null) {
            String ph = normalizePhone(req.phone());
            if (!ph.equals(u.getPhone())) {
                if (users.existsByPhoneAndIdNot(ph, u.getId()))
                    throw new ConflictException("Phone already in use");
                u.setPhone(ph);
                changed = true;
            }
        }
        if (req.email() != null) {
            String em = normalizeEmail(req.email()).toLowerCase(Locale.ROOT);
            if (!em.equalsIgnoreCase(u.getEmail())) {
                if (users.existsByEmailIgnoreCaseAndIdNot(em, u.getId()))
                    throw new ConflictException("Email already in use");
                u.setEmail(em);
                changed = true;
            }
        }
        if (req.birthDate() != null) {
            if (req.birthDate().isBlank()) {
                if (u.getBirthDate() != null) { u.setBirthDate(null); changed = true; }
            } else {
                try {
                    LocalDate bd = LocalDate.parse(req.birthDate()); // ожидаем ISO yyyy-MM-dd
                    if (bd.isAfter(LocalDate.now())) {
                        throw new BadRequestException("Birth date cannot be in the future");
                    }
                    if (!bd.equals(u.getBirthDate())) { u.setBirthDate(bd); changed = true; }
                } catch (DateTimeParseException ex) {
                    throw new BadRequestException("Invalid birthDate format (expected yyyy-MM-dd)");
                }
            }
        }

        if (!changed) {
            // ничего не прислали или прислали то же самое
            return UserProfileDto.from(u);
        }

        users.save(u); // @PreUpdate в entity обновит fullName/updatedAt
        return UserProfileDto.from(u);
    }

    // POST /api/users/me/change-password — сменить пароль
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/change-password")
    public void changePassword(@AuthenticationPrincipal UserPrincipal principal,
                               @Valid @RequestBody ChangePasswordRequest req) {
        User u = users.findById(principal.userId())
                .orElseThrow(() -> new NotFoundException("User not found: " + principal.userId()));

        // !!! В entity пароль хранится как passwordHash
        if (!passwordEncoder.matches(req.currentPassword(), u.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        if (passwordEncoder.matches(req.newPassword(), u.getPasswordHash())) {
            throw new BadRequestException("New password must be different from current");
        }
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        users.save(u);
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, String> uploadAvatar(@AuthenticationPrincipal UserPrincipal principal,
                                            @RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Пустой файл");
        }

        User u = users.findById(principal.userId())
                .orElseThrow(() -> new NotFoundException("User not found: " + principal.userId()));

        // удаляем старый файл (если был)
        try {
            avatarStorage.deleteByPublicUrl(u.getAvatarUrl());
        } catch (Exception ex) {
            // не падаем из-за удаления, просто логика «best effort»
        }

        // сохраняем новый и обновляем пользователя
        String publicUrl = avatarStorage.saveForUser(u.getId(), file);
        u.setAvatarUrl(publicUrl);
        users.save(u);

        return Map.of("avatarUrl", publicUrl);
    }
}
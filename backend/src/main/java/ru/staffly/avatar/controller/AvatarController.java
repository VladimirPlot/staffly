package ru.staffly.avatar.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.avatar.service.AvatarService;
import ru.staffly.security.UserPrincipal;

import java.util.Map;

@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class AvatarController {

    private final AvatarService avatars;

    @PreAuthorize("isAuthenticated()")
    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> upload(@AuthenticationPrincipal UserPrincipal principal,
                                                      @RequestPart("file") MultipartFile file) {
        String url = avatars.uploadUserAvatar(principal.userId(), file);
        return ResponseEntity.ok(Map.of("avatarUrl", url));
    }
}
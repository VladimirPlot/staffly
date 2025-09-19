package ru.staffly.avatar.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.avatar.service.AvatarService;
import ru.staffly.common.exception.BadRequestException;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LocalAvatarService implements AvatarService {

    private final Path root = Paths.get("data/avatars");

    @PostConstruct
    void init() throws IOException {
        Files.createDirectories(root);
    }

    @Override
    public String uploadUserAvatar(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Empty file");
        }
        String contentType = Optional.ofNullable(file.getContentType()).orElse("");
        if (!contentType.startsWith("image/")) {
            throw new BadRequestException("Only image/* allowed");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new BadRequestException("Max 5MB");
        }

        String ext = Optional.ofNullable(file.getOriginalFilename())
                .map(fn -> fn.substring(fn.lastIndexOf('.') + 1).toLowerCase())
                .filter(e -> e.matches("png|jpg|jpeg|webp"))
                .map(e -> "." + e)
                .orElse(".jpg");

        String filename = "user-" + userId + ext;
        Path dst = root.resolve(filename).normalize();

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dst, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new BadRequestException("Upload failed: " + e.getMessage());
        }
        return "/static/avatars/" + filename;
    }

    @Override
    public Resource getAvatar(String filename) {
        return new FileSystemResource(root.resolve(filename));
    }
}
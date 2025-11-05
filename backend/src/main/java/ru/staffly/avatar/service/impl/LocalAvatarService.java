package ru.staffly.avatar.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;          // ← добавьте
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

    @Value("${app.public-base-url:http://localhost:8080}")   // ← базовый публичный адрес API
    private String publicBaseUrl;

    private final Path root = Paths.get("data/avatars");

    @PostConstruct
    void init() throws IOException {
        Files.createDirectories(root);
    }

    private String abs(String path) {
        // склеиваем base + /static/...
        String base = publicBaseUrl;
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        if (!path.startsWith("/")) path = "/" + path;
        return base + path;
    }

    @Override
    public String uploadUserAvatar(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BadRequestException("Empty file");
        String contentType = Optional.ofNullable(file.getContentType()).orElse("");
        if (!contentType.startsWith("image/")) throw new BadRequestException("Only image/* allowed");
        if (file.getSize() > 5 * 1024 * 1024) throw new BadRequestException("Max 5MB");

        String original = Optional.ofNullable(file.getOriginalFilename()).orElse("");
        String ext = "";
        int dot = original.lastIndexOf('.');
        if (dot >= 0) ext = original.substring(dot + 1).toLowerCase();
        if (!ext.matches("png|jpg|jpeg|webp")) ext = "jpg";

        String filename = "user-" + userId + "." + ext;
        Path dst = root.resolve(filename).normalize();

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dst, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new BadRequestException("Upload failed: " + e.getMessage());
        }

        // ВОЗВРАЩАЕМ АБСОЛЮТНЫЙ URL
        return abs("/static/avatars/" + filename);
    }

    @Override
    public Resource getAvatar(String filename) {
        return new FileSystemResource(root.resolve(filename));
    }
}
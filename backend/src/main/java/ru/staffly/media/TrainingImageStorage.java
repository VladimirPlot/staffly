package ru.staffly.media;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Comparator;
import java.util.Set;
import java.util.UUID;

@Component
public class TrainingImageStorage {

    private final Path root = Path.of("data/training").toAbsolutePath().normalize();
    private static final Set<String> ALLOWED = Set.of(
            "image/jpeg", "image/png"
    );

    public TrainingImageStorage() throws IOException {
        Files.createDirectories(root);
    }

    public String saveForItem(Long itemId, MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("Пустой файл");

        String ct = file.getContentType();
        if (ct != null) {
            int i = ct.indexOf(';');                // срезать "; charset=..."
            if (i > -1) ct = ct.substring(0, i);
            ct = ct.trim().toLowerCase();
        }
        if (ct == null || !ALLOWED.contains(ct)) {
            throw new IllegalArgumentException("Разрешены только JPEG/PNG");
        }

        String ext = switch (ct) {
            case "image/jpeg" -> "jpg";
            case "image/png"               -> "png";
            default                        -> "bin";
        };

        Path dir = root.resolve(Path.of("items", String.valueOf(itemId)));
        Files.createDirectories(dir);

        String fname = UUID.randomUUID() + "." + ext;
        Path target = dir.resolve(fname);
        Files.write(target, file.getBytes(), StandardOpenOption.CREATE_NEW);

        // Возвращаем ПУБЛИЧНЫЙ URL (раздаётся через WebStaticConfig)
        String relative = "items/" + itemId + "/" + fname;
        return "/static/training/" + relative.replace('\\', '/');
    }

    public void deleteByPublicUrl(String publicUrl) throws IOException {
        if (publicUrl == null || !publicUrl.startsWith("/static/training/")) return;
        Path file = root.resolve(publicUrl.substring("/static/training/".length())).normalize();
        if (file.startsWith(root) && Files.exists(file)) {
            Files.delete(file);
        }
    }

    public void deleteItemFolder(Long itemId) throws IOException {
        Path dir = root.resolve(Path.of("items", String.valueOf(itemId))).normalize();
        if (!dir.startsWith(root)) return; // safety
        if (!Files.exists(dir)) return;

        // удалить рекурсивно
        try (var walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try { Files.deleteIfExists(p); } catch (IOException ignored) {}
                    });
        }
    }
}

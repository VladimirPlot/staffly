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
public class AvatarStorage {

    private final Path root = Path.of("data/avatars").toAbsolutePath().normalize();
    private static final Set<String> ALLOWED = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp"
    );

    public AvatarStorage() throws IOException {
        Files.createDirectories(root);
    }

    public String saveForUser(Long userId, MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("Пустой файл");

        String ct = file.getContentType();
        if (ct != null) {
            int i = ct.indexOf(';');
            if (i > -1) ct = ct.substring(0, i);
            ct = ct.trim().toLowerCase();
        }
        if (ct == null || !ALLOWED.contains(ct)) {
            throw new IllegalArgumentException("Разрешены только JPEG/PNG/WEBP");
        }

        String ext = switch (ct) {
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/png"               -> "png";
            case "image/webp"              -> "webp";
            default                        -> "bin";
        };

        Path dir = root.resolve(Path.of("users", String.valueOf(userId))).normalize();
        Files.createDirectories(dir);

        String fname = UUID.randomUUID() + "." + ext;
        Path target = dir.resolve(fname);
        Files.write(target, file.getBytes(), StandardOpenOption.CREATE_NEW);

        // после успешной записи — подчистим всё лишнее
        cleanupUserFiles(userId, fname);

        // ПУБЛИЧНЫЙ URL (отдаётся через WebStaticConfig)
        String relative = "avatars/users/" + userId + "/" + fname;
        return "/static/" + relative.replace('\\', '/');
    }

    public void deleteByPublicUrl(String publicUrl) throws IOException {
        if (publicUrl == null) return;
        Path file = resolveFromPublicUrl(publicUrl);
        if (file == null) return;
        if (file.startsWith(root)) {
            Files.deleteIfExists(file);
        }
    }

    public void deleteUserFolder(Long userId) throws IOException {
        Path dir = root.resolve(Path.of("users", String.valueOf(userId))).normalize();
        if (!dir.startsWith(root) || !Files.exists(dir)) return;

        try (var walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder())
                    .forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) {} });
        }
    }

    private void cleanupUserFiles(Long userId, String keepFileName) {
        // 1) подчистить все старые файлы в папке users/<id>, кроме только что загруженного
        Path dir = root.resolve(Path.of("users", String.valueOf(userId))).normalize();
        if (Files.exists(dir)) {
            try (var stream = Files.list(dir)) {
                stream.filter(p -> !Files.isDirectory(p))
                        .filter(p -> !p.getFileName().toString().equals(keepFileName))
                        .forEach(p -> {
                            try { Files.deleteIfExists(p); } catch (Exception ignored) {}
                        });
            } catch (Exception ignored) {}
        }

        // 2) подчистить возможные ЛЕГАСИ-файлы старого формата вида data/avatars/user-<id>.<ext>
        try (var ds = Files.newDirectoryStream(root, "user-" + userId + ".*")) {
            for (Path p : ds) {
                try { Files.deleteIfExists(p); } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}
    }

    /** Делаем deleteByPublicUrl «понимающим» и абсолютные URL, и относительные */
    private Path resolveFromPublicUrl(String publicUrl) {
        String marker = "/static/avatars/";
        int i = publicUrl.indexOf(marker);
        if (i == -1) return null; // не наш URL
        String relative = publicUrl.substring(i + marker.length()); // users/1/xxx.jpg или user-1.jpg
        return root.resolve(relative).normalize();
    }
}
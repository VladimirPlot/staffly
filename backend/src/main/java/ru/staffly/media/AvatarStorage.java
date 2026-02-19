package ru.staffly.media;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.config.S3Config;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AvatarStorage {

    private final S3Client s3;
    private final S3Config s3cfg;

    private static final Set<String> ALLOWED = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp"
    );

    private static final String CACHE_CONTROL_1Y = "public, max-age=31536000, immutable";

    /**
     * S3 key:
     * avatars/users/{userId}/{uuid}.{ext}
     */
    public String saveForUser(Long userId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Пустой файл");

        String ct = normalizeContentType(file.getContentType());
        if (ct == null || !ALLOWED.contains(ct)) {
            throw new IllegalArgumentException("Разрешены только JPEG/PNG/WEBP");
        }

        String ext = switch (ct) {
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "bin";
        };

        // ✅ НАДЁЖНО: чистим весь prefix, чтобы 100% не копить мусор
        String prefix = "avatars/users/" + userId + "/";
        deleteByPrefix(s3cfg.getPublicBucket(), prefix);

        String key = prefix + UUID.randomUUID() + "." + ext;

        s3.putObject(
                PutObjectRequest.builder()
                        .bucket(s3cfg.getPublicBucket())
                        .key(key)
                        .contentType(ct)
                        .contentLength(file.getSize())
                        .cacheControl(CACHE_CONTROL_1Y)
                        .metadata(java.util.Map.of(
                                "uploadedAt", Instant.now().toString(),
                                "userId", String.valueOf(userId)
                        ))
                        .build(),
                RequestBody.fromBytes(file.getBytes())
        );

        return publicUrl(s3cfg.getPublicBucket(), key);
    }

    public void deleteByPublicUrl(String publicUrl) {
        if (publicUrl == null || publicUrl.isBlank()) return;

        BucketKey bk = extractBucketKeyFromUrl(publicUrl);
        if (bk == null) return; // не наш URL / старый формат — игнор

        try {
            s3.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bk.bucket())
                    .key(bk.key())
                    .build());
        } catch (S3Exception ignored) {
        }
    }

    public void deleteUserFolder(Long userId) {
        String prefix = "avatars/users/" + userId + "/";
        deleteByPrefix(s3cfg.getPublicBucket(), prefix);
    }

    /* ================= helpers ================= */

    private void deleteByPrefix(String bucket, String prefix) {
        try {
            String token = null;
            do {
                ListObjectsV2Response res = s3.listObjectsV2(ListObjectsV2Request.builder()
                        .bucket(bucket)
                        .prefix(prefix)
                        .continuationToken(token)
                        .maxKeys(1000)
                        .build());

                if (res.contents() != null && !res.contents().isEmpty()) {
                    var ids = res.contents().stream()
                            .map(o -> ObjectIdentifier.builder().key(o.key()).build())
                            .toList();

                    s3.deleteObjects(DeleteObjectsRequest.builder()
                            .bucket(bucket)
                            .delete(Delete.builder().objects(ids).build())
                            .build());
                }

                token = res.nextContinuationToken();
            } while (token != null);
        } catch (S3Exception ignored) {
        }
    }

    private String publicUrl(String bucket, String key) {
        String base = trimTrailingSlash(s3cfg.getPublicBaseUrl());
        return base + "/" + bucket + "/" + key;
    }

    private record BucketKey(String bucket, String key) {}

    /**
     * Понимает:
     * https://storage.yandexcloud.net/<bucket>/<key>
     */
    private BucketKey extractBucketKeyFromUrl(String url) {
        String base = trimTrailingSlash(s3cfg.getPublicBaseUrl());
        int i = url.indexOf(base);
        if (i == -1) return null;

        String tail = url.substring(i + base.length()); // "/bucket/key..."
        if (!tail.startsWith("/")) return null;
        tail = tail.substring(1);

        int slash = tail.indexOf('/');
        if (slash <= 0) return null;

        String bucket = tail.substring(0, slash);
        String key = tail.substring(slash + 1);
        if (bucket.isBlank() || key.isBlank()) return null;

        return new BucketKey(bucket, key);
    }

    private static String normalizeContentType(String ct) {
        if (ct == null) return null;
        int i = ct.indexOf(';');
        if (i > -1) ct = ct.substring(0, i);
        return ct.trim().toLowerCase();
    }

    private static String trimTrailingSlash(String s) {
        if (s == null) return "";
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}

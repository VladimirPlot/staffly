package ru.staffly.media;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.config.S3Config;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class ChecklistImageStorage {

    private static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/webp");
    private static final String CACHE_CONTROL_1Y = "public, max-age=31536000, immutable";
    private static final String CACHE_CONTROL_PRIVATE = "private, max-age=300";
    private static final String CHECKLIST_ITEM_IMAGE_PREFIX = "checklists/items/";
    private static final Duration COMPLETION_PHOTO_URL_TTL = Duration.ofMinutes(15);

    private final S3Client s3;
    private final S3Presigner presigner;
    private final S3Config s3cfg;

    public String saveExampleForItem(Long itemId, MultipartFile file) throws IOException {
        return saveForItem(itemId, "example", publicBucket(), CACHE_CONTROL_1Y, file, true);
    }

    public String saveCompletionForItem(Long itemId, MultipartFile file) throws IOException {
        return saveForItem(itemId, "completion", completionBucket(), CACHE_CONTROL_PRIVATE, file, false);
    }

    public String toCompletionPhotoUrl(String storedReference) {
        if (storedReference == null || storedReference.isBlank()) {
            return null;
        }
        String normalized = storedReference.trim();
        if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
            return normalized;
        }
        if (!isChecklistItemKey(normalized)) {
            return null;
        }

        GetObjectRequest objectRequest = GetObjectRequest.builder()
                .bucket(completionBucket())
                .key(normalized)
                .build();
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(COMPLETION_PHOTO_URL_TTL)
                .getObjectRequest(objectRequest)
                .build();
        return presigner.presignGetObject(presignRequest).url().toString();
    }

    public void deleteByPublicUrl(String publicUrl) {
        if (publicUrl == null || publicUrl.isBlank()) {
            return;
        }

        BucketKey bucketKey = extractBucketKeyFromUrl(publicUrl);
        if (bucketKey == null || !publicBucket().equals(bucketKey.bucket())) {
            return;
        }
        if (!bucketKey.key().startsWith(CHECKLIST_ITEM_IMAGE_PREFIX)) {
            return;
        }

        try {
            s3.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucketKey.bucket())
                    .key(bucketKey.key())
                    .build());
        } catch (S3Exception ignored) {
        }
    }

    public void deleteCompletionReference(String storedReference) {
        if (storedReference == null || storedReference.isBlank()) {
            return;
        }
        String normalized = storedReference.trim();
        if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
            deleteByPublicUrl(normalized);
            return;
        }
        if (!isChecklistItemKey(normalized)) {
            return;
        }
        deleteByBucketAndKey(completionBucket(), normalized);
    }

    private String saveForItem(Long itemId,
                               String photoType,
                               String bucket,
                               String cacheControl,
                               MultipartFile file,
                               boolean returnPublicUrl) throws IOException {
        if (itemId == null || itemId <= 0) {
            throw new IllegalArgumentException("Некорректный пункт чек-листа");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Пустой файл");
        }

        String contentType = normalizeContentType(file.getContentType());
        if (contentType == null || !ALLOWED.contains(contentType)) {
            throw new IllegalArgumentException("Разрешены только JPEG/PNG/WEBP");
        }

        String extension = switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "bin";
        };

        String key = CHECKLIST_ITEM_IMAGE_PREFIX + itemId + "/" + photoType + "/" + UUID.randomUUID() + "." + extension;
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .contentLength(file.getSize())
                .cacheControl(cacheControl)
                .metadata(java.util.Map.of(
                        "uploadedAt", Instant.now().toString(),
                        "checklistItemId", String.valueOf(itemId),
                        "checklistPhotoType", photoType
                ))
                .build();

        s3.putObject(request, RequestBody.fromBytes(file.getBytes()));
        return returnPublicUrl ? publicUrl(bucket, key) : key;
    }

    private String publicUrl(String bucket, String key) {
        return trimTrailingSlash(s3cfg.getPublicBaseUrl()) + "/" + bucket + "/" + key;
    }

    private BucketKey extractBucketKeyFromUrl(String url) {
        String base = trimTrailingSlash(s3cfg.getPublicBaseUrl());
        if (base.isBlank()) {
            return null;
        }
        String normalized = url.trim();
        String expectedPrefix = base + "/";
        if (!normalized.startsWith(expectedPrefix)) {
            return null;
        }
        String tail = normalized.substring(expectedPrefix.length());
        int slash = tail.indexOf('/');
        if (slash <= 0) {
            return null;
        }
        String bucket = tail.substring(0, slash);
        String key = tail.substring(slash + 1);
        if (bucket.isBlank() || key.isBlank()) {
            return null;
        }
        return new BucketKey(bucket, key);
    }

    private void deleteByBucketAndKey(String bucket, String key) {
        try {
            s3.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build());
        } catch (S3Exception ignored) {
        }
    }

    private boolean isChecklistItemKey(String key) {
        return key != null && key.startsWith(CHECKLIST_ITEM_IMAGE_PREFIX);
    }

    private String publicBucket() {
        String bucket = trimToEmpty(s3cfg.getPublicBucket());
        if (bucket.isBlank()) {
            throw new IllegalStateException("S3 public bucket is not configured");
        }
        return bucket;
    }

    private String completionBucket() {
        String privateBucket = trimToEmpty(s3cfg.getPrivateBucket());
        if (privateBucket.isBlank()) {
            throw new IllegalStateException("S3 private bucket is not configured");
        }
        return privateBucket;
    }

    private static String normalizeContentType(String contentType) {
        if (contentType == null) {
            return null;
        }
        int separator = contentType.indexOf(';');
        if (separator > -1) {
            contentType = contentType.substring(0, separator);
        }
        return contentType.trim().toLowerCase();
    }

    private static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String trimTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private record BucketKey(String bucket, String key) {
    }
}

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
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class DishwareInventoryImageStorage {

    private final S3Client s3;
    private final S3Config s3cfg;

    private static final Set<String> ALLOWED = Set.of("image/jpeg", "image/png", "image/webp");
    private static final String CACHE_CONTROL_1Y = "public, max-age=31536000, immutable";

    public String saveForItem(Long itemId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Пустой файл");
        }

        String ct = normalizeContentType(file.getContentType());
        if (ct == null || !ALLOWED.contains(ct)) {
            throw new IllegalArgumentException("Разрешены только JPEG/PNG/WEBP");
        }

        String ext = switch (ct) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "bin";
        };

        String prefix = "inventories/dishware/items/" + itemId + "/";
        String key = prefix + UUID.randomUUID() + "." + ext;

        PutObjectRequest req = PutObjectRequest.builder()
                .bucket(s3cfg.getPublicBucket())
                .key(key)
                .contentType(ct)
                .contentLength(file.getSize())
                .cacheControl(CACHE_CONTROL_1Y)
                .metadata(java.util.Map.of(
                        "uploadedAt", Instant.now().toString(),
                        "dishwareInventoryItemId", String.valueOf(itemId)
                ))
                .build();

        s3.putObject(req, RequestBody.fromBytes(file.getBytes()));

        return publicUrl(s3cfg.getPublicBucket(), key);
    }

    public void deleteByPublicUrl(String publicUrl) {
        if (publicUrl == null || publicUrl.isBlank()) {
            return;
        }

        BucketKey bk = extractBucketKeyFromUrl(publicUrl);
        if (bk == null) {
            return;
        }

        try {
            s3.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bk.bucket())
                    .key(bk.key())
                    .build());
        } catch (S3Exception ignored) {
        }
    }

    public void deleteItemFolder(Long itemId) {
        if (itemId == null) {
            return;
        }
        String prefix = "inventories/dishware/items/" + itemId + "/";
        deleteByPrefix(s3cfg.getPublicBucket(), prefix);
    }

    public void deleteItemFolderIfNoUrlMatch(Long itemId, String activePublicUrl) {
        if (itemId == null) {
            return;
        }

        if (activePublicUrl != null && !activePublicUrl.isBlank()) {
            BucketKey active = extractBucketKeyFromUrl(activePublicUrl);
            String expectedPrefix = "inventories/dishware/items/" + itemId + "/";
            if (active != null && s3cfg.getPublicBucket().equals(active.bucket()) && active.key().startsWith(expectedPrefix)) {
                return;
            }
        }

        deleteItemFolder(itemId);
    }

    public String copyFromPublicUrlToItem(String publicUrl, Long itemId) {
        if (publicUrl == null || publicUrl.isBlank() || itemId == null) {
            return null;
        }

        BucketKey source = extractBucketKeyFromUrl(publicUrl);
        if (source == null || !s3cfg.getPublicBucket().equals(source.bucket())) {
            return null;
        }

        String ext = extensionFromKey(source.key());
        String prefix = "inventories/dishware/items/" + itemId + "/";
        String targetKey = prefix + UUID.randomUUID() + ext;

        try {
            HeadObjectResponse head = s3.headObject(HeadObjectRequest.builder()
                    .bucket(source.bucket())
                    .key(source.key())
                    .build());

            CopyObjectRequest.Builder request = CopyObjectRequest.builder()
                    .sourceBucket(source.bucket())
                    .sourceKey(source.key())
                    .destinationBucket(s3cfg.getPublicBucket())
                    .destinationKey(targetKey)
                    .metadataDirective(MetadataDirective.REPLACE)
                    .cacheControl(CACHE_CONTROL_1Y)
                    .metadata(Map.of(
                            "uploadedAt", Instant.now().toString(),
                            "dishwareInventoryItemId", String.valueOf(itemId)
                    ));

            if (head.contentType() != null && !head.contentType().isBlank()) {
                request.contentType(head.contentType());
            }

            s3.copyObject(request.build());
            return publicUrl(s3cfg.getPublicBucket(), targetKey);
        } catch (S3Exception ignored) {
            return null;
        }
    }

    public void deleteItemImage(Long itemId, String publicUrl) {
        if (itemId == null || publicUrl == null || publicUrl.isBlank()) {
            return;
        }

        BucketKey bucketKey = extractBucketKeyFromUrl(publicUrl);
        if (bucketKey == null || !s3cfg.getPublicBucket().equals(bucketKey.bucket())) {
            return;
        }

        String expectedPrefix = "inventories/dishware/items/" + itemId + "/";
        if (!bucketKey.key().startsWith(expectedPrefix)) {
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

    private BucketKey extractBucketKeyFromUrl(String url) {
        String base = trimTrailingSlash(s3cfg.getPublicBaseUrl());
        int i = url.indexOf(base);
        if (i == -1) {
            return null;
        }

        String tail = url.substring(i + base.length());
        if (!tail.startsWith("/")) {
            return null;
        }
        tail = tail.substring(1);

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

    private static String normalizeContentType(String ct) {
        if (ct == null) {
            return null;
        }
        int i = ct.indexOf(';');
        if (i > -1) {
            ct = ct.substring(0, i);
        }
        return ct.trim().toLowerCase();
    }

    private static String trimTrailingSlash(String s) {
        if (s == null) {
            return "";
        }
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    private static String extensionFromKey(String key) {
        int dotIndex = key.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == key.length() - 1) {
            return "";
        }
        return key.substring(dotIndex);
    }

    private record BucketKey(String bucket, String key) {
    }
}

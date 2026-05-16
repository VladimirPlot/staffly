package ru.staffly.inventory.service;

import org.junit.jupiter.api.Test;
import ru.staffly.inventory.model.DishwareInventoryStatus;
import ru.staffly.media.DishwareInventoryImageStorage;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

class DishwareInventoryPrintFormExporterTest {

    @Test
    void exportHtmlSkipsImageWhenReaderFails() {
        DishwareInventoryPrintFormExporter exporter = new DishwareInventoryPrintFormExporter((publicUrl, maxBytes) -> {
            throw new IllegalStateException("S3 is temporarily unavailable");
        });

        assertThatCode(() -> {
            byte[] html = exporter.exportHtml(printFormWithItems(List.of(item(1, "Тарелка", "broken-url"))));
            assertThat(new String(html, StandardCharsets.UTF_8)).contains("Тарелка");
        }).doesNotThrowAnyException();
    }

    @Test
    void exportSkipsCorruptImages() {
        DishwareInventoryPrintFormExporter exporter = new DishwareInventoryPrintFormExporter((publicUrl, maxBytes) ->
                Optional.of(new DishwareInventoryImageStorage.StoredImage(new byte[]{1, 2, 3, 4}, "image/jpeg"))
        );

        assertThatCode(() -> exporter.export(printFormWithItems(List.of(item(1, "Чашка", "corrupt-url")))))
                .doesNotThrowAnyException();
    }

    @Test
    void exportHtmlCapsImageReadAttempts() throws Exception {
        AtomicInteger readAttempts = new AtomicInteger();
        DishwareInventoryPrintFormExporter exporter = new DishwareInventoryPrintFormExporter((publicUrl, maxBytes) -> {
            readAttempts.incrementAndGet();
            return Optional.empty();
        });
        List<DishwareInventoryPrintForm.Item> items = IntStream.rangeClosed(1, 250)
                .mapToObj(index -> item(index, "Позиция " + index, "photo-" + index))
                .toList();

        exporter.exportHtml(printFormWithItems(items));

        assertThat(readAttempts).hasValue(200);
    }

    private static DishwareInventoryPrintForm printFormWithItems(List<DishwareInventoryPrintForm.Item> items) {
        return new DishwareInventoryPrintForm(
                "inventory.xlsx",
                "Инвентаризация",
                LocalDate.of(2026, 5, 16),
                DishwareInventoryStatus.DRAFT,
                items
        );
    }

    private static DishwareInventoryPrintForm.Item item(int id, String name, String photoUrl) {
        return new DishwareInventoryPrintForm.Item((long) id, name, 1, 2, photoUrl);
    }
}

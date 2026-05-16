package ru.staffly.inventory.service;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.ClientAnchor;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.Drawing;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.PrintSetup;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import ru.staffly.inventory.model.DishwareInventoryStatus;
import ru.staffly.media.DishwareInventoryImageStorage;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Iterator;
import java.util.Optional;

@Component
public class DishwareInventoryPrintFormExporter {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private static final String[] HEADERS = {"Фото", "Название", "Было", "Приход", "Ожидалось", "Факт", "Заметка"};

    private static final int ROW_ACCESS_WINDOW_SIZE = 50;
    private static final long MAX_SOURCE_IMAGE_BYTES = 2L * 1024 * 1024;
    private static final long MAX_SOURCE_PIXELS = 12_000_000L;
    private static final int MAX_THUMBNAIL_DIMENSION = 96;
    private static final int MAX_THUMBNAIL_BYTES = 64 * 1024;
    private static final int MAX_PRINT_IMAGE_ATTEMPTS = 200;
    private static final long MAX_TOTAL_SOURCE_IMAGE_BYTES = 64L * 1024 * 1024;
    private static final int MAX_TOTAL_IMAGE_BYTES = 12 * 1024 * 1024;
    private static final float[] JPEG_QUALITY_ATTEMPTS = {0.78f, 0.68f, 0.56f};

    static {
        System.setProperty("java.awt.headless", "true");
    }

    private final StoredImageReader imageReader;

    @Autowired
    public DishwareInventoryPrintFormExporter(DishwareInventoryImageStorage imageStorage) {
        this(imageStorage::readByPublicUrl);
    }

    DishwareInventoryPrintFormExporter(StoredImageReader imageReader) {
        this.imageReader = imageReader;
    }

    public byte[] export(DishwareInventoryPrintForm printForm) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            write(printForm, out);
            return out.toByteArray();
        }
    }

    public byte[] exportHtml(DishwareInventoryPrintForm printForm) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            writeHtml(printForm, out);
            return out.toByteArray();
        }
    }

    public void write(DishwareInventoryPrintForm printForm, OutputStream outputStream) throws IOException {
        try (SXSSFWorkbook workbook = new SXSSFWorkbook(ROW_ACCESS_WINDOW_SIZE)) {
            workbook.setCompressTempFiles(true);
            Sheet sheet = workbook.createSheet("Бланк посуды");
            configureSheet(sheet);

            Styles styles = createStyles(workbook);
            createTitleRows(sheet, printForm, styles);
            createHeaderRow(sheet, styles);
            createItemRows(workbook, sheet, printForm, styles);

            workbook.write(outputStream);
            outputStream.flush();
            workbook.dispose();
        }
    }

    public void writeHtml(DishwareInventoryPrintForm printForm, OutputStream outputStream) throws IOException {
        Writer writer = new OutputStreamWriter(outputStream, StandardCharsets.UTF_8);
        ImageBudget imageBudget = new ImageBudget(
                MAX_TOTAL_IMAGE_BYTES,
                MAX_TOTAL_SOURCE_IMAGE_BYTES,
                MAX_PRINT_IMAGE_ATTEMPTS
        );

        writer.write("""
                <!doctype html>
                <html lang="ru">
                  <head>
                    <meta charset="utf-8" />
                    <title>""");
        writer.write(escapeHtml(printForm.title()));
        writer.write("""
                 - бланк посуды</title>
                    <style>
                      @page {
                        size: A4 portrait;
                        margin: 7mm;
                      }

                      * {
                        box-sizing: border-box;
                      }

                      body {
                        margin: 0;
                        color: #111827;
                        background: #ffffff;
                        font-family: Arial, sans-serif;
                        font-size: 10px;
                      }

                      .toolbar {
                        display: flex;
                        justify-content: flex-end;
                        gap: 8px;
                        padding: 12px;
                        border-bottom: 1px solid #e5e7eb;
                        background: #f9fafb;
                      }

                      .toolbar button {
                        min-height: 36px;
                        border: 1px solid #d1d5db;
                        border-radius: 8px;
                        background: #ffffff;
                        color: #111827;
                        padding: 0 12px;
                        font: inherit;
                        cursor: pointer;
                      }

                      .sheet {
                        padding: 8px;
                      }

                      h1 {
                        margin: 0;
                        font-size: 15px;
                        line-height: 1.25;
                      }

                      .meta {
                        margin-top: 4px;
                        color: #4b5563;
                        font-size: 10px;
                      }

                      table {
                        width: 100%;
                        margin-top: 8px;
                        border-collapse: collapse;
                        table-layout: fixed;
                      }

                      thead {
                        display: table-header-group;
                      }

                      th,
                      td {
                        border: 1px solid #111827;
                        padding: 3px;
                        vertical-align: middle;
                      }

                      th {
                        background: #e5e7eb;
                        text-align: center;
                        font-weight: 700;
                      }

                      td {
                        height: 34px;
                      }

                      .photo {
                        width: 42px;
                        text-align: center;
                      }

                      .photo img {
                        max-width: 34px;
                        max-height: 30px;
                        object-fit: contain;
                      }

                      .name {
                        width: 30%;
                        overflow-wrap: anywhere;
                      }

                      .number {
                        width: 40px;
                        text-align: center;
                        font-variant-numeric: tabular-nums;
                      }

                      .manual {
                        width: 48px;
                        background: #fff7cc;
                      }

                      .note {
                        width: 18%;
                        background: #ffffff;
                      }

                      @media print {
                        .toolbar {
                          display: none;
                        }

                        .sheet {
                          padding: 0;
                        }

                        body {
                          print-color-adjust: exact;
                          -webkit-print-color-adjust: exact;
                        }
                      }
                    </style>
                  </head>
                  <body>
                    <div class="toolbar">
                      <button type="button" onclick="window.print()">Распечатать</button>
                      <button type="button" onclick="window.close()">Закрыть</button>
                    </div>
                    <main class="sheet">
                      <h1>""");
        writer.write(escapeHtml(printForm.title()));
        writer.write("</h1>\n      <div class=\"meta\">Дата: ");
        writer.write(escapeHtml(DATE_FORMATTER.format(printForm.inventoryDate())));
        writer.write(" · Статус: ");
        writer.write(escapeHtml(statusLabel(printForm)));
        writer.write("""
                </div>
                      <table>
                        <thead>
                          <tr>
                            <th>Фото</th>
                            <th>Название</th>
                            <th>Было</th>
                            <th>Приход</th>
                            <th>Ожидалось</th>
                            <th>Факт</th>
                            <th>Заметка</th>
                          </tr>
                        </thead>
                        <tbody>
                """);

        for (DishwareInventoryPrintForm.Item item : printForm.items()) {
            writeHtmlRow(writer, item, imageBudget);
        }

        writer.write("""
                        </tbody>
                      </table>
                    </main>
                    <script>
                      window.addEventListener("load", () => {
                        window.setTimeout(() => window.print(), 350);
                      });
                    </script>
                  </body>
                </html>
                """);
        writer.flush();
        outputStream.flush();
    }

    private void configureSheet(Sheet sheet) {
        sheet.setColumnWidth(0, 7 * 256);
        sheet.setColumnWidth(1, 24 * 256);
        sheet.setColumnWidth(2, 7 * 256);
        sheet.setColumnWidth(3, 7 * 256);
        sheet.setColumnWidth(4, 8 * 256);
        sheet.setColumnWidth(5, 9 * 256);
        sheet.setColumnWidth(6, 18 * 256);
        sheet.createFreezePane(0, 4);
        sheet.setRepeatingRows(CellRangeAddress.valueOf("4:4"));
        sheet.setAutobreaks(true);
        sheet.setFitToPage(true);
        sheet.setMargin(Sheet.LeftMargin, 0.25);
        sheet.setMargin(Sheet.RightMargin, 0.25);
        sheet.setMargin(Sheet.TopMargin, 0.35);
        sheet.setMargin(Sheet.BottomMargin, 0.35);

        PrintSetup printSetup = sheet.getPrintSetup();
        printSetup.setLandscape(false);
        printSetup.setPaperSize(PrintSetup.A4_PAPERSIZE);
        printSetup.setFitWidth((short) 1);
        printSetup.setFitHeight((short) 0);
    }

    private void createTitleRows(Sheet sheet, DishwareInventoryPrintForm printForm, Styles styles) {
        Row titleRow = sheet.createRow(0);
        titleRow.setHeightInPoints(20);
        Cell titleCell = titleRow.createCell(0);
        titleCell.setCellValue(printForm.title());
        titleCell.setCellStyle(styles.title());
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, HEADERS.length - 1));

        Row metaRow = sheet.createRow(1);
        metaRow.setHeightInPoints(16);
        Cell metaCell = metaRow.createCell(0);
        metaCell.setCellValue("Дата: " + DATE_FORMATTER.format(printForm.inventoryDate()) + " · Статус: " + statusLabel(printForm));
        metaCell.setCellStyle(styles.meta());
        sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, HEADERS.length - 1));
    }

    private void createHeaderRow(Sheet sheet, Styles styles) {
        Row headerRow = sheet.createRow(3);
        headerRow.setHeightInPoints(18);
        for (int index = 0; index < HEADERS.length; index++) {
            Cell cell = headerRow.createCell(index);
            cell.setCellValue(HEADERS[index]);
            cell.setCellStyle(styles.header());
        }
    }

    private void createItemRows(SXSSFWorkbook workbook, Sheet sheet, DishwareInventoryPrintForm printForm, Styles styles) {
        Drawing<?> drawing = sheet.createDrawingPatriarch();
        CreationHelper helper = workbook.getCreationHelper();
        ImageBudget imageBudget = new ImageBudget(
                MAX_TOTAL_IMAGE_BYTES,
                MAX_TOTAL_SOURCE_IMAGE_BYTES,
                MAX_PRINT_IMAGE_ATTEMPTS
        );

        for (int index = 0; index < printForm.items().size(); index++) {
            DishwareInventoryPrintForm.Item item = printForm.items().get(index);
            int rowIndex = index + 4;
            Row row = sheet.createRow(rowIndex);
            row.setHeightInPoints(32);

            createTextCell(row, 0, "", styles.photo());
            createTextCell(row, 1, item.name(), styles.text());
            createNumberCell(row, 2, item.previousQty(), styles.integer());
            createNumberCell(row, 3, item.incomingQty(), styles.integer());
            createNumberCell(row, 4, (long) item.previousQty() + item.incomingQty(), styles.integer());
            createTextCell(row, 5, "", styles.fact());
            createTextCell(row, 6, "", styles.note());

            if (imageBudget.hasRemainingOutputCapacity()) {
                addImage(workbook, sheet, drawing, helper, item, rowIndex, imageBudget);
            }
        }
    }

    private void createTextCell(Row row, int column, String value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
        cell.setCellStyle(style);
    }

    private void createNumberCell(Row row, int column, long value, CellStyle style) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value);
        cell.setCellStyle(style);
    }

    private void addImage(
            SXSSFWorkbook workbook,
            Sheet sheet,
            Drawing<?> drawing,
            CreationHelper helper,
            DishwareInventoryPrintForm.Item item,
            int rowIndex,
            ImageBudget imageBudget
    ) {
        if (item.photoUrl() == null || item.photoUrl().isBlank()) {
            return;
        }

        Optional<PreparedImage> preparedImage = prepareImage(item.photoUrl(), imageBudget);
        if (preparedImage.isEmpty() || !imageBudget.reserveOutputBytes(preparedImage.get().bytes().length)) {
            return;
        }

        int pictureIndex = workbook.addPicture(preparedImage.get().bytes(), Workbook.PICTURE_TYPE_JPEG);
        ClientAnchor anchor = helper.createClientAnchor();
        anchor.setCol1(0);
        anchor.setRow1(rowIndex);
        anchor.setCol2(1);
        anchor.setRow2(rowIndex + 1);
        drawing.createPicture(anchor, pictureIndex);
        sheet.getRow(rowIndex).getCell(0).setCellValue("");
    }

    private void writeHtmlRow(Writer writer, DishwareInventoryPrintForm.Item item, ImageBudget imageBudget) throws IOException {
        long expectedQty = (long) item.previousQty() + item.incomingQty();
        writer.write("          <tr>\n            <td class=\"photo\">");
        writeHtmlPhoto(writer, item, imageBudget);
        writer.write("</td>\n            <td class=\"name\">");
        writer.write(escapeHtml(item.name()));
        writer.write("</td>\n            <td class=\"number\">");
        writer.write(String.valueOf(item.previousQty()));
        writer.write("</td>\n            <td class=\"number\">");
        writer.write(String.valueOf(item.incomingQty()));
        writer.write("</td>\n            <td class=\"number\">");
        writer.write(String.valueOf(expectedQty));
        writer.write("""
                </td>
                            <td class="manual"></td>
                            <td class="manual note"></td>
                          </tr>
                """);
    }

    private void writeHtmlPhoto(Writer writer, DishwareInventoryPrintForm.Item item, ImageBudget imageBudget) throws IOException {
        if (item.photoUrl() == null || item.photoUrl().isBlank()) {
            return;
        }
        if (!imageBudget.hasRemainingOutputCapacity()) {
            return;
        }

        Optional<PreparedImage> preparedImage = prepareImage(item.photoUrl(), imageBudget);
        if (preparedImage.isEmpty() || !imageBudget.reserveOutputBytes(preparedImage.get().bytes().length)) {
            return;
        }

        writer.write("<img src=\"data:image/jpeg;base64,");
        writer.write(Base64.getEncoder().encodeToString(preparedImage.get().bytes()));
        writer.write("\" alt=\"");
        writer.write(escapeHtml(item.name()));
        writer.write("\" />");
    }

    private Optional<PreparedImage> prepareImage(String photoUrl, ImageBudget imageBudget) {
        if (!imageBudget.tryStartImageAttempt()) {
            return Optional.empty();
        }

        long maxSourceImageBytes = imageBudget.nextSourceImageMaxBytes();
        if (maxSourceImageBytes <= 0) {
            return Optional.empty();
        }

        try {
            Optional<DishwareInventoryImageStorage.StoredImage> storedImage = imageReader.read(photoUrl, maxSourceImageBytes);
            if (storedImage.isEmpty()) {
                return Optional.empty();
            }

            byte[] sourceBytes = storedImage.get().bytes();
            if (sourceBytes == null || !imageBudget.reserveSourceBytes(sourceBytes.length)) {
                return Optional.empty();
            }

            Optional<BufferedImage> source = readImage(sourceBytes);
            if (source.isEmpty()) {
                return Optional.empty();
            }

            BufferedImage thumbnail = resizeForPrint(source.get());
            for (float quality : JPEG_QUALITY_ATTEMPTS) {
                byte[] bytes = encodeJpeg(thumbnail, quality);
                if (bytes.length <= MAX_THUMBNAIL_BYTES) {
                    return Optional.of(new PreparedImage(bytes));
                }
            }
        } catch (IOException | RuntimeException ignored) {
            return Optional.empty();
        }
        return Optional.empty();
    }

    private Optional<BufferedImage> readImage(byte[] bytes) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            if (input == null) {
                return Optional.empty();
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                return Optional.empty();
            }

            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_SOURCE_PIXELS) {
                    return Optional.empty();
                }

                ImageReadParam readParam = reader.getDefaultReadParam();
                return Optional.ofNullable(reader.read(0, readParam));
            } finally {
                reader.dispose();
            }
        }
    }

    private BufferedImage resizeForPrint(BufferedImage source) {
        int sourceWidth = Math.max(1, source.getWidth());
        int sourceHeight = Math.max(1, source.getHeight());
        double ratio = Math.min(
                1.0,
                (double) MAX_THUMBNAIL_DIMENSION / Math.max(sourceWidth, sourceHeight)
        );
        int targetWidth = Math.max(1, (int) Math.round(sourceWidth * ratio));
        int targetHeight = Math.max(1, (int) Math.round(sourceHeight * ratio));

        BufferedImage target = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, targetWidth, targetHeight);
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private byte[] encodeJpeg(BufferedImage image, float quality) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new IOException("JPEG writer is not available");
        }

        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             MemoryCacheImageOutputStream imageOutput = new MemoryCacheImageOutputStream(out)) {
            ImageWriteParam writeParam = writer.getDefaultWriteParam();
            if (writeParam.canWriteCompressed()) {
                writeParam.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                writeParam.setCompressionQuality(quality);
            }
            writer.setOutput(imageOutput);
            writer.write(null, new IIOImage(image, null, null), writeParam);
            imageOutput.flush();
            return out.toByteArray();
        } finally {
            writer.dispose();
        }
    }

    private Styles createStyles(Workbook workbook) {
        Font titleFont = workbook.createFont();
        titleFont.setBold(true);
        titleFont.setFontHeightInPoints((short) 13);

        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerFont.setFontHeightInPoints((short) 9);

        Font bodyFont = workbook.createFont();
        bodyFont.setFontHeightInPoints((short) 9);

        CellStyle title = workbook.createCellStyle();
        title.setFont(titleFont);
        title.setAlignment(HorizontalAlignment.LEFT);
        title.setVerticalAlignment(VerticalAlignment.CENTER);

        CellStyle meta = workbook.createCellStyle();
        meta.setFont(bodyFont);
        meta.setVerticalAlignment(VerticalAlignment.CENTER);
        meta.setWrapText(true);

        CellStyle header = borderedStyle(workbook);
        header.setFont(headerFont);
        header.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        header.setAlignment(HorizontalAlignment.CENTER);
        header.setVerticalAlignment(VerticalAlignment.CENTER);

        CellStyle photo = borderedStyle(workbook);
        photo.setFont(bodyFont);
        photo.setAlignment(HorizontalAlignment.CENTER);
        photo.setVerticalAlignment(VerticalAlignment.CENTER);

        CellStyle text = borderedStyle(workbook);
        text.setFont(bodyFont);
        text.setVerticalAlignment(VerticalAlignment.CENTER);
        text.setWrapText(true);

        CellStyle integer = borderedStyle(workbook);
        integer.setFont(bodyFont);
        integer.setAlignment(HorizontalAlignment.CENTER);
        integer.setVerticalAlignment(VerticalAlignment.CENTER);
        integer.setDataFormat(workbook.createDataFormat().getFormat("0"));

        CellStyle fact = borderedStyle(workbook);
        fact.setFont(bodyFont);
        fact.setFillForegroundColor(IndexedColors.LEMON_CHIFFON.getIndex());
        fact.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        fact.setAlignment(HorizontalAlignment.CENTER);
        fact.setVerticalAlignment(VerticalAlignment.CENTER);

        CellStyle note = borderedStyle(workbook);
        note.setFont(bodyFont);
        note.setVerticalAlignment(VerticalAlignment.CENTER);
        note.setWrapText(true);

        return new Styles(title, meta, header, photo, text, integer, fact, note);
    }

    private CellStyle borderedStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setTopBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        style.setRightBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        style.setBottomBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        style.setLeftBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        return style;
    }

    private String statusLabel(DishwareInventoryPrintForm printForm) {
        return printForm.status() == DishwareInventoryStatus.COMPLETED ? "Завершена" : "Черновик";
    }

    private String escapeHtml(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }

        StringBuilder escaped = new StringBuilder(value.length());
        for (int index = 0; index < value.length(); index++) {
            char ch = value.charAt(index);
            switch (ch) {
                case '&' -> escaped.append("&amp;");
                case '<' -> escaped.append("&lt;");
                case '>' -> escaped.append("&gt;");
                case '"' -> escaped.append("&quot;");
                case '\'' -> escaped.append("&#39;");
                default -> escaped.append(ch);
            }
        }
        return escaped.toString();
    }

    private record PreparedImage(byte[] bytes) {
    }

    private record Styles(
            CellStyle title,
            CellStyle meta,
            CellStyle header,
            CellStyle photo,
            CellStyle text,
            CellStyle integer,
            CellStyle fact,
            CellStyle note
    ) {
    }

    private static final class ImageBudget {
        private final int maxOutputBytes;
        private final long maxSourceBytes;
        private final int maxImageAttempts;
        private int usedOutputBytes;
        private long usedSourceBytes;
        private int imageAttempts;

        private ImageBudget(int maxOutputBytes, long maxSourceBytes, int maxImageAttempts) {
            this.maxOutputBytes = maxOutputBytes;
            this.maxSourceBytes = maxSourceBytes;
            this.maxImageAttempts = maxImageAttempts;
        }

        private boolean tryStartImageAttempt() {
            if (imageAttempts >= maxImageAttempts || !hasRemainingOutputCapacity() || nextSourceImageMaxBytes() <= 0) {
                return false;
            }
            imageAttempts++;
            return true;
        }

        private long nextSourceImageMaxBytes() {
            return Math.min(MAX_SOURCE_IMAGE_BYTES, Math.max(0L, maxSourceBytes - usedSourceBytes));
        }

        private boolean reserveSourceBytes(long bytes) {
            if (bytes <= 0 || usedSourceBytes + bytes > maxSourceBytes) {
                return false;
            }
            usedSourceBytes += bytes;
            return true;
        }

        private boolean reserveOutputBytes(int bytes) {
            if (bytes <= 0 || usedOutputBytes + bytes > maxOutputBytes) {
                return false;
            }
            usedOutputBytes += bytes;
            return true;
        }

        private boolean hasRemainingOutputCapacity() {
            return usedOutputBytes < maxOutputBytes;
        }
    }

    @FunctionalInterface
    interface StoredImageReader {
        Optional<DishwareInventoryImageStorage.StoredImage> read(String publicUrl, long maxBytes);
    }
}

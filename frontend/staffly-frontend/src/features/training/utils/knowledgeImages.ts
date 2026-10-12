import { createCanvas, loadImage, toBlob } from "../../../shared/lib/imageCrop/canvasExport";
import type { PixelCrop } from "../../../shared/lib/imageCrop/types";

export const KNOWLEDGE_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
const ORIGINAL_MAX_BYTES = 1024 * 1024;
const PREVIEW_MAX_BYTES = 256 * 1024;

async function encodeImage(
  image: HTMLImageElement,
  crop: PixelCrop,
  width: number,
  height: number,
  mimeType: string,
  maxBytes: number,
  name: string,
): Promise<File> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const scale = Math.pow(0.8, Math.floor(attempt / 3));
    const canvas = createCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Не удалось обработать фото: Canvas недоступен.");
    if (mimeType === "image/jpeg") {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    const blob = await toBlob(canvas, mimeType, 0.84 - (attempt % 3) * 0.1);
    if (blob.size <= maxBytes) {
      const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
      return new File([blob], `${name}.${extension}`, { type: blob.type });
    }
  }
  throw new Error("Не удалось уменьшить фото. Попробуйте другое изображение.");
}

export async function prepareKnowledgeImages({
  imageSrc,
  crop,
  mimeType,
}: {
  imageSrc: string;
  crop: PixelCrop;
  mimeType: string;
}): Promise<{ file: File; originalFile: File; previewUrl: string }> {
  const image = await loadImage(imageSrc);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height || width * height > 40_000_000) {
    throw new Error("Фото слишком большое. Выберите изображение до 40 мегапикселей.");
  }
  const scale = Math.min(1, 2048 / Math.max(width, height));
  // Process sequentially to avoid allocating two large canvases at once on mobile devices.
  const originalFile = await encodeImage(
    image,
    { x: 0, y: 0, width, height },
    Math.round(width * scale),
    Math.round(height * scale),
    mimeType,
    ORIGINAL_MAX_BYTES,
    "photo-full",
  );
  const file = await encodeImage(image, crop, 800, 500, mimeType, PREVIEW_MAX_BYTES, "photo-preview");
  return { file, originalFile, previewUrl: URL.createObjectURL(file) };
}

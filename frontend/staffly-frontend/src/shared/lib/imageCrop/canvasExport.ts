import type { ExportOptions, PixelCrop } from "./types";

export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось загрузить изображение"));
    image.src = src;
  });

export const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const toBlob = (canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Не удалось подготовить изображение"));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });

const extensionByMimeType: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export async function exportCroppedImageToFile({
  imageSrc,
  crop,
  exportOptions,
}: {
  imageSrc: string;
  crop: PixelCrop;
  exportOptions: ExportOptions;
}): Promise<{ file: File; previewUrl: string }> {
  const image = await loadImage(imageSrc);
  const canvas = createCanvas(exportOptions.outputWidth, exportOptions.outputHeight);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas недоступен");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    exportOptions.outputWidth,
    exportOptions.outputHeight,
  );

  const quality = exportOptions.mimeType === "image/png" ? undefined : exportOptions.quality;
  const blob = await toBlob(canvas, exportOptions.mimeType, quality);
  const extension = extensionByMimeType[exportOptions.mimeType] ?? "bin";
  const safeBaseName = (exportOptions.baseFileName ?? "image").replace(/\.[^.]+$/, "") || "image";

  return {
    file: new File([blob], `${safeBaseName}.${extension}`, { type: exportOptions.mimeType }),
    previewUrl: URL.createObjectURL(blob),
  };
}

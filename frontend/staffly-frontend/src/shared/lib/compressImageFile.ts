const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_TARGET_BYTES = 1.5 * 1024 * 1024;

const extensionByMimeType: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Не удалось прочитать изображение"));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
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
}

async function supportsWebpExport(): Promise<boolean> {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const blob = await canvasToBlob(canvas, "image/webp", 0.8).catch(() => null);
  return blob?.type === "image/webp";
}

export async function compressImageFile(
  file: File,
  {
    maxDimension = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_QUALITY,
    targetBytes = DEFAULT_TARGET_BYTES,
  }: {
    maxDimension?: number;
    quality?: number;
    targetBytes?: number;
  } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const image = await loadImageFromFile(file);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const mimeType = (await supportsWebpExport()) ? "image/webp" : file.type === "image/png" ? "image/png" : "image/jpeg";
  let currentQuality = mimeType === "image/png" ? undefined : quality;
  let blob = await canvasToBlob(canvas, mimeType, currentQuality);

  while (blob.size > targetBytes && currentQuality && currentQuality > 0.58) {
    currentQuality -= 0.08;
    blob = await canvasToBlob(canvas, mimeType, currentQuality);
  }

  if (blob.size > file.size && file.size <= targetBytes) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "checklist-photo";
  const extension = extensionByMimeType[mimeType] ?? "bin";
  return new File([blob], `${baseName}.${extension}`, { type: mimeType });
}

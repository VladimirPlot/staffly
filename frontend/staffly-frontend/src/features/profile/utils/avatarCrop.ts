export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const AVATAR_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;

export function isAvatarMimeType(mimeType?: string | null): boolean {
  if (!mimeType) return false;
  return AVATAR_MIME_TYPES.includes(mimeType.toLowerCase() as (typeof AVATAR_MIME_TYPES)[number]);
}

const createCanvas = (size: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось загрузить изображение"));
    image.src = src;
  });

const supportsWebp = (): boolean => {
  try {
    const canvas = document.createElement("canvas");
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
};

const toBlob = (canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> =>
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

type GetCroppedAvatarFileInput = {
  imageSrc: string;
  croppedAreaPixels: PixelCrop;
  outputSize?: number;
  quality?: number;
  baseFileName?: string;
};

export async function getCroppedAvatarFile({
  imageSrc,
  croppedAreaPixels,
  outputSize = 512,
  quality = 0.92,
  baseFileName = "avatar",
}: GetCroppedAvatarFileInput): Promise<{ file: File; previewUrl: string }> {
  const image = await loadImage(imageSrc);
  const canvas = createCanvas(outputSize);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas недоступен");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  const mimeType = supportsWebp() ? "image/webp" : "image/png";
  const extension = mimeType === "image/webp" ? "webp" : "png";
  const blob = await toBlob(canvas, mimeType, mimeType === "image/webp" ? quality : undefined);

  return {
    file: new File([blob], `${baseFileName.replace(/\.[^.]+$/, "") || "avatar"}.${extension}`, { type: mimeType }),
    previewUrl: URL.createObjectURL(blob),
  };
}

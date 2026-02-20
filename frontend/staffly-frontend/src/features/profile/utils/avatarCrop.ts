import { exportCroppedImageToFile } from "../../../shared/lib/imageCrop/canvasExport";
import { AVATAR_ALLOWED_MIME_TYPES, isAllowedMimeType, pickOutputMimeType, supportsWebp } from "../../../shared/lib/imageCrop/mime";
import type { PixelCrop } from "../../../shared/lib/imageCrop/types";

export type { PixelCrop } from "../../../shared/lib/imageCrop/types";

export function isAvatarMimeType(mimeType?: string | null): boolean {
  return isAllowedMimeType(mimeType, AVATAR_ALLOWED_MIME_TYPES);
}

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
  const mimeType = pickOutputMimeType({
    supportsWebp: supportsWebp(),
    backendAllowsWebp: true,
    fallback: "image/png",
  });

  return exportCroppedImageToFile({
    imageSrc,
    crop: croppedAreaPixels,
    exportOptions: {
      outputWidth: outputSize,
      outputHeight: outputSize,
      mimeType,
      quality,
      baseFileName,
    },
  });
}

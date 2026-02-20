import type { PixelCrop } from "./types";

export function computeBaseScale(frameW: number, frameH: number, naturalW: number, naturalH: number): number {
  if (!naturalW || !naturalH) return 1;
  return Math.max(frameW / naturalW, frameH / naturalH);
}

export function computeMaxOffsets({
  naturalW,
  naturalH,
  scale,
  frameW,
  frameH,
}: {
  naturalW: number;
  naturalH: number;
  scale: number;
  frameW: number;
  frameH: number;
}): { x: number; y: number } {
  const scaledWidth = naturalW * scale;
  const scaledHeight = naturalH * scale;
  return {
    x: Math.max(0, (scaledWidth - frameW) / 2),
    y: Math.max(0, (scaledHeight - frameH) / 2),
  };
}

export function clampCrop(crop: { x: number; y: number }, maxOffsets: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.min(maxOffsets.x, Math.max(-maxOffsets.x, crop.x)),
    y: Math.min(maxOffsets.y, Math.max(-maxOffsets.y, crop.y)),
  };
}

export function computeCroppedAreaPixels({
  frameW,
  frameH,
  naturalW,
  naturalH,
  effectiveScale,
  crop,
}: {
  frameW: number;
  frameH: number;
  naturalW: number;
  naturalH: number;
  effectiveScale: number;
  crop: { x: number; y: number };
}): PixelCrop {
  const cropWidth = frameW / effectiveScale;
  const cropHeight = frameH / effectiveScale;
  const centeredX = (naturalW - cropWidth) / 2;
  const centeredY = (naturalH - cropHeight) / 2;
  const x = centeredX - crop.x / effectiveScale;
  const y = centeredY - crop.y / effectiveScale;

  return {
    x: Math.max(0, Math.min(naturalW - cropWidth, x)),
    y: Math.max(0, Math.min(naturalH - cropHeight, y)),
    width: cropWidth,
    height: cropHeight,
  };
}

export type PixelCrop = { x: number; y: number; width: number; height: number };

export type CropShape = "circle" | "roundedRect" | "rect" | "square";

export type CropFrame = {
  /** размер рамки внутри модалки, в px */
  frameWidth: number;
  frameHeight: number;
  /** визуальное скругление рамки (для roundedRect) */
  borderRadius?: number;
  shape: CropShape;
};

export type ExportOptions = {
  outputWidth: number;
  outputHeight: number;
  /** "image/webp" | "image/jpeg" | "image/png" */
  mimeType: string;
  quality?: number;
  baseFileName?: string;
};

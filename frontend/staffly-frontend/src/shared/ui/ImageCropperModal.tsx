import React from "react";
import Modal from "./Modal";
import Button from "./Button";
import type { CropFrame, PixelCrop } from "../lib/imageCrop/types";
import {
  clampCrop,
  computeBaseScale,
  computeCroppedAreaPixels,
  computeMaxOffsets,
} from "../lib/imageCrop/cropMath";

type ImageCropperModalProps = {
  open: boolean;
  title?: string;
  description?: React.ReactNode;
  imageUrl: string | null;
  frame: CropFrame;
  maxZoom?: number;
  zoomStep?: number;
  onCancel: () => void;
  onConfirm: (payload: { croppedAreaPixels: PixelCrop }) => void;
  busy?: boolean;
};

export default function ImageCropperModal({
  open,
  title,
  description,
  imageUrl,
  frame,
  maxZoom = 3,
  zoomStep = 0.05,
  onCancel,
  onConfirm,
  busy = false,
}: ImageCropperModalProps) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [imageNaturalSize, setImageNaturalSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    React.useState<PixelCrop | null>(null);

  const dragStateRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // ✅ Сбрасываем состояние при открытии и/или смене картинки
  React.useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setImageNaturalSize(null);
    setCroppedAreaPixels(null);
    dragStateRef.current = null;
  }, [open, imageUrl]);

  React.useEffect(() => {
    if (!open) dragStateRef.current = null;
  }, [open]);

  const baseScale = React.useMemo(() => {
    if (!imageNaturalSize) return 1;
    return computeBaseScale(
      frame.frameWidth,
      frame.frameHeight,
      imageNaturalSize.width,
      imageNaturalSize.height,
    );
  }, [frame.frameHeight, frame.frameWidth, imageNaturalSize]);

  const effectiveScale = baseScale * zoom;

  const maxOffsets = React.useMemo(() => {
    if (!imageNaturalSize) return { x: 0, y: 0 };
    return computeMaxOffsets({
      naturalW: imageNaturalSize.width,
      naturalH: imageNaturalSize.height,
      scale: effectiveScale,
      frameW: frame.frameWidth,
      frameH: frame.frameHeight,
    });
  }, [effectiveScale, frame.frameHeight, frame.frameWidth, imageNaturalSize]);

  const clampByFrame = React.useCallback(
    (nextCrop: { x: number; y: number }) => clampCrop(nextCrop, maxOffsets),
    [maxOffsets],
  );

  React.useEffect(() => {
    setCrop((prev) => clampByFrame(prev));
  }, [clampByFrame]);

  React.useEffect(() => {
    if (!imageNaturalSize) {
      setCroppedAreaPixels(null);
      return;
    }

    setCroppedAreaPixels(
      computeCroppedAreaPixels({
        frameW: frame.frameWidth,
        frameH: frame.frameHeight,
        naturalW: imageNaturalSize.width,
        naturalH: imageNaturalSize.height,
        effectiveScale,
        crop,
      }),
    );
  }, [crop, effectiveScale, frame.frameHeight, frame.frameWidth, imageNaturalSize]);

  const updateZoom = React.useCallback(
    (nextZoom: number) => {
      setZoom(Math.min(maxZoom, Math.max(1, nextZoom)));
    },
    [maxZoom],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (busy || !imageNaturalSize) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: crop.x,
      originY: crop.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (busy) return;

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const nextCrop = {
      x: dragState.originX + (event.clientX - dragState.startX),
      y: dragState.originY + (event.clientY - dragState.startY),
    };

    setCrop(clampByFrame(nextCrop));
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const frameClassName =
    frame.shape === "circle"
      ? "rounded-full"
      : frame.shape === "roundedRect"
        ? "rounded-[var(--crop-frame-radius)]"
        : "rounded-none";

  const overlayColorClass = "bg-black/45";
  const hasImage = Boolean(imageUrl);

  // CSS vars для “обводки” и затемнения вокруг рамки
  const varsStyle = {
    ["--crop-frame-w" as string]: `${frame.frameWidth}px`,
    ["--crop-frame-h" as string]: `${frame.frameHeight}px`,
    ["--crop-frame-radius" as string]: `${frame.borderRadius ?? 0}px`,
  } as React.CSSProperties;

  const circleOverlayStyle: React.CSSProperties = {
    ...varsStyle,
    // “дырка” по центру: прозрачная внутри, затемнение снаружи
    WebkitMaskImage:
      "radial-gradient(circle at center, transparent calc(var(--crop-frame-w) / 2), black calc(var(--crop-frame-w) / 2 + 1px))",
    maskImage:
      "radial-gradient(circle at center, transparent calc(var(--crop-frame-w) / 2), black calc(var(--crop-frame-w) / 2 + 1px))",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  };

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={() => {
        if (!busy) onCancel();
      }}
      className="max-w-lg"
      footer={
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={onCancel}
          >
            Отмена
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={busy || !croppedAreaPixels}
            onClick={() =>
              croppedAreaPixels && onConfirm({ croppedAreaPixels })
            }
          >
            {busy ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          className="relative mx-auto h-[min(70vw,360px)] w-[min(70vw,360px)] max-h-[360px] max-w-[360px]
                     select-none overflow-hidden rounded-2xl bg-black/70
                     touch-none overscroll-contain"
          style={varsStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {hasImage && (
            <>
              <img
                src={imageUrl!}
                alt="Предпросмотр"
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: imageNaturalSize ? `${imageNaturalSize.width}px` : "auto",
                  height: imageNaturalSize ? `${imageNaturalSize.height}px` : "auto",
                  transform: `translate(-50%, -50%) translate(${crop.x}px, ${crop.y}px) scale(${effectiveScale})`,
                  transformOrigin: "center center",
                }}
                onLoad={(event) => {
                  const img = event.currentTarget;
                  setImageNaturalSize({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }}
              />

              {/* ✅ Затемнение ТОЛЬКО ВНЕ рамки */}
              {frame.shape === "circle" ? (
                <div
                  className={`pointer-events-none absolute inset-0 ${overlayColorClass}`}
                  style={circleOverlayStyle}
                />
              ) : (
                <>
                  {/* top */}
                  <div
                    className="pointer-events-none absolute left-0 top-0 w-full
                               bg-gradient-to-b from-black/55 to-black/35"
                    style={{ height: "calc(50% - (var(--crop-frame-h) / 2))" }}
                  />
                  {/* bottom */}
                  <div
                    className="pointer-events-none absolute left-0 bottom-0 w-full
                               bg-gradient-to-t from-black/55 to-black/35"
                    style={{ height: "calc(50% - (var(--crop-frame-h) / 2))" }}
                  />
                  {/* left */}
                  <div
                    className="pointer-events-none absolute
                               bg-gradient-to-r from-black/55 to-black/35"
                    style={{
                      top: "calc(50% - (var(--crop-frame-h) / 2))",
                      left: 0,
                      width: "calc(50% - (var(--crop-frame-w) / 2))",
                      height: "var(--crop-frame-h)",
                    }}
                  />
                  {/* right */}
                  <div
                    className="pointer-events-none absolute
                               bg-gradient-to-l from-black/55 to-black/35"
                    style={{
                      top: "calc(50% - (var(--crop-frame-h) / 2))",
                      right: 0,
                      width: "calc(50% - (var(--crop-frame-w) / 2))",
                      height: "var(--crop-frame-h)",
                    }}
                  />
                </>
              )}

              {/* Рамка */}
              <div
                className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border border-white/70 ${frameClassName}`}
                style={{
                  width: "var(--crop-frame-w)",
                  height: "var(--crop-frame-h)",
                  ["--crop-frame-radius" as string]: `${frame.borderRadius ?? 0}px`,
                }}
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => updateZoom(zoom - zoomStep)}
            disabled={busy || zoom <= 1}
          >
            –
          </Button>
          <input
            type="range"
            min={1}
            max={maxZoom}
            step={zoomStep}
            value={zoom}
            onChange={(event) => updateZoom(Number(event.target.value))}
            disabled={busy}
            className="h-2 w-full cursor-pointer accent-[var(--staffly-text-strong)]"
            aria-label="Масштаб изображения"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => updateZoom(zoom + zoomStep)}
            disabled={busy || zoom >= maxZoom}
          >
            +
          </Button>
        </div>
      </div>
    </Modal>
  );
}

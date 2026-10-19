import React from "react";
import Modal from "./Modal";
import Button from "./Button";
import type { CropFrame, PixelCrop } from "../lib/imageCrop/types";
import { clampCrop, computeBaseScale, computeCroppedAreaPixels, computeMaxOffsets } from "../lib/imageCrop/cropMath";

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
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<PixelCrop | null>(null);

  const viewportRef = React.useRef<HTMLDivElement>(null);
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const nativeGesture = React.useRef(false);
  const live = React.useRef({ crop, zoom, imageNaturalSize, busy });
  live.current = { crop, zoom, imageNaturalSize, busy };
  const [imageError, setImageError] = React.useState<string | null>(null);
  // ✅ Сбрасываем состояние при открытии и/или смене картинки
  React.useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setImageNaturalSize(null);
    setCroppedAreaPixels(null);
    pointers.current.clear();
    nativeGesture.current = false;
    setImageError(null);
  }, [open, imageUrl]);

  React.useEffect(() => {
    if (!open) {
      pointers.current.clear();
      nativeGesture.current = false;
    }
  }, [open]);

  const baseScale = React.useMemo(() => {
    if (!imageNaturalSize) return 1;
    return computeBaseScale(frame.frameWidth, frame.frameHeight, imageNaturalSize.width, imageNaturalSize.height);
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

  const zoomAt = React.useCallback(
    (nextZoom: number, anchor = { x: 0, y: 0 }, previousAnchor = anchor) => {
      const state = live.current;
      if (state.busy || !state.imageNaturalSize) return;
      const bounded = Math.min(maxZoom, Math.max(1, nextZoom));
      const ratio = bounded / state.zoom;
      const offsets = computeMaxOffsets({
        naturalW: state.imageNaturalSize.width,
        naturalH: state.imageNaturalSize.height,
        scale:
          computeBaseScale(
            frame.frameWidth,
            frame.frameHeight,
            state.imageNaturalSize.width,
            state.imageNaturalSize.height,
          ) * bounded,
        frameW: frame.frameWidth,
        frameH: frame.frameHeight,
      });
      const next = clampCrop(
        {
          x: anchor.x - (previousAnchor.x - state.crop.x) * ratio,
          y: anchor.y - (previousAnchor.y - state.crop.y) * ratio,
        },
        offsets,
      );
      live.current = { ...state, zoom: bounded, crop: next };
      setZoom(bounded);
      setCrop(next);
    },
    [frame.frameHeight, frame.frameWidth, maxZoom],
  );
  const point = (clientX: number, clientY: number) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };
  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!open || !viewport) return;
    const wheel = (event: WheelEvent) => {
      if (live.current.busy || !live.current.imageNaturalSize) return;
      event.preventDefault();
      if (nativeGesture.current) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      zoomAt(
        live.current.zoom * Math.exp(-Math.max(-200, Math.min(200, delta)) * (event.ctrlKey ? 0.01 : 0.002)),
        point(event.clientX, event.clientY),
      );
    };
    let nativeStart: { zoom: number; crop: { x: number; y: number }; anchor: { x: number; y: number } } | null = null;
    const gestureStart = (event: Event) => {
      if (live.current.busy || !live.current.imageNaturalSize) return;
      event.preventDefault();
      const gesture = event as Event & { clientX: number; clientY: number };
      nativeGesture.current = true;
      nativeStart = {
        zoom: live.current.zoom,
        crop: live.current.crop,
        anchor: Number.isFinite(gesture.clientX) ? point(gesture.clientX, gesture.clientY) : { x: 0, y: 0 },
      };
    };
    const gestureChange = (event: Event) => {
      if (!nativeStart) return;
      event.preventDefault();
      const gesture = event as Event & { scale: number; clientX: number; clientY: number };
      if (!Number.isFinite(gesture.scale) || gesture.scale <= 0) return;
      live.current = { ...live.current, zoom: nativeStart.zoom, crop: nativeStart.crop };
      zoomAt(
        nativeStart.zoom * gesture.scale,
        Number.isFinite(gesture.clientX) ? point(gesture.clientX, gesture.clientY) : nativeStart.anchor,
        nativeStart.anchor,
      );
    };
    const gestureEnd = (event: Event) => {
      if (nativeStart) event.preventDefault();
      nativeStart = null;
      nativeGesture.current = false;
    };
    viewport.addEventListener("wheel", wheel, { passive: false });
    viewport.addEventListener("gesturestart", gestureStart, { passive: false });
    viewport.addEventListener("gesturechange", gestureChange, { passive: false });
    viewport.addEventListener("gestureend", gestureEnd, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("gesturestart", gestureStart);
      viewport.removeEventListener("gesturechange", gestureChange);
      viewport.removeEventListener("gestureend", gestureEnd);
    };
  }, [open, zoomAt]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (busy || !imageNaturalSize || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointers.current.set(event.pointerId, point(event.clientX, event.clientY));
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (busy || !previous) return;
    const before = [...pointers.current.values()].slice(0, 2);
    const next = point(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, next);
    if (nativeGesture.current) return;
    if (pointers.current.size >= 2) {
      const after = [...pointers.current.values()].slice(0, 2);
      const oldDistance = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
      if (oldDistance)
        zoomAt(
          (live.current.zoom * Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y)) / oldDistance,
          { x: (after[0].x + after[1].x) / 2, y: (after[0].y + after[1].y) / 2 },
          { x: (before[0].x + before[1].x) / 2, y: (before[0].y + before[1].y) / 2 },
        );
    } else {
      const nextCrop = clampByFrame({
        x: live.current.crop.x + next.x - previous.x,
        y: live.current.crop.y + next.y - previous.y,
      });
      live.current = { ...live.current, crop: nextCrop };
      setCrop(nextCrop);
    }
  };
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
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
          <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={onCancel}>
            Отмена
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={busy || !croppedAreaPixels}
            onClick={() => croppedAreaPixels && onConfirm({ croppedAreaPixels })}
          >
            {busy ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          className="relative mx-auto h-[min(70vw,360px)] max-h-[360px] w-[min(70vw,360px)] max-w-[360px] touch-none overflow-hidden overscroll-contain rounded-2xl bg-black/70 select-none"
          style={varsStyle}
          ref={viewportRef}
          role="region"
          aria-label="Кадрирование фото"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
        >
          {hasImage && (
            <>
              <img
                src={imageUrl!}
                alt="Предпросмотр"
                draggable={false}
                className="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
                style={{
                  width: imageNaturalSize ? `${imageNaturalSize.width}px` : "auto",
                  height: imageNaturalSize ? `${imageNaturalSize.height}px` : "auto",
                  transform: `translate(-50%, -50%) translate(${crop.x}px, ${crop.y}px) scale(${effectiveScale})`,
                  transformOrigin: "center center",
                }}
                onError={() => {
                  setImageError("Не удалось открыть изображение. Выберите другой файл.");
                  setImageNaturalSize(null);
                }}
                onLoad={(event) => {
                  const img = event.currentTarget;
                  if (img.naturalWidth * img.naturalHeight > 40_000_000) {
                    setImageError("Выберите фото до 40 мегапикселей.");
                    return;
                  }
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
                    className="pointer-events-none absolute top-0 left-0 w-full bg-gradient-to-b from-black/55 to-black/35"
                    style={{ height: "calc(50% - (var(--crop-frame-h) / 2))" }}
                  />
                  {/* bottom */}
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/55 to-black/35"
                    style={{ height: "calc(50% - (var(--crop-frame-h) / 2))" }}
                  />
                  {/* left */}
                  <div
                    className="pointer-events-none absolute bg-gradient-to-r from-black/55 to-black/35"
                    style={{
                      top: "calc(50% - (var(--crop-frame-h) / 2))",
                      left: 0,
                      width: "calc(50% - (var(--crop-frame-w) / 2))",
                      height: "var(--crop-frame-h)",
                    }}
                  />
                  {/* right */}
                  <div
                    className="pointer-events-none absolute bg-gradient-to-l from-black/55 to-black/35"
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
                className={`pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-white/70 ${frameClassName}`}
                style={{
                  width: "var(--crop-frame-w)",
                  height: "var(--crop-frame-h)",
                  ["--crop-frame-radius" as string]: `${frame.borderRadius ?? 0}px`,
                }}
              />
            </>
          )}
        </div>

        {imageError && (
          <p role="alert" className="text-sm text-red-600">
            {imageError}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => zoomAt(zoom - zoomStep)}
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
            onChange={(event) => zoomAt(Number(event.target.value))}
            disabled={busy}
            className="h-2 w-full cursor-pointer accent-[var(--staffly-text-strong)]"
            aria-label="Масштаб изображения"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => zoomAt(zoom + zoomStep)}
            disabled={busy || zoom >= maxZoom}
          >
            +
          </Button>
        </div>
      </div>
    </Modal>
  );
}

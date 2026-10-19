import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Modal from "./Modal";
import Button from "./Button";
import {
  constrainPhoto,
  photoPinch,
  zoomPhoto,
  PHOTO_INITIAL_TRANSFORM,
  type PhotoPoint,
  type PhotoSize,
  type PhotoTransform,
} from "../lib/photoZoom";

export default function PhotoViewer({
  url,
  title,
  onClose,
  actions,
}: {
  url: string;
  title: string;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [transform, setTransform] = useState(PHOTO_INITIAL_TRANSFORM);
  const [dragging, setDragging] = useState(false);
  const [viewportSize, setViewportSize] = useState<PhotoSize>({ width: 0, height: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageSize = useRef<PhotoSize | null>(null);
  const current = useRef(PHOTO_INITIAL_TRANSFORM);
  const pointers = useRef(new Map<number, PhotoPoint>());
  const nativeGesture = useRef<{ transform: PhotoTransform; anchor: PhotoPoint } | null>(null);
  const instructionsId = useId();

  const update = useCallback((next: PhotoTransform) => {
    const element = viewportRef.current;
    if (!element || !imageSize.current) return;
    const constrained = constrainPhoto(
      next,
      { width: element.clientWidth, height: element.clientHeight },
      imageSize.current,
    );
    current.current = constrained;
    setTransform(constrained);
  }, []);
  const zoom = useCallback(
    (scale: number, anchor: PhotoPoint, previousAnchor = anchor) => {
      const element = viewportRef.current;
      if (!element || !imageSize.current) return;
      update(
        zoomPhoto(
          current.current,
          scale,
          previousAnchor,
          anchor,
          { width: element.clientWidth, height: element.clientHeight },
          imageSize.current,
        ),
      );
    },
    [update],
  );
  const point = useCallback((clientX: number, clientY: number): PhotoPoint => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    // Cancel native page zoom only inside the photo viewport.
    const onWheel = (event: WheelEvent) => {
      if (!imageSize.current || event.deltaY === 0) return;
      event.preventDefault();
      if (nativeGesture.current) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      const multiplier = Math.exp(-Math.max(-200, Math.min(200, delta)) * (event.ctrlKey ? 0.01 : 0.002));
      zoom(current.current.scale * multiplier, point(event.clientX, event.clientY));
    };
    // Safari supplies native GestureEvents for trackpad pinch instead of Ctrl+wheel.
    const onGestureStart = (event: Event) => {
      if (!imageSize.current) return;
      event.preventDefault();
      const gesture = event as Event & { clientX: number; clientY: number };
      nativeGesture.current = { transform: current.current, anchor: point(gesture.clientX, gesture.clientY) };
    };
    const onGestureChange = (event: Event) => {
      const start = nativeGesture.current;
      if (!start || !imageSize.current) return;
      event.preventDefault();
      const gesture = event as Event & { scale: number; clientX: number; clientY: number };
      if (!Number.isFinite(gesture.scale) || gesture.scale <= 0) return;
      update(
        zoomPhoto(
          start.transform,
          start.transform.scale * gesture.scale,
          start.anchor,
          point(gesture.clientX, gesture.clientY),
          { width: element.clientWidth, height: element.clientHeight },
          imageSize.current,
        ),
      );
    };
    const onGestureEnd = (event: Event) => {
      if (nativeGesture.current) event.preventDefault();
      nativeGesture.current = null;
    };
    const measure = () => {
      setViewportSize({ width: element.clientWidth, height: element.clientHeight });
      update(current.current);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("gesturestart", onGestureStart, { passive: false });
    element.addEventListener("gesturechange", onGestureChange, { passive: false });
    element.addEventListener("gestureend", onGestureEnd, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("gesturestart", onGestureStart);
      element.removeEventListener("gesturechange", onGestureChange);
      element.removeEventListener("gestureend", onGestureEnd);
    };
  }, [point, update, zoom]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!imageSize.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointers.current.set(event.pointerId, point(event.clientX, event.clientY));
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const before = [...pointers.current.values()].slice(0, 2);
    const next = point(event.clientX, event.clientY);
    pointers.current.set(event.pointerId, next);
    if (nativeGesture.current) return;
    if (pointers.current.size >= 2) {
      const oldPinch = photoPinch(before);
      const newPinch = photoPinch([...pointers.current.values()].slice(0, 2));
      if (oldPinch.distance > 0)
        zoom((current.current.scale * newPinch.distance) / oldPinch.distance, newPinch.centre, oldPinch.centre);
    } else
      update({
        ...current.current,
        x: current.current.x + next.x - previous.x,
        y: current.current.y + next.y - previous.y,
      });
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(pointers.current.size > 0);
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !imageSize.current) return;
    const centre = { x: 0, y: 0 };
    if (event.key === "+" || event.key === "=") zoom(current.current.scale * 1.25, centre);
    else if (event.key === "-") zoom(current.current.scale / 1.25, centre);
    else if (event.key === "0") update(PHOTO_INITIAL_TRANSFORM);
    else if (event.key.startsWith("Arrow")) {
      const directions: Record<string, number[]> = {
        ArrowLeft: [40, 0],
        ArrowRight: [-40, 0],
        ArrowUp: [0, 40],
        ArrowDown: [0, -40],
      };
      const delta = directions[event.key];
      if (!delta) return;
      update({ ...current.current, x: current.current.x + delta[0], y: current.current.y + delta[1] });
    } else return;
    event.preventDefault();
  }

  const fit = imageSize.current
    ? Math.min(viewportSize.width / imageSize.current.width, viewportSize.height / imageSize.current.height)
    : 0;
  const badgeTop = imageSize.current
    ? Math.max(0, (viewportSize.height - imageSize.current.height * fit * transform.scale) / 2 + transform.y) + 12
    : 12;
  const badgeRight = imageSize.current
    ? Math.max(0, (viewportSize.width - imageSize.current.width * fit * transform.scale) / 2 - transform.x) + 12
    : 12;

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      className="max-w-5xl [overflow-wrap:anywhere]"
      headerCloseButton
      headerCloseLabel="Закрыть фото"
      footer={actions}
    >
      <p id={instructionsId} className="sr-only">
        Увеличивайте фото щипком двух пальцев или колесом мыши. Увеличенное фото можно перетаскивать. С клавиатуры: плюс
        и минус — масштаб, стрелки — перемещение, ноль — сброс. Масштаб от 100 до 400 процентов; 100 процентов — фото
        целиком в окне.
      </p>
      <div
        ref={viewportRef}
        role="region"
        aria-label={`Фото «${title}»`}
        aria-describedby={instructionsId}
        tabIndex={0}
        className={`bg-app relative max-h-[65dvh] min-h-40 w-full touch-none overflow-hidden overscroll-contain rounded-xl select-none focus-visible:outline-2 ${transform.scale > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"}`}
        style={{
          aspectRatio: imageSize.current ? `${imageSize.current.width} / ${imageSize.current.height}` : "4 / 3",
        }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
        onLostPointerCapture={pointerEnd}
        onKeyDown={keyDown}
        onDoubleClick={(event) => zoom(current.current.scale > 1 ? 1 : 2, point(event.clientX, event.clientY))}
      >
        {!loaded && !failed && (
          <span role="status" className="text-muted absolute inset-0 flex items-center justify-center text-sm">
            Загружаем фото…
          </span>
        )}
        {failed ? (
          <div className="text-muted flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p>Не удалось загрузить фото.</p>
            <Button
              variant="outline"
              onClick={() => {
                setFailed(false);
                setLoaded(false);
                imageSize.current = null;
                setRetry(retry + 1);
              }}
            >
              Повторить
            </Button>
          </div>
        ) : (
          <img
            key={retry}
            src={url}
            alt={title}
            draggable={false}
            className="pointer-events-none h-full w-full object-contain"
            style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
            onLoad={(event) => {
              imageSize.current = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              };
              update(PHOTO_INITIAL_TRANSFORM);
              setLoaded(true);
            }}
            onError={() => {
              setFailed(true);
              setLoaded(false);
              imageSize.current = null;
            }}
          />
        )}
        {loaded && !failed ? (
          <span
            className="pointer-events-none absolute rounded-lg bg-black/60 px-2.5 py-1.5 text-sm font-medium text-white tabular-nums"
            style={{ top: badgeTop, right: badgeRight }}
            aria-label={`Масштаб ${Math.round(transform.scale * 100)}%, от 100% до 400%`}
          >
            {Math.round(transform.scale * 100)}%
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="outline"
          aria-label="Уменьшить фото"
          disabled={!loaded || failed || transform.scale <= 1}
          onClick={() => zoom(current.current.scale / 1.25, { x: 0, y: 0 })}
        >
          −
        </Button>
        <input
          type="range"
          min="1"
          max="4"
          step="0.05"
          value={transform.scale}
          aria-label="Масштаб фото"
          disabled={!loaded || failed}
          onChange={(event) => zoom(Number(event.target.value), { x: 0, y: 0 })}
          className="min-w-0 flex-1 accent-[var(--staffly-text-strong)]"
        />
        <Button
          variant="outline"
          aria-label="Увеличить фото"
          disabled={!loaded || failed || transform.scale >= 4}
          onClick={() => zoom(current.current.scale * 1.25, { x: 0, y: 0 })}
        >
          +
        </Button>
        <Button variant="ghost" disabled={!loaded || failed} onClick={() => update(PHOTO_INITIAL_TRANSFORM)}>
          Сброс
        </Button>
      </div>
    </Modal>
  );
}

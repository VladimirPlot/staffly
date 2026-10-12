export type PhotoPoint = { x: number; y: number };
export type PhotoSize = { width: number; height: number };
export type PhotoTransform = PhotoPoint & { scale: number };
export const PHOTO_MIN_ZOOM = 1;
export const PHOTO_MAX_ZOOM = 4;
export const PHOTO_INITIAL_TRANSFORM: PhotoTransform = { scale: 1, x: 0, y: 0 };

export function constrainPhoto(transform: PhotoTransform, viewport: PhotoSize, image: PhotoSize): PhotoTransform {
  const scale = Math.min(PHOTO_MAX_ZOOM, Math.max(PHOTO_MIN_ZOOM, transform.scale));
  const fit = Math.min(viewport.width / image.width, viewport.height / image.height);
  const limitX = Math.max(0, (image.width * fit * scale - viewport.width) / 2);
  const limitY = Math.max(0, (image.height * fit * scale - viewport.height) / 2);
  return {
    scale,
    x: limitX === 0 ? 0 : Math.min(limitX, Math.max(-limitX, transform.x)),
    y: limitY === 0 ? 0 : Math.min(limitY, Math.max(-limitY, transform.y)),
  };
}

// Coordinates are relative to the viewport centre. Preserve the point under the gesture.
export function zoomPhoto(
  transform: PhotoTransform,
  nextScale: number,
  previousAnchor: PhotoPoint,
  nextAnchor: PhotoPoint,
  viewport: PhotoSize,
  image: PhotoSize,
): PhotoTransform {
  const scale = Math.min(PHOTO_MAX_ZOOM, Math.max(PHOTO_MIN_ZOOM, nextScale));
  const ratio = scale / transform.scale;
  return constrainPhoto(
    {
      scale,
      x: nextAnchor.x - (previousAnchor.x - transform.x) * ratio,
      y: nextAnchor.y - (previousAnchor.y - transform.y) * ratio,
    },
    viewport,
    image,
  );
}

export function photoPinch(points: PhotoPoint[]) {
  const [first, second] = points;
  return {
    centre: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.hypot(first.x - second.x, first.y - second.y),
  };
}

import React from "react";

const DEFAULT_ZOOM = 100;
const FIT_ZOOM = 65;
const MIN_ZOOM = 10;
const MAX_ZOOM = 120;
const STEP = 5;

export function useScheduleTableZoom() {
  const [zoom, setZoomState] = React.useState(DEFAULT_ZOOM);

  const safeMinZoom = MIN_ZOOM;
  const isDefaultZoom = zoom === DEFAULT_ZOOM;

  const setZoom = React.useCallback(
    (value: number) => {
      const rounded = Math.round(value / STEP) * STEP;
      const clamped = Math.max(safeMinZoom, Math.min(MAX_ZOOM, rounded));
      setZoomState(clamped);
    },
    [safeMinZoom],
  );

  const showFullPeriod = React.useCallback(() => {
    setZoomState(Math.max(safeMinZoom, FIT_ZOOM));
  }, [safeMinZoom]);

  const resetZoom = React.useCallback(() => {
    setZoomState(DEFAULT_ZOOM);
  }, []);

  return {
    zoom,
    zoomScale: zoom / DEFAULT_ZOOM,
    isDefaultZoom,
    minZoom: safeMinZoom,
    fitZoom: Math.max(safeMinZoom, FIT_ZOOM),
    maxZoom: MAX_ZOOM,
    zoomStep: STEP,
    setZoom,
    showFullPeriod,
    resetZoom,
  };
}

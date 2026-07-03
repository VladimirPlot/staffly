import React from "react";

const DEFAULT_ZOOM = 100;
const FIT_ZOOM = 65;
const MIN_ZOOM = 50;
const MAX_ZOOM = 120;
const STEP = 5;

export type ScheduleTableZoomMode = "normal" | "fit" | "custom";

export function useScheduleTableZoom() {
  const [zoom, setZoomState] = React.useState(DEFAULT_ZOOM);
  const [mode, setMode] = React.useState<ScheduleTableZoomMode>("normal");

  const setZoom = React.useCallback((value: number) => {
    const rounded = Math.round(value / STEP) * STEP;
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rounded));
    setZoomState(clamped);
    setMode(clamped === DEFAULT_ZOOM ? "normal" : "custom");
  }, []);

  const showFullPeriod = React.useCallback(() => {
    setZoomState(FIT_ZOOM);
    setMode("fit");
  }, []);

  const resetZoom = React.useCallback(() => {
    setZoomState(DEFAULT_ZOOM);
    setMode("normal");
  }, []);

  return {
    zoom,
    zoomScale: zoom / DEFAULT_ZOOM,
    mode,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomStep: STEP,
    setZoom,
    showFullPeriod,
    resetZoom,
  };
}

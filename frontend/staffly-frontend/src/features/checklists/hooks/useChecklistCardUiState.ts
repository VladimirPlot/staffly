import { useCallback, useEffect, useRef, useState } from "react";
import { toJpeg } from "html-to-image";

import {
  CHECKLIST_SCROLL_CENTER_MAX_HEIGHT_RATIO,
  CHECKLIST_SCROLL_DELAY_MS,
  CHECKLIST_SCROLL_TOP_OFFSET_RATIO,
} from "../constants";
import type { ChecklistDto } from "../api";
import type { ChecklistItemSectionKey } from "../types";
import { getInitialItemTab, groupChecklistItems } from "../utils/checklistItems";
import { sanitizeFileName } from "../utils/formatters";

export function useChecklistCardUiState() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeItemTab, setActiveItemTab] = useState<ChecklistItemSectionKey>("available");
  const [downloading, setDownloading] = useState<number | null>(null);
  const [actionMenuFor, setActionMenuFor] = useState<number | null>(null);

  const checklistRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const actionMenuRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const checklistScrollTimeoutRef = useRef<number | null>(null);

  const resetExpandedState = useCallback(() => {
    setExpandedId(null);
  }, []);

  const scrollChecklistIntoView = useCallback((checklistId: number) => {
    if (checklistScrollTimeoutRef.current) {
      window.clearTimeout(checklistScrollTimeoutRef.current);
    }

    checklistScrollTimeoutRef.current = window.setTimeout(() => {
      const node = checklistRefs.current.get(checklistId);
      checklistScrollTimeoutRef.current = null;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const pageTop = window.scrollY;
      const nodeTop = pageTop + rect.top;
      const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
      const topOffset = viewportHeight * CHECKLIST_SCROLL_TOP_OFFSET_RATIO;
      const targetTop =
        rect.height <= viewportHeight * CHECKLIST_SCROLL_CENTER_MAX_HEIGHT_RATIO
          ? nodeTop - (viewportHeight - rect.height) / 2
          : nodeTop - topOffset;

      window.scrollTo({
        top: Math.min(Math.max(targetTop, 0), maxScrollTop),
        behavior: "smooth",
      });
    }, CHECKLIST_SCROLL_DELAY_MS);
  }, []);

  const toggleExpanded = useCallback(
    (checklist: ChecklistDto) => {
      if (expandedId === checklist.id) {
        setExpandedId(null);
        return;
      }

      setActiveItemTab(getInitialItemTab(groupChecklistItems(checklist.items ?? [])));
      setExpandedId(checklist.id);
      scrollChecklistIntoView(checklist.id);
    },
    [expandedId, scrollChecklistIntoView],
  );

  const handleDownloadJpg = useCallback(async (checklist: ChecklistDto) => {
    const node = checklistRefs.current.get(checklist.id);
    if (!node) return;
    setActionMenuFor(null);
    setDownloading(checklist.id);
    try {
      const dataUrl = await toJpeg(node, { quality: 0.95, pixelRatio: 2, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${sanitizeFileName(checklist.name)}.jpg`;
      link.click();
    } catch (e) {
      console.error("Failed to download checklist", e);
    } finally {
      setDownloading(null);
    }
  }, []);

  const setChecklistRef = useCallback((id: number, node: HTMLDivElement | null) => {
    checklistRefs.current.set(id, node);
  }, []);

  const setActionMenuRef = useCallback((id: number, node: HTMLDivElement | null) => {
    actionMenuRefs.current.set(id, node);
  }, []);

  const toggleActionMenu = useCallback((checklistId: number) => {
    setActionMenuFor((current) => (current === checklistId ? null : checklistId));
  }, []);

  const closeActionMenu = useCallback(() => {
    setActionMenuFor(null);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuFor === null) return;
      const menuNode = actionMenuRefs.current.get(actionMenuFor);
      if (menuNode && !menuNode.contains(event.target as Node)) {
        setActionMenuFor(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionMenuFor(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionMenuFor]);

  useEffect(() => {
    return () => {
      if (checklistScrollTimeoutRef.current) {
        window.clearTimeout(checklistScrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    expandedId,
    activeItemTab,
    downloading,
    actionMenuFor,
    setActiveItemTab,
    resetExpandedState,
    toggleExpanded,
    handleDownloadJpg,
    setChecklistRef,
    setActionMenuRef,
    toggleActionMenu,
    closeActionMenu,
  };
}

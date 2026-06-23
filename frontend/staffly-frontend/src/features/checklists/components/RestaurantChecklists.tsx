import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  ChevronDown,
  Clock,
  Download,
  History,
  Image as ImageIcon,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Unlock,
  X,
} from "lucide-react";

import { useAuth } from "../../../shared/providers/AuthProvider";
import { listMembers } from "../../employees/api";
import Card from "../../../shared/ui/Card";
import ContentText from "../../../shared/ui/ContentText";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Icon from "../../../shared/ui/Icon";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import { compressImageFile } from "../../../shared/lib/compressImageFile";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import {
  createChecklist,
  deleteChecklist,
  deleteChecklistItemCompletionPhoto,
  deleteChecklistItemExamplePhoto,
  getChecklistHistory,
  listChecklists,
  listChecklistHistory,
  reserveChecklistItem,
  unreserveChecklistItem,
  completeChecklistItem,
  undoChecklistItem,
  resetChecklist,
  updateChecklist,
  uploadChecklistItemCompletionPhoto,
  uploadChecklistItemExamplePhoto,
  type ChecklistDto,
  type ChecklistHistoryDetailDto,
  type ChecklistHistorySummaryDto,
  type ChecklistItemDto,
  type ChecklistKind,
} from "../api";
import ChecklistDialog, { type ChecklistDialogInitial, type ChecklistDialogSubmitPayload } from "./ChecklistDialog";
import { toJpeg } from "html-to-image";

export type RestaurantChecklistsProps = {
  restaurantId: number;
  canManage: boolean;
};

function sanitizeFileName(name: string): string {
  const safe = name?.trim() || "checklist";
  return safe.replace(/[\\/:*?"<>|]+/g, "_");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resetReasonLabel(reason?: string | null): string {
  if (reason === "AUTO") return "Авто";
  if (reason === "MANUAL") return "Вручную";
  return "—";
}

function hasPhoto(url?: string | null): boolean {
  return Boolean(url && url.trim());
}

type PhotoPreview = {
  title: string;
  url: string;
  description?: string;
};

type ChecklistItemSectionKey = "available" | "reserved" | "done";
type ChecklistWorkStatus = "empty" | "completed" | "reserved" | "available";
type ChecklistItemGroups = Record<ChecklistItemSectionKey, ChecklistItemDto[]>;

type ChecklistWorkSummary = {
  label: string;
  detail: string;
  status: ChecklistWorkStatus;
  badgeClassName: string;
};

type ChecklistProgressIndicatorProps = {
  summary: ChecklistWorkSummary;
  doneCount: number;
  total: number;
};

const CHECKLIST_PROGRESS_RADIUS = 7;
const CHECKLIST_PROGRESS_CIRCUMFERENCE = 2 * Math.PI * CHECKLIST_PROGRESS_RADIUS;

const CHECKLIST_ITEM_TABS: { key: ChecklistItemSectionKey; label: string }[] = [
  { key: "available", label: "Не взяты" },
  { key: "reserved", label: "В работе" },
  { key: "done", label: "Готово" },
];

const EMPTY_ITEM_TAB_MESSAGES: Record<ChecklistItemSectionKey, string> = {
  available: "Нет свободных пунктов. Все задачи взяты в работу или завершены!",
  reserved: "Нет пунктов в работе. Возьмите задачу во вкладке «Не взяты».",
  done: "Нет завершенных пунктов. Выполните задачи из вкладки «В работе».",
};

const PANEL_COLLAPSED = { height: 0, opacity: 0 } as const;
const PANEL_EXPANDED = { height: "auto", opacity: 1 } as const;
const TAB_CONTENT_ENTER = { opacity: 0, y: 6 } as const;
const TAB_CONTENT_VISIBLE = { opacity: 1, y: 0 } as const;
const TAB_CONTENT_EXIT = { opacity: 0, y: -6 } as const;
const EXPANDED_PANEL_TRANSITION = { duration: 0.22, ease: "easeInOut" } as const;
const ACTIVE_TAB_TRANSITION = { type: "spring", stiffness: 380, damping: 30 } as const;
const TAB_CONTENT_TRANSITION = { duration: 0.14, ease: "easeOut" } as const;
const CHECKLIST_SCROLL_DELAY_MS = 260;
const CHECKLIST_SCROLL_TOP_OFFSET_RATIO = 0.12;
const CHECKLIST_SCROLL_CENTER_MAX_HEIGHT_RATIO = 0.82;

function groupChecklistItems(items: ChecklistItemDto[]): ChecklistItemGroups {
  const groups: ChecklistItemGroups = {
    available: [],
    reserved: [],
    done: [],
  };

  items.forEach((item) => {
    if (item.done) {
      groups.done.push(item);
      return;
    }

    if (item.reservedBy) {
      groups.reserved.push(item);
      return;
    }

    groups.available.push(item);
  });

  return groups;
}

function getInitialItemTab(groups: ChecklistItemGroups): ChecklistItemSectionKey {
  if (groups.available.length > 0) return "available";
  if (groups.reserved.length > 0) return "reserved";
  if (groups.done.length > 0) return "done";
  return "available";
}

function getChecklistItemTotal(groups: ChecklistItemGroups): number {
  return groups.available.length + groups.reserved.length + groups.done.length;
}

function getChecklistWorkSummary(
  checklist: ChecklistDto,
  itemGroups = groupChecklistItems(checklist.items),
): ChecklistWorkSummary {
  const total = getChecklistItemTotal(itemGroups);
  const doneCount = itemGroups.done.length;
  const reservedCount = itemGroups.reserved.length;
  const availableCount = itemGroups.available.length;

  if (total === 0) {
    return {
      label: "Нет пунктов",
      detail: "пока нечего брать",
      status: "empty",
      badgeClassName: "border-subtle bg-[color:var(--staffly-control)] text-muted",
    };
  }

  if (checklist.completed || doneCount === total) {
    return {
      label: "Все готово",
      detail: `${doneCount}/${total} закрыто`,
      status: "completed",
      badgeClassName: "border-emerald-300 bg-emerald-50 text-default dark:border-emerald-500/45 dark:bg-emerald-500/15",
    };
  }

  if (reservedCount > 0) {
    return {
      label: `${reservedCount} в работе`,
      detail: availableCount > 0 ? `${availableCount} не взято` : `${doneCount}/${total} закрыто`,
      status: "reserved",
      badgeClassName: "border-amber-300 bg-amber-50 text-default dark:border-amber-500/45 dark:bg-amber-500/15",
    };
  }

  return {
    label: `${availableCount} не взято`,
    detail: doneCount > 0 ? `${doneCount}/${total} закрыто` : "ожидает старта",
    status: "available",
    badgeClassName: "border-subtle bg-[color:var(--staffly-control)] text-default",
  };
}

function ChecklistProgressIndicator({ summary, doneCount, total }: ChecklistProgressIndicatorProps) {
  if (summary.status === "empty") {
    return (
      <svg className="text-muted/30 h-4 w-4" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  if (summary.status === "completed") {
    return (
      <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <svg
          className="h-3 w-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 8 9 4" />
        </svg>
      </div>
    );
  }

  const progressPercent = total > 0 ? (doneCount / total) * 100 : 0;
  const strokeDashoffset =
    CHECKLIST_PROGRESS_CIRCUMFERENCE - (progressPercent / 100) * CHECKLIST_PROGRESS_CIRCUMFERENCE;
  const hasActiveProgress = summary.status === "reserved" || doneCount > 0;

  return (
    <div className="relative flex h-5 w-5 items-center justify-center">
      <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
        <circle
          cx="10"
          cy="10"
          r={CHECKLIST_PROGRESS_RADIUS}
          className="stroke-zinc-200 dark:stroke-zinc-800"
          strokeWidth="2"
          fill="none"
        />
        <circle
          cx="10"
          cy="10"
          r={CHECKLIST_PROGRESS_RADIUS}
          className={`${
            hasActiveProgress ? "stroke-amber-500 dark:stroke-amber-400" : "stroke-zinc-300 dark:stroke-zinc-600"
          } transition-all duration-300`}
          strokeWidth="2"
          fill="none"
          strokeDasharray={CHECKLIST_PROGRESS_CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className={`absolute h-1.5 w-1.5 rounded-full ${
          hasActiveProgress ? "bg-amber-500 shadow-[0_0_8px_#f59e0b] dark:bg-amber-400" : "bg-zinc-400 dark:bg-zinc-500"
        }`}
      />
    </div>
  );
}

const RestaurantChecklists = ({ restaurantId, canManage }: RestaurantChecklistsProps) => {
  const { user } = useAuth();
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [checklists, setChecklists] = useState<ChecklistDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogInitial, setDialogInitial] = useState<ChecklistDialogInitial | undefined>(undefined);
  const [editing, setEditing] = useState<ChecklistDto | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeItemTab, setActiveItemTab] = useState<ChecklistItemSectionKey>("available");
  const [myPositionId, setMyPositionId] = useState<number | null>(null);
  const [myPositionLoaded, setMyPositionLoaded] = useState(() => !canManage);
  const [viewScope, setViewScope] = useState<"my" | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<ChecklistDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [itemActionLoading, setItemActionLoading] = useState<Set<string>>(new Set());
  const [itemActionError, setItemActionError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [actionMenuFor, setActionMenuFor] = useState<number | null>(null);
  const [mediaExpanded, setMediaExpanded] = useState<Set<string>>(new Set());
  const [photoUploading, setPhotoUploading] = useState<Set<string>>(new Set());
  const [historyTarget, setHistoryTarget] = useState<ChecklistDto | null>(null);
  const [historySummaries, setHistorySummaries] = useState<ChecklistHistorySummaryDto[]>([]);
  const [historyDetail, setHistoryDetail] = useState<ChecklistHistoryDetailDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDetailLoading, setHistoryDetailLoading] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null);
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const checklistRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const actionMenuRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const errorTimeoutRef = useRef<number | null>(null);
  const checklistScrollTimeoutRef = useRef<number | null>(null);

  const activeTab = searchParams.get("tab") === "scripts" ? "scripts" : "checklists";
  const activeKind: ChecklistKind = activeTab === "scripts" ? "INFO" : "TRACKABLE";
  const dialogKind = editing?.kind ?? activeKind;
  const createDialogTitle = editing
    ? dialogKind === "INFO"
      ? "Редактирование скрипта"
      : "Редактирование чек-листа"
    : activeTab === "scripts"
      ? "Новый скрипт"
      : "Новый чек-лист";
  const emptyStateLabel = activeTab === "scripts" ? "Скрипты пока не добавлены." : "Чек-листы пока не добавлены.";

  const loadPositions = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const data = await listPositions(restaurantId, { includeInactive: true });
      setPositions(data);
    } catch (e) {
      console.error("Failed to load positions", e);
    }
  }, [restaurantId]);

  const loadChecklists = useCallback(
    async (signal?: AbortSignal) => {
      if (!restaurantId) return;
      if (canManage && !myPositionLoaded) return;
      setLoading(true);
      setError(null);
      try {
        const effectivePositionFilter = canManage ? (viewScope === "my" ? myPositionId : positionFilter) : undefined;
        const data = await listChecklists(
          restaurantId,
          {
            positionId: effectivePositionFilter ?? undefined,
            kind: activeKind,
            q: debouncedQuery,
          },
          signal,
        );
        setChecklists(data);
        setExpandedId(null);
        setMediaExpanded(new Set());
      } catch (e: any) {
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") {
          return;
        }
        console.error("Failed to load checklists", e);
        setError("Не удалось загрузить список");
        setChecklists([]);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [restaurantId, canManage, myPositionLoaded, viewScope, myPositionId, positionFilter, activeKind, debouncedQuery],
  );

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    if (!canManage) {
      setMyPositionId(null);
      setViewScope("all");
      setMyPositionLoaded(true);
      return;
    }
    if (!restaurantId || !user?.id) {
      setMyPositionId(null);
      setViewScope("all");
      setMyPositionLoaded(false);
      return;
    }
    setMyPositionLoaded(false);
    let alive = true;
    const loadMyPosition = async () => {
      try {
        const members = await listMembers(restaurantId);
        if (!alive) return;
        const currentMember = members.find((m) => m.userId === user.id);
        const pId = currentMember?.positionId ?? null;
        setMyPositionId(pId);
        if (pId != null) {
          setViewScope("my");
        } else {
          setViewScope("all");
        }
        setMyPositionLoaded(true);
      } catch (e) {
        console.error("Failed to load current user position", e);
        if (alive) {
          setMyPositionId(null);
          setViewScope("all");
          setMyPositionLoaded(true);
        }
      }
    };
    void loadMyPosition();
    return () => {
      alive = false;
    };
  }, [restaurantId, canManage, user?.id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
    }, 300);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  useEffect(() => {
    setExpandedId(null);
    setMediaExpanded(new Set());
  }, [activeKind, viewScope, positionFilter, debouncedQuery]);

  useEffect(() => {
    const controller = new AbortController();
    void loadChecklists(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadChecklists]);

  const openCreateDialog = useCallback(() => {
    setEditing(null);
    setDialogError(null);

    setDialogInitial({
      kind: activeKind,
      name: "",
      content: "",
      positionIds: [],
      periodicity: activeKind === "TRACKABLE" ? "DAILY" : undefined,
      items: [{ text: "", completionPhotoRequired: false }],
    });

    setDialogOpen(true);
  }, [activeKind]);

  const openEditDialog = useCallback((checklist: ChecklistDto) => {
    setEditing(checklist);
    setDialogError(null);
    setDialogInitial({
      kind: checklist.kind,
      name: checklist.name,
      content: checklist.content ?? "",
      positionIds: checklist.positions.map((p) => p.id),
      periodicity: checklist.periodicity,
      resetTime: checklist.resetTime ?? undefined,
      resetDayOfWeek: checklist.resetDayOfWeek ?? undefined,
      resetDayOfMonth: checklist.resetDayOfMonth ?? undefined,
      items: checklist.items.map((item) => ({
        id: item.id,
        text: item.text,
        completionPhotoRequired: item.completionPhotoRequired,
        examplePhotoUrl: item.examplePhotoUrl,
      })),
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    if (dialogSubmitting) return;
    setDialogOpen(false);
    setEditing(null);
    setDialogError(null);
  }, [dialogSubmitting]);

  const handleSubmitDialog = useCallback(
    async (payload: ChecklistDialogSubmitPayload) => {
      if (!restaurantId) return;
      setDialogSubmitting(true);
      setDialogError(null);

      let savedAfterUpsert: ChecklistDto | null = null;
      try {
        const { exampleFiles = [], examplePhotoDeletes = [], ...checklistPayload } = payload;
        let saved: ChecklistDto;
        if (editing) {
          saved = await updateChecklist(restaurantId, editing.id, checklistPayload);
        } else {
          saved = await createChecklist(restaurantId, checklistPayload);
        }
        savedAfterUpsert = saved;

        for (const itemId of examplePhotoDeletes) {
          saved = await deleteChecklistItemExamplePhoto(restaurantId, saved.id, itemId);
          savedAfterUpsert = saved;
        }

        for (const entry of exampleFiles) {
          const targetItem = saved.items[entry.index];
          if (!targetItem) continue;
          const compressed = await compressImageFile(entry.file);
          saved = await uploadChecklistItemExamplePhoto(restaurantId, saved.id, targetItem.id, compressed);
          savedAfterUpsert = saved;
        }

        setDialogOpen(false);
        setEditing(null);
        await loadChecklists();
      } catch (e: any) {
        console.error("Failed to save checklist", e);
        if (savedAfterUpsert) {
          setEditing(savedAfterUpsert);
          await loadChecklists();
          setDialogError(
            e?.friendlyMessage || "Чек-лист сохранён, но не удалось загрузить часть фото. Повторите сохранение.",
          );
        } else {
          setDialogError(e?.friendlyMessage || "Не удалось сохранить чек-лист");
        }
      } finally {
        setDialogSubmitting(false);
      }
    },
    [restaurantId, editing, loadChecklists],
  );

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

  const openDeleteDialog = useCallback((checklist: ChecklistDto) => {
    setDeleteTarget(checklist);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteChecklist(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await loadChecklists();
    } catch (e) {
      console.error("Failed to delete checklist", e);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, restaurantId, loadChecklists]);

  const handleViewScopeChange = useCallback((scope: "my" | "all") => {
    setViewScope(scope);
    if (scope === "my") {
      setPositionFilter(null);
    }
  }, []);

  const handlePositionFilterChange = useCallback((positionId: number | null) => {
    setPositionFilter(positionId);
    setViewScope("all");
  }, []);

  const resetFilter = useCallback(() => {
    setPositionFilter(null);
    setSearchTerm("");
    if (myPositionId != null) {
      setViewScope("my");
    } else {
      setViewScope("all");
    }
  }, [myPositionId]);

  const positionNames = useMemo(() => {
    const map = new Map<number, string>();
    positions.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [positions]);

  const updateChecklistInState = useCallback((updated: ChecklistDto) => {
    setChecklists((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  }, []);

  const reportItemActionError = useCallback((message: string | null) => {
    setItemActionError(message);
    if (errorTimeoutRef.current) {
      window.clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    if (message) {
      errorTimeoutRef.current = window.setTimeout(() => {
        setItemActionError(null);
        errorTimeoutRef.current = null;
      }, 3000);
    }
  }, []);

  const toggleItemAction = useCallback((key: string, loading: boolean) => {
    setItemActionLoading((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const handleItemAction = useCallback(
    async (key: string, action: () => Promise<ChecklistDto>) => {
      if (itemActionLoading.has(key)) return;
      reportItemActionError(null);
      toggleItemAction(key, true);
      try {
        const updated = await action();
        updateChecklistInState(updated);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 409 || status === 403) {
          reportItemActionError("Пункт забронирован другим сотрудником");
        } else {
          console.error("Failed to update checklist item", e);
          reportItemActionError(e?.friendlyMessage || "Не удалось обновить пункт");
        }
      } finally {
        toggleItemAction(key, false);
      }
    },
    [itemActionLoading, reportItemActionError, toggleItemAction, updateChecklistInState],
  );

  const toggleMediaExpanded = useCallback((checklistId: number, itemId: number) => {
    const key = `${checklistId}-${itemId}`;
    setMediaExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const togglePhotoUploading = useCallback((key: string, loading: boolean) => {
    setPhotoUploading((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const handleCompletionPhotoUpload = useCallback(
    async (checklist: ChecklistDto, item: ChecklistItemDto, file: File) => {
      const key = `${checklist.id}-${item.id}-completion-photo`;
      if (photoUploading.has(key)) return;
      reportItemActionError(null);
      togglePhotoUploading(key, true);
      try {
        const compressed = await compressImageFile(file);
        const updated = await uploadChecklistItemCompletionPhoto(restaurantId, checklist.id, item.id, compressed);
        updateChecklistInState(updated);
      } catch (e: any) {
        console.error("Failed to upload checklist item photo", e);
        reportItemActionError(e?.friendlyMessage || "Не удалось загрузить фото");
      } finally {
        togglePhotoUploading(key, false);
      }
    },
    [photoUploading, reportItemActionError, restaurantId, togglePhotoUploading, updateChecklistInState],
  );

  const handleCompletionPhotoDelete = useCallback(
    async (checklist: ChecklistDto, item: ChecklistItemDto) => {
      const key = `${checklist.id}-${item.id}-completion-photo`;
      if (photoUploading.has(key)) return;
      reportItemActionError(null);
      togglePhotoUploading(key, true);
      try {
        const updated = await deleteChecklistItemCompletionPhoto(restaurantId, checklist.id, item.id);
        updateChecklistInState(updated);
      } catch (e: any) {
        console.error("Failed to delete checklist item photo", e);
        reportItemActionError(e?.friendlyMessage || "Не удалось удалить фото");
      } finally {
        togglePhotoUploading(key, false);
      }
    },
    [photoUploading, reportItemActionError, restaurantId, togglePhotoUploading, updateChecklistInState],
  );

  const handleReset = useCallback(
    async (checklist: ChecklistDto) => {
      setResetting(checklist.id);
      try {
        await resetChecklist(restaurantId, checklist.id);
        await loadChecklists();
      } catch (e) {
        console.error("Failed to reset checklist", e);
      } finally {
        setResetting(null);
      }
    },
    [restaurantId, loadChecklists],
  );

  const loadHistoryDetail = useCallback(
    async (historyId: number) => {
      setHistoryDetailLoading(historyId);
      setHistoryError(null);
      try {
        const detail = await getChecklistHistory(restaurantId, historyId);
        setHistoryDetail(detail);
      } catch (e: any) {
        console.error("Failed to load checklist history detail", e);
        setHistoryError(e?.friendlyMessage || "Не удалось загрузить историю");
      } finally {
        setHistoryDetailLoading(null);
      }
    },
    [restaurantId],
  );

  const openHistoryModal = useCallback(
    async (checklist: ChecklistDto) => {
      setHistoryTarget(checklist);
      setHistorySummaries([]);
      setHistoryDetail(null);
      setHistoryError(null);
      setHistoryLoading(true);
      try {
        const summaries = await listChecklistHistory(restaurantId, checklist.id);
        setHistorySummaries(summaries);
        if (summaries[0]) {
          await loadHistoryDetail(summaries[0].id);
        }
      } catch (e: any) {
        console.error("Failed to load checklist history", e);
        setHistoryError(e?.friendlyMessage || "Не удалось загрузить историю");
      } finally {
        setHistoryLoading(false);
      }
    },
    [loadHistoryDetail, restaurantId],
  );

  const closePhotoPreview = useCallback(() => {
    setPhotoPreview(null);
  }, []);

  const closeHistoryModal = useCallback(() => {
    if (photoPreview) {
      closePhotoPreview();
      return;
    }
    if (historyLoading || historyDetailLoading !== null) return;
    setHistoryTarget(null);
    setHistorySummaries([]);
    setHistoryDetail(null);
    setHistoryError(null);
  }, [closePhotoPreview, historyDetailLoading, historyLoading, photoPreview]);

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
      if (errorTimeoutRef.current) {
        window.clearTimeout(errorTimeoutRef.current);
      }
      if (checklistScrollTimeoutRef.current) {
        window.clearTimeout(checklistScrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleOpenDialog() {
      openCreateDialog();
    }

    window.addEventListener("open-checklist-dialog", handleOpenDialog);
    return () => {
      window.removeEventListener("open-checklist-dialog", handleOpenDialog);
    };
  }, [openCreateDialog]);

  const visibleChecklists = useMemo(() => {
    const collator = new Intl.Collator("ru", { sensitivity: "base" });
    return [...checklists].sort((a, b) => {
      if (activeKind === "TRACKABLE") {
        const completedDiff = Number(a.completed) - Number(b.completed);
        if (completedDiff !== 0) {
          return completedDiff;
        }
      }
      return collator.compare(a.name ?? "", b.name ?? "");
    });
  }, [checklists, activeKind]);

  const isListLoading = loading || (canManage && !myPositionLoaded);

  return (
    <Card className="mt-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <Input
            label="Поиск"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Поиск по названию…"
            className="md:max-w-sm"
          />
          {canManage && myPositionId !== null && (
            <div className="flex gap-2 md:mb-0.5">
              <Button
                size="sm"
                variant={viewScope === "my" ? "primary" : "outline"}
                onClick={() => handleViewScopeChange("my")}
              >
                Мои
              </Button>
              <Button
                size="sm"
                variant={viewScope === "all" ? "primary" : "outline"}
                onClick={() => handleViewScopeChange("all")}
              >
                Все
              </Button>
            </div>
          )}
          {(positionFilter !== null ||
            searchTerm !== "" ||
            (canManage && myPositionId !== null && viewScope === "all")) && (
            <button
              type="button"
              onClick={resetFilter}
              className="text-muted hover:text-default flex items-center gap-1 rounded-full border border-transparent p-2 text-sm transition md:mb-1.5"
              aria-label="Сбросить фильтры"
            >
              <Icon icon={X} size="sm" decorative />
              <span>Сбросить</span>
            </button>
          )}
        </div>
        {canManage && viewScope === "all" && positions.length > 0 && (
          <div className="relative">
            <div className="no-scrollbar flex flex-nowrap gap-2 overflow-x-auto py-1 pr-12">
              <button
                type="button"
                onClick={() => handlePositionFilterChange(null)}
                className={`inline-flex h-9 shrink-0 items-center justify-center rounded-2xl px-4 text-xs font-semibold shadow-sm transition focus:ring-2 focus:outline-none ${
                  positionFilter === null
                    ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                    : "border border-[var(--staffly-border)] bg-[var(--staffly-control)] text-[var(--staffly-text)] hover:bg-[var(--staffly-control-hover)]"
                }`}
              >
                Все должности
              </button>
              {positions.map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => handlePositionFilterChange(pos.id)}
                  className={`inline-flex h-9 shrink-0 items-center justify-center rounded-2xl px-4 text-xs font-semibold shadow-sm transition focus:ring-2 focus:outline-none ${
                    positionFilter === pos.id
                      ? "bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                      : "border border-[var(--staffly-border)] bg-[var(--staffly-control)] text-[var(--staffly-text)] hover:bg-[var(--staffly-control-hover)]"
                  }`}
                >
                  {pos.name}
                </button>
              ))}
            </div>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[var(--staffly-surface)] to-transparent" />
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {isListLoading && <Card className="text-muted text-sm">Загрузка чек-листов…</Card>}
        {error && <Card className="text-sm text-red-700 dark:text-red-300">{error}</Card>}
        {itemActionError && <Card className="text-sm text-red-700 dark:text-red-300">{itemActionError}</Card>}
        {!isListLoading && !error && visibleChecklists.length === 0 && (
          <Card className="text-muted text-sm">{emptyStateLabel}</Card>
        )}
        {!isListLoading &&
          !error &&
          visibleChecklists.map((checklist) => {
            const isExpanded = expandedId === checklist.id;
            const isTrackable = checklist.kind === "TRACKABLE";
            const isResetting = resetting === checklist.id;
            const isDownloading = downloading === checklist.id;
            const itemGroups = groupChecklistItems(checklist.items);
            const workSummary = isTrackable ? getChecklistWorkSummary(checklist, itemGroups) : null;
            const activeItems = itemGroups[activeItemTab];
            const total = getChecklistItemTotal(itemGroups);
            const doneCount = itemGroups.done.length;

            return (
              <div
                key={checklist.id}
                className="border-subtle bg-app/70 rounded-2xl border p-4"
                ref={(node) => setChecklistRef(checklist.id, node)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="ring-default min-w-0 flex-1 cursor-pointer rounded-xl text-left focus:ring-2 focus:outline-none"
                    onClick={() => toggleExpanded(checklist)}
                    role="button"
                    aria-expanded={isExpanded}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleExpanded(checklist);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {isTrackable && workSummary && (
                        <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                          <ChecklistProgressIndicator summary={workSummary} doneCount={doneCount} total={total} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-strong text-base leading-6 font-semibold [overflow-wrap:anywhere]">
                          {checklist.name}
                        </div>
                        <div className="text-muted mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                          {isTrackable && checklist.periodLabel && (
                            <span className="text-default flex items-center gap-1">
                              <Icon icon={Clock} size="xs" decorative />
                              {checklist.periodLabel}
                            </span>
                          )}
                          {isTrackable && checklist.periodLabel && checklist.positions.length > 0 && (
                            <span className="text-muted/40" aria-hidden>·</span>
                          )}
                          {checklist.positions.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {checklist.positions.slice(0, 3).map((p) => (
                                <span
                                  key={p.id}
                                  className="text-muted bg-[var(--staffly-control)] rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase"
                                >
                                  {p.name || positionNames.get(p.id) || `Должность #${p.id}`}
                                </span>
                              ))}
                              {checklist.positions.length > 3 && (
                                <span className="text-muted bg-[var(--staffly-control-hover)] rounded-full px-2 py-0.5 text-[11px] font-bold">
                                  +{checklist.positions.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted/50 tracking-wide uppercase">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {workSummary && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 pl-6">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${workSummary.badgeClassName}`}
                        >
                          {workSummary.label}
                        </span>
                        <span className="text-muted text-xs">{workSummary.detail}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canManage && (
                      <div className="relative" ref={(node) => setActionMenuRef(checklist.id, node)}>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => toggleActionMenu(checklist.id)}
                          disabled={isDownloading}
                          className="text-default min-h-9 min-w-9 sm:min-h-9 sm:min-w-9"
                          aria-haspopup="menu"
                          aria-expanded={actionMenuFor === checklist.id}
                          aria-controls={actionMenuFor === checklist.id ? `action-menu-${checklist.id}` : undefined}
                          aria-label="Действия с чек-листом"
                        >
                          <Icon icon={MoreHorizontal} size="sm" />
                        </Button>
                        {actionMenuFor === checklist.id && (
                          <div
                            id={`action-menu-${checklist.id}`}
                            role="menu"
                            className="border-subtle bg-surface absolute right-0 z-10 mt-2 w-48 rounded-2xl border p-1 shadow-[var(--staffly-shadow)]"
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-default w-full justify-start text-sm"
                              leftIcon={<Icon icon={Download} size="sm" decorative />}
                              onClick={() => handleDownloadJpg(checklist)}
                              disabled={isDownloading}
                              role="menuitem"
                            >
                              Скачать .jpg
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-default w-full justify-start text-sm"
                              leftIcon={<Icon icon={Pencil} size="sm" decorative />}
                              onClick={() => {
                                setActionMenuFor(null);
                                openEditDialog(checklist);
                              }}
                              role="menuitem"
                            >
                              Редактировать
                            </Button>
                            {isTrackable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-default w-full justify-start text-sm"
                                leftIcon={<Icon icon={History} size="sm" decorative />}
                                onClick={() => {
                                  setActionMenuFor(null);
                                  void openHistoryModal(checklist);
                                }}
                                role="menuitem"
                              >
                                История
                              </Button>
                            )}
                            <Button
                              variant="danger-ghost"
                              size="sm"
                              className="mt-1 w-full justify-start text-sm shadow-none"
                              leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                              onClick={() => {
                                setActionMenuFor(null);
                                openDeleteDialog(checklist);
                              }}
                              role="menuitem"
                            >
                              Удалить
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className="text-muted hover:text-default flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[color:var(--staffly-control-hover)]"
                      onClick={() => toggleExpanded(checklist)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Свернуть" : "Открыть"}
                    >
                      <div
                        className={`flex items-center justify-center transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <Icon icon={ChevronDown} size="sm" />
                      </div>
                    </button>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={PANEL_COLLAPSED}
                      animate={PANEL_EXPANDED}
                      exit={PANEL_COLLAPSED}
                      transition={EXPANDED_PANEL_TRANSITION}
                      className="mt-4 overflow-hidden"
                    >
                      <div className="border-subtle bg-surface text-default rounded-xl border text-sm sm:rounded-2xl">
                        {isTrackable ? (
                          <div>
                            <div className="border-subtle bg-app/50 flex gap-1 border-b p-1.5 sm:p-2">
                              {CHECKLIST_ITEM_TABS.map((tab) => (
                                <button
                                  key={tab.key}
                                  type="button"
                                  onClick={() => setActiveItemTab(tab.key)}
                                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition focus:outline-none ${
                                    activeItemTab === tab.key
                                      ? "text-[var(--staffly-text-strong)]"
                                      : "text-muted hover:text-default hover:bg-[color:var(--staffly-control-hover)]"
                                  }`}
                                >
                                  {activeItemTab === tab.key && (
                                    <motion.div
                                      layoutId={`active-tab-${checklist.id}`}
                                      className="absolute inset-0 z-0 rounded-xl bg-[var(--staffly-surface)] shadow-sm"
                                      transition={ACTIVE_TAB_TRANSITION}
                                    />
                                  )}
                                  <span className="relative z-10">{tab.label}</span>
                                  <span className="text-muted relative z-10 rounded-full bg-[var(--staffly-control)] px-2 py-0.5 text-[10px] font-bold tabular-nums">
                                    {itemGroups[tab.key].length}
                                  </span>
                                </button>
                              ))}
                            </div>

                            <AnimatePresence mode="wait">
                              <motion.div
                                key={activeItemTab}
                                initial={TAB_CONTENT_ENTER}
                                animate={TAB_CONTENT_VISIBLE}
                                exit={TAB_CONTENT_EXIT}
                                transition={TAB_CONTENT_TRANSITION}
                              >
                                {activeItems.length === 0 ? (
                                  <div className="text-muted px-4 py-8 text-center text-sm">
                                    {EMPTY_ITEM_TAB_MESSAGES[activeItemTab]}
                                  </div>
                                ) : (
                                  <div className="overflow-hidden">
                                    {activeItems.map((item) => {
                                      const reserveKey = `${checklist.id}-${item.id}-reserve`;
                                      const unreserveKey = `${checklist.id}-${item.id}-unreserve`;
                                      const completeKey = `${checklist.id}-${item.id}-complete`;
                                      const undoKey = `${checklist.id}-${item.id}-undo`;
                                      const reserveLoading = itemActionLoading.has(reserveKey);
                                      const unreserveLoading = itemActionLoading.has(unreserveKey);
                                      const completeLoading = itemActionLoading.has(completeKey);
                                      const undoLoading = itemActionLoading.has(undoKey);
                                      const isBusy =
                                        reserveLoading || unreserveLoading || completeLoading || undoLoading;
                                      const mediaKey = `${checklist.id}-${item.id}`;
                                      const completionPhotoKey = `${checklist.id}-${item.id}-completion-photo`;
                                      const isMediaExpanded = mediaExpanded.has(mediaKey);
                                      const isPhotoUploading = photoUploading.has(completionPhotoKey);
                                      const hasExamplePhoto = hasPhoto(item.examplePhotoUrl);
                                      const hasCompletionPhoto = hasPhoto(item.completionPhotoUrl);
                                      const missingRequiredPhoto = item.completionPhotoRequired && !hasCompletionPhoto;
                                      const statusLabel = item.done
                                        ? "Готово"
                                        : item.reservedBy
                                          ? "В работе"
                                          : "Свободно";
                                      const doneByName = item.doneBy?.name ?? "без автора";
                                      const reservedByName = item.reservedBy?.name ?? "сотрудник";
                                      const statusClass = item.done
                                        ? "border-emerald-300 bg-emerald-50 text-default dark:border-emerald-500/45 dark:bg-emerald-500/15"
                                        : item.reservedBy
                                          ? "border-amber-300 bg-amber-50 text-default dark:border-amber-500/45 dark:bg-amber-500/15"
                                          : "border-subtle bg-[color:var(--staffly-control)] text-default";
                                      const itemRowClass = item.done
                                        ? "bg-emerald-50/30 dark:bg-emerald-500/[0.06]"
                                        : item.reservedBy
                                          ? "bg-amber-50/25 dark:bg-amber-500/[0.06]"
                                          : "bg-surface";
                                      const shouldShowMedia =
                                        isMediaExpanded ||
                                        hasExamplePhoto ||
                                        hasCompletionPhoto ||
                                        item.completionPhotoRequired;
                                      const canToggleOptionalMedia =
                                        !item.done &&
                                        !hasExamplePhoto &&
                                        !hasCompletionPhoto &&
                                        !item.completionPhotoRequired;
                                      return (
                                        <div
                                          key={item.id}
                                          className={`border-subtle border-b px-2.5 py-3 transition-colors last:border-b-0 sm:px-4 ${itemRowClass}`}
                                        >
                                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                                            <div className="min-w-0 flex-1">
                                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <span
                                                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass}`}
                                                >
                                                  {statusLabel}
                                                </span>
                                                {item.completionPhotoRequired && (
                                                  <span
                                                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                                                      missingRequiredPhoto
                                                        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-500/45 dark:bg-red-500/15 dark:text-red-200"
                                                        : "text-default border-emerald-300 bg-emerald-50 dark:border-emerald-500/45 dark:bg-emerald-500/15"
                                                    }`}
                                                  >
                                                    {missingRequiredPhoto ? "Нужно фото" : "Фото приложено"}
                                                  </span>
                                                )}
                                                {hasExamplePhoto && (
                                                  <span className="border-subtle bg-surface text-default inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                                                    <Icon icon={ImageIcon} size="xs" decorative />
                                                    Есть эталон
                                                  </span>
                                                )}
                                              </div>
                                              <ContentText
                                                className={`text-[15px] leading-6 [overflow-wrap:anywhere] ${
                                                  item.done ? "text-muted line-through" : "text-strong"
                                                }`}
                                              >
                                                {item.text}
                                              </ContentText>
                                              <div className="text-muted mt-1 text-xs">
                                                {item.done ? (
                                                  <>
                                                    Выполнил:{" "}
                                                    <span className="text-default font-medium">{doneByName}</span>
                                                    {item.doneAt ? ` · ${formatDateTime(item.doneAt)}` : ""}
                                                  </>
                                                ) : item.reservedBy ? (
                                                  <>
                                                    <span className="text-strong font-semibold">{reservedByName}</span>{" "}
                                                    взял пункт в работу
                                                  </>
                                                ) : (
                                                  "Можно брать в работу"
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-end gap-1.5 md:max-w-[9rem] md:justify-self-end">
                                              {canToggleOptionalMedia && (
                                                <Button
                                                  variant="outline"
                                                  size="icon"
                                                  className="h-9 w-9 rounded-xl shadow-none"
                                                  leftIcon={
                                                    <Icon icon={isMediaExpanded ? X : Camera} size="sm" decorative />
                                                  }
                                                  aria-label={isMediaExpanded ? "Свернуть фото" : "Показать фото"}
                                                  title={isMediaExpanded ? "Свернуть фото" : "Показать фото"}
                                                  onClick={() => toggleMediaExpanded(checklist.id, item.id)}
                                                />
                                              )}
                                              {!item.done && !item.reservedBy && (
                                                <Button
                                                  variant="outline"
                                                  size="icon"
                                                  className="h-9 w-9 rounded-xl shadow-none"
                                                  leftIcon={
                                                    !reserveLoading ? (
                                                      <Icon icon={Lock} size="sm" decorative />
                                                    ) : undefined
                                                  }
                                                  aria-label="Взять в работу"
                                                  title="Взять в работу"
                                                  disabled={isBusy}
                                                  isLoading={reserveLoading}
                                                  onClick={() =>
                                                    handleItemAction(reserveKey, () =>
                                                      reserveChecklistItem(restaurantId, checklist.id, item.id),
                                                    )
                                                  }
                                                />
                                              )}
                                              {!item.done && item.reservedBy && (
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-9 w-9 rounded-xl shadow-none"
                                                  leftIcon={
                                                    !unreserveLoading ? (
                                                      <Icon icon={Unlock} size="sm" decorative />
                                                    ) : undefined
                                                  }
                                                  aria-label="Снять бронь"
                                                  title="Снять бронь"
                                                  disabled={isBusy}
                                                  isLoading={unreserveLoading}
                                                  onClick={() =>
                                                    handleItemAction(unreserveKey, () =>
                                                      unreserveChecklistItem(restaurantId, checklist.id, item.id),
                                                    )
                                                  }
                                                />
                                              )}
                                              {!item.done && (
                                                <Button
                                                  size="icon"
                                                  className="h-9 w-9 rounded-xl shadow-none"
                                                  leftIcon={
                                                    !completeLoading ? (
                                                      <Icon icon={Check} size="sm" decorative />
                                                    ) : undefined
                                                  }
                                                  aria-label="Отметить как готово"
                                                  title="Отметить как готово"
                                                  disabled={isBusy || missingRequiredPhoto}
                                                  isLoading={completeLoading}
                                                  onClick={() =>
                                                    handleItemAction(completeKey, () =>
                                                      completeChecklistItem(restaurantId, checklist.id, item.id),
                                                    )
                                                  }
                                                />
                                              )}
                                              {item.done && canManage && (
                                                <Button
                                                  variant="outline"
                                                  size="icon"
                                                  className="h-9 w-9 rounded-xl shadow-none"
                                                  leftIcon={
                                                    !undoLoading ? <Icon icon={X} size="sm" decorative /> : undefined
                                                  }
                                                  aria-label="Снять выполнение"
                                                  title="Снять выполнение"
                                                  disabled={isBusy}
                                                  isLoading={undoLoading}
                                                  onClick={() =>
                                                    handleItemAction(undoKey, () =>
                                                      undoChecklistItem(restaurantId, checklist.id, item.id),
                                                    )
                                                  }
                                                />
                                              )}
                                            </div>
                                          </div>
                                          {shouldShowMedia && (
                                            <div className="border-subtle mt-3 grid grid-cols-2 gap-2 border-t pt-3 md:gap-3">
                                              <div className="border-subtle bg-surface rounded-xl border p-2 sm:p-3">
                                                <div className="text-muted mb-2 flex items-center gap-2 text-xs font-medium">
                                                  <Icon icon={ImageIcon} size="xs" decorative />
                                                  <span>Эталон</span>
                                                </div>
                                                {hasExamplePhoto ? (
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setPhotoPreview({
                                                        title: "Эталон результата",
                                                        description: item.text,
                                                        url: item.examplePhotoUrl!,
                                                      })
                                                    }
                                                    className="group hover:bg-app focus:ring-default flex w-full flex-col gap-2 rounded-lg text-left transition focus:ring-2 focus:outline-none xl:flex-row xl:items-center"
                                                  >
                                                    <img
                                                      src={item.examplePhotoUrl!}
                                                      alt={`Эталон результата: ${item.text}`}
                                                      className="h-20 w-full shrink-0 rounded-lg object-cover sm:h-24 xl:h-20 xl:w-28"
                                                    />
                                                    <span className="min-w-0">
                                                      <span className="text-default block text-xs leading-4 font-medium sm:text-sm">
                                                        Фото от менеджера
                                                      </span>
                                                      <span className="text-muted group-hover:text-default mt-0.5 block text-[11px] leading-4 sm:text-xs">
                                                        Открыть крупно
                                                      </span>
                                                    </span>
                                                  </button>
                                                ) : (
                                                  <div className="border-subtle bg-app/50 text-muted flex min-h-20 items-center gap-2 rounded-lg border border-dashed p-2 text-xs sm:text-sm">
                                                    <Icon icon={ImageIcon} decorative />
                                                    <span>Эталон не добавлен</span>
                                                  </div>
                                                )}
                                              </div>
                                              <div
                                                className={`rounded-xl border p-2 sm:p-3 ${
                                                  missingRequiredPhoto
                                                    ? "border-red-300 bg-red-50/70 dark:border-red-500/45 dark:bg-red-500/10"
                                                    : "border-subtle bg-surface"
                                                }`}
                                              >
                                                <div className="text-muted mb-2 flex items-center gap-2 text-xs font-medium">
                                                  <Icon icon={Camera} size="xs" decorative />
                                                  <span>Фото выполнения</span>
                                                </div>
                                                <div className="flex flex-col gap-2 xl:flex-row">
                                                  {hasCompletionPhoto ? (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setPhotoPreview({
                                                          title: "Фото выполнения",
                                                          description: item.text,
                                                          url: item.completionPhotoUrl!,
                                                        })
                                                      }
                                                      className="focus:ring-default shrink-0 rounded-lg focus:ring-2 focus:outline-none"
                                                    >
                                                      <img
                                                        src={item.completionPhotoUrl!}
                                                        alt={`Фото выполнения: ${item.text}`}
                                                        className="h-20 w-full rounded-lg object-cover sm:h-24 xl:h-20 xl:w-28"
                                                      />
                                                    </button>
                                                  ) : (
                                                    <div className="border-subtle bg-app/50 text-muted flex h-20 w-full shrink-0 items-center justify-center rounded-lg border border-dashed sm:h-24 xl:h-20 xl:w-28">
                                                      <Icon icon={Camera} decorative />
                                                    </div>
                                                  )}
                                                  <div className="min-w-0 flex-1">
                                                    <div className="text-default text-xs leading-4 font-medium sm:text-sm">
                                                      {hasCompletionPhoto ? "Фото прикреплено" : "Фото еще нет"}
                                                    </div>
                                                    <div
                                                      className={`mt-0.5 text-[11px] leading-4 sm:text-xs ${
                                                        missingRequiredPhoto
                                                          ? "text-red-700 dark:text-red-200"
                                                          : "text-muted"
                                                      }`}
                                                    >
                                                      {hasCompletionPhoto
                                                        ? `${item.completionPhotoUploadedBy?.name || "Сотрудник"} · ${formatDateTime(
                                                            item.completionPhotoUploadedAt,
                                                          )}`
                                                        : item.completionPhotoRequired
                                                          ? "Без фото пункт нельзя закрыть"
                                                          : "Можно приложить при необходимости"}
                                                    </div>
                                                    {!item.done && (
                                                      <div className="mt-2 flex flex-col gap-2 xl:flex-row xl:flex-wrap">
                                                        <label
                                                          className={`border-subtle text-default inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border bg-[var(--staffly-control)] px-2 text-sm font-medium transition hover:bg-[var(--staffly-control-hover)] xl:min-h-9 xl:w-auto xl:px-3 ${
                                                            isPhotoUploading ? "pointer-events-none opacity-60" : ""
                                                          }`}
                                                          aria-disabled={isPhotoUploading}
                                                        >
                                                          <Icon icon={Camera} size="sm" decorative />
                                                          <span>{hasCompletionPhoto ? "Заменить" : "Прикрепить"}</span>
                                                          <input
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp"
                                                            className="hidden"
                                                            disabled={isPhotoUploading}
                                                            onChange={(event) => {
                                                              const file = event.target.files?.[0];
                                                              if (file) {
                                                                void handleCompletionPhotoUpload(checklist, item, file);
                                                              }
                                                              event.target.value = "";
                                                            }}
                                                          />
                                                        </label>
                                                        {hasCompletionPhoto && (
                                                          <Button
                                                            type="button"
                                                            variant="danger-ghost"
                                                            onClick={() => handleCompletionPhotoDelete(checklist, item)}
                                                            disabled={isPhotoUploading}
                                                            className="min-h-12 w-full text-sm sm:min-h-9 sm:w-auto"
                                                          >
                                                            Удалить
                                                          </Button>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                                {isPhotoUploading && (
                                                  <div className="text-muted mt-2 text-xs">Загружаем фото...</div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </motion.div>
                            </AnimatePresence>
                            {canManage && (
                              <div className="border-subtle bg-app/40 mt-1 flex flex-wrap gap-2 border-t px-3 py-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReset(checklist)}
                                  disabled={isResetting}
                                  aria-label="Сбросить чек-лист"
                                  title="Сбросить чек-лист"
                                  className="h-9 rounded-xl px-3 shadow-none"
                                >
                                  {isResetting ? "Сбрасываем…" : "Сбросить"}
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <ContentText className="p-4 [overflow-wrap:anywhere]">{checklist.content ?? ""}</ContentText>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
      </div>

      <ChecklistDialog
        open={dialogOpen}
        title={createDialogTitle}
        positions={positions}
        initialData={dialogInitial}
        submitting={dialogSubmitting}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={handleSubmitDialog}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Удалить чек-лист «${deleteTarget.name}»?` : ""}
        description="Это действие нельзя будет отменить"
        confirming={deleting}
        confirmText="Удалить"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={closeDeleteDialog}
      />

      <Modal
        open={Boolean(historyTarget)}
        title={historyTarget ? `История: ${historyTarget.name}` : "История"}
        onClose={closeHistoryModal}
        className="max-w-5xl"
        footer={
          <Button
            variant="outline"
            onClick={closeHistoryModal}
            disabled={historyLoading || historyDetailLoading !== null}
          >
            Закрыть
          </Button>
        }
      >
        <div className="space-y-4">
          {historyError && (
            <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
              {historyError}
            </div>
          )}
          {historyLoading && <div className="text-muted text-sm">Загрузка истории…</div>}
          {!historyLoading && historySummaries.length === 0 && (
            <div className="border-subtle text-muted rounded-2xl border p-4 text-sm">История пока не записана.</div>
          )}
          {historySummaries.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-2">
                {historySummaries.map((summary) => {
                  const selected = historyDetail?.id === summary.id;
                  return (
                    <button
                      key={summary.id}
                      type="button"
                      onClick={() => void loadHistoryDetail(summary.id)}
                      className={`w-full rounded-2xl border p-3 text-left text-sm transition ${
                        selected
                          ? "bg-app text-default border-[var(--staffly-text-strong)]"
                          : "border-subtle bg-surface text-default hover:bg-app"
                      }`}
                    >
                      <div className="font-medium">{formatDateTime(summary.resetAt)}</div>
                      <div className="text-muted mt-1 text-xs">
                        {resetReasonLabel(summary.resetReason)} · {summary.completedItems}/{summary.totalItems}
                      </div>
                      {historyDetailLoading === summary.id && <div className="text-muted mt-1 text-xs">Открываем…</div>}
                    </button>
                  );
                })}
              </div>

              <div className="border-subtle min-w-0 rounded-2xl border p-3">
                {!historyDetail && !historyDetailLoading && (
                  <div className="text-muted text-sm">Выберите запись истории.</div>
                )}
                {historyDetail && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-strong text-sm font-semibold">
                        {formatDateTime(historyDetail.resetAt)} · {resetReasonLabel(historyDetail.resetReason)}
                      </div>
                      <div className="text-muted mt-1 text-xs">
                        Выполнено {historyDetail.completedItems}/{historyDetail.totalItems}
                        {historyDetail.positionsSnapshot ? ` · ${historyDetail.positionsSnapshot}` : ""}
                      </div>
                      {historyDetail.startedAt && (
                        <div className="text-muted mt-1 text-xs">
                          Период с {formatDateTime(historyDetail.startedAt)}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {historyDetail.items.map((item) => (
                        <div key={item.id} className="border-subtle bg-app/60 rounded-2xl border p-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <ContentText className="text-default min-w-0 text-sm [overflow-wrap:anywhere]">
                              {item.itemOrder}. {item.text}
                            </ContentText>
                            <div className={`text-xs ${item.done ? "text-default font-medium" : "text-muted"}`}>
                              {item.done ? "Выполнено" : "Не выполнено"}
                            </div>
                          </div>
                          <div className="text-muted mt-2 text-xs">
                            {item.done
                              ? `Исполнитель: ${item.doneBy?.name || item.doneByName || "—"}`
                              : item.reservedBy?.name || item.reservedByName
                                ? `Было в работе: ${item.reservedBy?.name || item.reservedByName}`
                                : "Исполнитель: —"}
                            {item.doneAt ? ` · ${formatDateTime(item.doneAt)}` : ""}
                          </div>
                          {(item.examplePhotoUrl || item.completionPhotoUrl) && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {item.examplePhotoUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPhotoPreview({
                                      title: "Эталон из истории",
                                      description: item.text,
                                      url: item.examplePhotoUrl!,
                                    })
                                  }
                                  className="border-subtle bg-surface hover:bg-app focus:ring-default rounded-xl border p-2 text-left transition focus:ring-2 focus:outline-none"
                                >
                                  <div className="text-muted mb-2 text-xs font-medium">Эталон</div>
                                  <img
                                    src={item.examplePhotoUrl}
                                    alt={`Эталон из истории: ${item.text}`}
                                    className="h-36 w-full rounded-lg object-cover"
                                  />
                                </button>
                              )}
                              {item.completionPhotoUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPhotoPreview({
                                      title: "Фото выполнения из истории",
                                      description: item.text,
                                      url: item.completionPhotoUrl!,
                                    })
                                  }
                                  className="border-subtle bg-surface hover:bg-app focus:ring-default rounded-xl border p-2 text-left transition focus:ring-2 focus:outline-none"
                                >
                                  <div className="text-muted mb-2 text-xs font-medium">Фото выполнения</div>
                                  <img
                                    src={item.completionPhotoUrl}
                                    alt={`Фото выполнения из истории: ${item.text}`}
                                    className="h-36 w-full rounded-lg object-cover"
                                  />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(photoPreview)}
        title={photoPreview?.title ?? "Фото"}
        description={photoPreview?.description}
        onClose={closePhotoPreview}
        className="max-w-3xl"
        footer={
          <Button variant="outline" onClick={closePhotoPreview}>
            Закрыть
          </Button>
        }
      >
        {photoPreview && (
          <div className="bg-app rounded-2xl p-2">
            <img
              src={photoPreview.url}
              alt={photoPreview.title}
              className="max-h-[70dvh] w-full rounded-xl object-contain"
            />
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default RestaurantChecklists;

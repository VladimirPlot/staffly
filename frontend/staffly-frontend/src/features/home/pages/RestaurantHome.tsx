import React from "react";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import { useAuth } from "../../../shared/providers/AuthProvider";
import DashboardGrid, { type DashboardCardItem } from "../components/DashboardGrid";
import { useDashboardDnD } from "../hooks/useDashboardDnD";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import AnnouncementsPreviewCard from "../components/AnnouncementsPreviewCard";
import Toast from "../components/Toast";
import { useRestaurantHomeData } from "../hooks/useRestaurantHomeData";
import { useAnnouncementsPreviewVisibility } from "../hooks/useAnnouncementsPreviewVisibility";
import { useOutsidePointerDown } from "../hooks/useOutsidePointerDown";
import { useMeasuredHeight } from "../hooks/useMeasuredHeight";
import { useViewportHeight } from "../hooks/useViewportHeight";
import {
  AlarmClock,
  CalendarCog,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutList,
  ListChecks,
  MailQuestion,
  Megaphone,
  Phone,
  Users,
} from "lucide-react";

type DashboardAccess = {
  canAccessContacts: boolean;
  canAccessMasterSchedules: boolean;
  canAccessSchedules: boolean;
  canManageNotifications: boolean;
  hasUnreadAnonymousLetters: boolean;
  hasScheduleIndicator: boolean;
  isManagerLike: boolean;
  shouldShowNotificationsEntry: boolean;
};

function normalizeOrder(layout: string[], availableIds: string[]): string[] {
  const order = new Set<string>();
  layout.forEach((id) => {
    if (availableIds.includes(id)) order.add(id);
  });
  availableIds.forEach((id) => order.add(id));
  return Array.from(order);
}

function createDashboardCards(access: DashboardAccess): DashboardCardItem[] {
  const cards: DashboardCardItem[] = [];

  cards.push({
    id: "employees",
    title: "Сотрудники",
    description: "Приглашайте сотрудников и назначайте роли/позиции.",
    to: "/employees/invite",
    icon: Users,
  });

  if (access.shouldShowNotificationsEntry) {
    cards.push({
      id: "announcements",
      title: "Объявления",
      description: access.canManageNotifications
        ? "Создавайте и редактируйте сообщения для сотрудников."
        : "Посмотрите новые сообщения от руководства.",
      to: "/announcements",
      icon: Megaphone,
    });
  }

  if (access.canAccessContacts) {
    cards.push({
      id: "contacts",
      title: "Контакты",
      description: "Храните телефоны и информацию о важных поставщиках и службах.",
      to: "/contacts",
      icon: Phone,
    });
  }

  cards.push({
    id: "anonymous-letter",
    title: "Анонимное письмо",
    description: "Отправьте обращение руководителю ресторана или прочитайте новые письма.",
    to: "/anonymous-letter",
    icon: MailQuestion,
    showIndicator: access.hasUnreadAnonymousLetters,
  });

  if (access.canAccessSchedules) {
    cards.push({
      id: "schedule",
      title: "График",
      description: "Создавайте смены и распределяйте сотрудников по дням.",
      to: "/schedule",
      icon: CalendarDays,
      showIndicator: access.hasScheduleIndicator,
    });
  }

  if (access.canAccessMasterSchedules) {
    cards.push({
      id: "master-schedule",
      title: "Мастер график",
      description: "Планируйте ФОТ и рассчитывайте LC% по периодам.",
      to: "/master-schedules",
      icon: CalendarCog,
    });
  }

  cards.push({
    id: "training",
    title: "Тренинг",
    description: "Категории и карточки меню, бара, вина, сервиса и аттестация",
    to: "/training",
    icon: GraduationCap,
  });

  cards.push({
    id: "tasks",
    title: "Доска задач",
    description: "Назначайте задачи сотрудникам и следите за сроками.",
    to: "/tasks",
    icon: LayoutList,
  });

  if (access.isManagerLike) {
    cards.push({
      id: "inventories-dishware",
      title: "Инвентаризации",
      description: "Ведите инвентаризации посуды по документам и отслеживайте расхождения.",
      to: "/inventories",
      icon: ClipboardList,
    });
  }

  cards.push({
    id: "checklists",
    title: "Чек-листы",
    description: "Готовые инструкции для сотрудников",
    to: "/checklists",
    icon: ListChecks,
  });

  cards.push({
    id: "reminders",
    title: "Напоминания",
    description: "Регулярные напоминания для сотрудников и команд",
    to: "/reminders",
    icon: AlarmClock,
  });

  return cards;
}

function getReorderContainerStyle(
  isReorderMode: boolean,
  availableScrollHeight?: number
): React.CSSProperties | undefined {
  if (!isReorderMode) {
    return undefined;
  }

  return {
    maxHeight:
      availableScrollHeight != null
        ? `calc(${availableScrollHeight}px - env(safe-area-inset-bottom, 0px))`
        : undefined,
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    overscrollBehavior: "contain",
    scrollbarGutter: "stable",
    padding: 10,
    marginLeft: -10,
    marginRight: -10,
  };
}

function renderAnnouncementsSection(params: {
  announcementsPreview: React.ComponentProps<typeof AnnouncementsPreviewCard>["announcements"];
  announcementsPreviewHidden: boolean;
  canManageNotifications: boolean;
  hasRelevantNotifications: boolean;
  hideAnnouncementsPreview: () => void;
  showAnnouncementsPreview: () => void;
}) {
  const {
    announcementsPreview,
    announcementsPreviewHidden,
    canManageNotifications,
    hasRelevantNotifications,
    hideAnnouncementsPreview,
    showAnnouncementsPreview,
  } = params;

  if (canManageNotifications || !hasRelevantNotifications) {
    return null;
  }

  if (announcementsPreviewHidden) {
    return (
      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-sm text-zinc-600"
          onClick={showAnnouncementsPreview}
        >
          Показать объявления
        </Button>
      </div>
    );
  }

  return (
    <AnnouncementsPreviewCard
      announcements={announcementsPreview}
      onHide={hideAnnouncementsPreview}
    />
  );
}

export default function RestaurantHome() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const userId = user?.id ?? null;

  const {
    restaurantName,
    access,
    announcementsPreview,
    savedSchedules,
    hasUnreadAnonymousLetters,
    hasUnreadScheduleEvents,
  } = useRestaurantHomeData({ restaurantId, userRoles: user?.roles });

  const {
    hidden: announcementsPreviewHidden,
    hide: hideAnnouncementsPreview,
    show: showAnnouncementsPreview,
  } = useAnnouncementsPreviewVisibility(restaurantId, userId);

  const {
    layout,
    setLayout,
    isLoading: isLayoutLoading,
    loadError,
    persistLayout,
  } = useDashboardLayout(restaurantId);

  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const handleToastClose = React.useCallback(() => setToastMessage(null), []);

  const canAccessSchedules = access.isAdminLike || Boolean(access.normalizedRestaurantRole);
  const canManageNotifications = access.isAdminLike || access.normalizedRestaurantRole === "MANAGER";
  const canAccessContacts = access.isManagerLike;
  const canAccessMasterSchedules = access.isManagerLike;
  const hasRelevantNotifications = announcementsPreview.length > 0;
  const shouldShowNotificationsEntry = canManageNotifications;

  const hasPendingSavedSchedules = React.useMemo(
    () => savedSchedules.some((item) => item.hasPendingShiftRequests),
    [savedSchedules]
  );

  const hasScheduleIndicator = hasPendingSavedSchedules || hasUnreadScheduleEvents;

  const dashboardAccess = React.useMemo<DashboardAccess>(
    () => ({
      canAccessContacts,
      canAccessMasterSchedules,
      canAccessSchedules,
      canManageNotifications,
      hasUnreadAnonymousLetters,
      hasScheduleIndicator,
      isManagerLike: access.isManagerLike,
      shouldShowNotificationsEntry,
    }),
    [
      canAccessContacts,
      canAccessMasterSchedules,
      canAccessSchedules,
      canManageNotifications,
      hasUnreadAnonymousLetters,
      hasScheduleIndicator,
      access.isManagerLike,
      shouldShowNotificationsEntry,
    ]
  );

  const dashboardCards = React.useMemo<DashboardCardItem[]>(
    () => createDashboardCards(dashboardAccess),
    [dashboardAccess]
  );

  const availableIds = React.useMemo(
    () => dashboardCards.map((card) => card.id),
    [dashboardCards]
  );

  const resolvedOrder = React.useMemo(
    () => normalizeOrder(layout, availableIds),
    [layout, availableIds]
  );

  const topContentRef = React.useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const topContentHeight = useMeasuredHeight(topContentRef);
  const viewportHeight = useViewportHeight();
  const availableScrollHeight = React.useMemo(() => {
    if (!viewportHeight) return undefined;
    return Math.max(viewportHeight - topContentHeight, 0);
  }, [topContentHeight, viewportHeight]);

  React.useEffect(() => {
    const current = layout.join("|");
    const resolved = resolvedOrder.join("|");
    if (current !== resolved) {
      setLayout(resolvedOrder);
    }
  }, [layout, resolvedOrder, setLayout]);

  const dashboardDnD = useDashboardDnD({
    items: resolvedOrder,
    onChange: setLayout,
    scrollContainerRef,
  });
  const { isReorderMode, isDragging, setIsReorderMode } = dashboardDnD;

  const exitReorderMode = React.useCallback(async () => {
    if (!isReorderMode) return;
    setIsReorderMode(false);
    const result = await persistLayout(layout);
    if (!result?.ok) {
      setToastMessage("Сервер сейчас недоступен, попробуйте позже");
    }
  }, [isReorderMode, layout, persistLayout, setIsReorderMode]);

  useOutsidePointerDown({
    enabled: isReorderMode,
    insideSelector: "[data-dashboard-card],[data-reorder-exit]",
    onOutside: () => {
      if (isDragging) return;
      void exitReorderMode();
    },
  });

  const announcementsSection = renderAnnouncementsSection({
    announcementsPreview,
    announcementsPreviewHidden,
    canManageNotifications,
    hasRelevantNotifications,
    hideAnnouncementsPreview,
    showAnnouncementsPreview,
  });

  const layoutStatus = isLayoutLoading ? (
    <div className="text-xs text-zinc-500">Загрузка порядка карточек…</div>
  ) : loadError ? (
    <div className="text-xs text-zinc-500">{loadError}</div>
  ) : null;

  const reorderAction = isReorderMode ? (
    <div className="flex justify-end">
      <Button
        variant="outline"
        size="sm"
        data-reorder-exit
        onClick={() => void exitReorderMode()}
      >
        Готово
      </Button>
    </div>
  ) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div ref={topContentRef} className="space-y-3">
        <Card>
          <div className="text-sm text-zinc-500">Ресторан</div>
          <h2 className="text-2xl font-semibold">{restaurantName || "…"}</h2>
        </Card>

        {announcementsSection}
        {layoutStatus}
        {reorderAction}
      </div>

      <div
        ref={scrollContainerRef}
        className="mt-3"
        style={getReorderContainerStyle(isReorderMode, availableScrollHeight)}
      >
        <DashboardGrid cards={dashboardCards} order={resolvedOrder} dndState={dashboardDnD} />
      </div>

      <Toast message={toastMessage} onClose={handleToastClose} />
    </div>
  );
}

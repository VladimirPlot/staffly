import React from "react";

import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import { useAuth } from "../../../shared/providers/AuthProvider";

import { ArrowLeft } from "lucide-react";
import Icon from "../../../shared/ui/Icon";

import ChangeScheduleOwnerDialog from "../components/ChangeScheduleOwnerDialog";
import CreateScheduleDialog from "../components/CreateScheduleDialog";
import SavedSchedulesSection from "../components/SavedSchedulesSection";
import ScheduleDetailHeader from "../components/ScheduleDetailHeader";
import ScheduleHistoryBlock from "../components/ScheduleHistoryBlock";
import ScheduleTableSection from "../components/ScheduleTableSection";
import ScheduleTabsNav from "../components/ScheduleTabsNav";
import ShiftReplacementDialog from "../components/ShiftReplacementDialog";
import ShiftRequestsSection from "../components/ShiftRequestsSection";
import ShiftSwapDialog from "../components/ShiftSwapDialog";
import TodayShiftsCard from "../components/TodayShiftsCard";
import useSavedScheduleActions from "../hooks/useSavedScheduleActions";
import useScheduleCellEditing from "../hooks/useScheduleCellEditing";
import useScheduleDraftActions from "../hooks/useScheduleDraftActions";
import useScheduleDerivedState from "../hooks/useScheduleDerivedState";
import useScheduleExportActions from "../hooks/useScheduleExportActions";
import useScheduleInitialData from "../hooks/useScheduleInitialData";
import useScheduleOwnerDialog from "../hooks/useScheduleOwnerDialog";
import useScheduleShiftRequests from "../hooks/useScheduleShiftRequests";
import useScheduleShiftRequestDialogs from "../hooks/useScheduleShiftRequestDialogs";
import type { ScheduleData, ScheduleOwnerDto } from "../types";
import { buildMemberDisplayNameMap } from "../utils/names";
import type { MemberDto } from "../../employees/api";
import { resolveRestaurantAccess } from "../../../shared/utils/access";

function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null;
  return role
    .toString()
    .toUpperCase()
    .replace(/^ROLE_/, "");
}

const SchedulePage: React.FC = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  const [schedule, setSchedule] = React.useState<ScheduleData | null>(null);
  const [scheduleReadOnly, setScheduleReadOnly] = React.useState(false);
  const [scheduleMessage, setScheduleMessage] = React.useState<string | null>(null);
  const [scheduleError, setScheduleError] = React.useState<string | null>(null);
  const [lastRange, setLastRange] = React.useState<{ start: string; end: string } | null>(null);
  const [positionFilter, setPositionFilter] = React.useState<number | "all">("all");
  const [activeTab, setActiveTab] = React.useState<"today" | "table" | "requests">("table");
  const [downloadMenuFor, setDownloadMenuFor] = React.useState<number | null>(null);

  const autoTabDoneRef = React.useRef(false);

  const scheduleId = schedule?.id ?? null;
  const clearScheduleNotices = React.useCallback(() => {
    setScheduleError(null);
    setScheduleMessage(null);
  }, []);

  const handleRestaurantMissing = React.useCallback(() => {
    setSchedule(null);
    setScheduleReadOnly(false);
    clearScheduleNotices();
  }, [clearScheduleNotices]);

  const handleBeforeInitialLoad = React.useCallback(() => {
    setSchedule(null);
    setScheduleReadOnly(false);
    clearScheduleNotices();
  }, [clearScheduleNotices]);

  const { loading, error, myRole, positions, members, savedSchedules, setSavedSchedules } = useScheduleInitialData({
    restaurantId,
    userRoles: user?.roles,
    onRestaurantMissing: handleRestaurantMissing,
    onBeforeLoad: handleBeforeInitialLoad,
  });

  const access = React.useMemo(
    () => resolveRestaurantAccess(user?.roles, myRole),
    [user?.roles, myRole],
  );

  const normalizedUserRoles = React.useMemo(() => {
    const result = new Set<string>();
    user?.roles?.forEach((role) => {
      const normalized = normalizeRole(role);
      if (normalized) {
        result.add(normalized);
      }
    });
    return result;
  }, [user?.roles]);

  const normalizedMembershipRole = React.useMemo(() => {
    if (!user?.id) return normalizeRole(myRole);
    const member = members.find((item) => item.userId === user.id);
    return normalizeRole(member?.role ?? myRole);
  }, [members, myRole, user?.id]);

  const canManage = React.useMemo(() => {
    if (normalizedMembershipRole === "STAFF") {
      return false;
    }

    if (normalizedMembershipRole === "ADMIN" || normalizedMembershipRole === "MANAGER") {
      return true;
    }

    if (access.normalizedRestaurantRole === "STAFF") {
      return false;
    }

    if (access.isCreator) {
      return true;
    }

    const allowedRoles = ["CREATOR", "ADMIN", "MANAGER"] as const;

    if (allowedRoles.some((role) => normalizedUserRoles.has(role))) {
      return true;
    }

    return (
      access.normalizedRestaurantRole != null && allowedRoles.some((role) => role === access.normalizedRestaurantRole)
    );
  }, [access.isCreator, access.normalizedRestaurantRole, normalizedMembershipRole, normalizedUserRoles]);

  const derived = useScheduleDerivedState({
    userId: user?.id,
    schedule,
    scheduleId,
    savedSchedules,
    members,
    canManage,
    positionFilter,
  });

  const prepareSchedule = React.useCallback(
    (data: ScheduleData): ScheduleData => {
      const memberMap = new Map(members.map((item) => [item.id, item] as const));

      const uniqueMembers = new Map<number, MemberDto>();
      data.rows.forEach((row) => {
        const candidate = row.member ?? memberMap.get(row.memberId);
        if (candidate) {
          uniqueMembers.set(candidate.id, candidate);
        }
      });

      const displayNames = buildMemberDisplayNameMap(Array.from(uniqueMembers.values()));

      const rows = data.rows.map((row) => {
        const member = row.member ?? memberMap.get(row.memberId) ?? undefined;
        return {
          ...row,
          member,
          displayName: displayNames[row.memberId] ?? row.displayName,
        };
      });

      return {
        ...data,
        config: { ...data.config, showFullName: false, shiftMode: "FULL" },
        rows,
      };
    },
    [members],
  );

  const handleScheduleOwnerUpdated = React.useCallback((updatedSchedule: ScheduleData) => {
    setSchedule(updatedSchedule);
  }, []);

  const handleSavedScheduleOwnerUpdated = React.useCallback(
    (updatedScheduleId: number, owner: ScheduleOwnerDto | null) => {
      setSavedSchedules((prev) =>
        prev.map((item) => (item.id === updatedScheduleId ? { ...item, owner } : item)),
      );
    },
    [setSavedSchedules],
  );

  const handleClearScheduleError = React.useCallback(() => {
    setScheduleError(null);
  }, []);

  const ownerDialog = useScheduleOwnerDialog({
    restaurantId,
    canManage,
    schedule,
    scheduleId,
    prepareSchedule,
    onScheduleUpdated: handleScheduleOwnerUpdated,
    onSavedScheduleOwnerUpdated: handleSavedScheduleOwnerUpdated,
    onSuccessMessage: setScheduleMessage,
    onClearScheduleError: handleClearScheduleError,
  });

  const handleShiftRequestScheduleUpdated = React.useCallback(
    (updatedSchedule: ScheduleData) => {
      const prepared = prepareSchedule(updatedSchedule);
      setSchedule(prepared);
      setScheduleReadOnly(true);
      setLastRange({ start: prepared.config.startDate, end: prepared.config.endDate });
    },
    [prepareSchedule],
  );

  const shiftRequests = useScheduleShiftRequests({
    restaurantId,
    scheduleId,
    currentMember: derived.currentMember,
    canManage,
    onClearScheduleNotices: clearScheduleNotices,
    onScheduleUpdated: handleShiftRequestScheduleUpdated,
    onSavedSchedulesUpdated: setSavedSchedules,
    onSuccessMessage: setScheduleMessage,
    onErrorMessage: setScheduleError,
  });
  const { load: loadShiftRequests, refresh: refreshShiftRequests } = shiftRequests;

  const shiftRequestDialogs = useScheduleShiftRequestDialogs({
    restaurantId,
    scheduleId,
    onClearScheduleNotices: clearScheduleNotices,
    onSuccessMessage: setScheduleMessage,
    onErrorMessage: setScheduleError,
    onRefreshShiftRequests: refreshShiftRequests,
  });

  const handleScheduleExportError = React.useCallback(
    (message: string) => {
      clearScheduleNotices();
      setScheduleError(message);
    },
    [clearScheduleNotices],
  );

  const exportActions = useScheduleExportActions({
    restaurantId,
    currentSchedule: schedule,
    onError: handleScheduleExportError,
  });

  const cellEditing = useScheduleCellEditing({
    onScheduleChanged: setSchedule,
  });

  const resetAutoTab = React.useCallback(() => {
    autoTabDoneRef.current = false;
  }, []);

  const draftActions = useScheduleDraftActions({
    restaurantId,
    canManage,
    schedule,
    members,
    positions,
    prepareSchedule,
    loadShiftRequests,
    onScheduleChanged: setSchedule,
    onScheduleReadOnlyChanged: setScheduleReadOnly,
    onSavedSchedulesChanged: setSavedSchedules,
    onLastRangeChanged: setLastRange,
    onClearScheduleNotices: clearScheduleNotices,
    onScheduleMessage: setScheduleMessage,
    onScheduleError: setScheduleError,
    onAutoTabReset: resetAutoTab,
  });

  const savedScheduleActions = useSavedScheduleActions({
    restaurantId,
    canManage,
    scheduleId,
    prepareSchedule,
    loadShiftRequests,
    onScheduleChanged: setSchedule,
    onSavedSchedulesChanged: setSavedSchedules,
    onScheduleReadOnlyChanged: setScheduleReadOnly,
    onLastRangeChanged: setLastRange,
    onClearScheduleNotices: clearScheduleNotices,
    onScheduleMessage: setScheduleMessage,
    onScheduleError: setScheduleError,
    onAutoTabReset: resetAutoTab,
  });
  const { closeSavedSchedule, deleteSavedSchedule, openSavedSchedule } = savedScheduleActions;

  const handleEnterEditMode = React.useCallback(() => {
    if (!canManage) return;
    setScheduleReadOnly(false);
    clearScheduleNotices();
  }, [canManage, clearScheduleNotices]);

  const handleCancelEdit = React.useCallback(async () => {
    if (!scheduleId) {
      closeSavedSchedule();
      return;
    }

    await openSavedSchedule(scheduleId);
  }, [closeSavedSchedule, openSavedSchedule, scheduleId]);

  const handleDeleteSchedule = React.useCallback(() => {
    if (!scheduleId) return;
    void deleteSavedSchedule(scheduleId);
  }, [deleteSavedSchedule, scheduleId]);

  React.useEffect(() => {
    if (!derived.hasSchedule) {
      setActiveTab("table");
      autoTabDoneRef.current = false;
      return;
    }

    if (!scheduleReadOnly) return;
    if (autoTabDoneRef.current) return;

    setActiveTab(derived.hasTodayShifts ? "today" : "table");
    autoTabDoneRef.current = true;
  }, [derived.hasSchedule, derived.hasTodayShifts, scheduleReadOnly]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6">
      <div className="text-default mb-3 flex flex-wrap items-center gap-3 text-sm">
        <BackToHome className="text-sm" />

        {schedule && (
          <button
            type="button"
            onClick={savedScheduleActions.closeSavedSchedule}
            className={
              "border-subtle inline-flex items-center gap-0 rounded-2xl border " +
              "bg-surface text-default px-2 py-1 text-sm font-medium shadow-[var(--staffly-shadow)] " +
              "hover:bg-app ring-default transition focus:ring-2 focus:outline-none"
            }
            title="Ко всем графикам"
            aria-label="Ко всем графикам"
          >
            <Icon icon={ArrowLeft} size="xs" decorative />
            <span>Ко всем графикам</span>
          </button>
        )}
      </div>
      {derived.showLandingHeader && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-strong text-2xl font-semibold">Графики</h1>
          </div>
          {derived.showCreateScheduleButton && (
            <Button onClick={draftActions.openDialog} disabled={loading} className="shrink-0">
              Создать график
            </Button>
          )}
        </div>
      )}

      {loading && <Card>Загрузка…</Card>}
      {!loading && error && <Card className="text-red-600">{error}</Card>}
      {!loading && !error && savedScheduleActions.scheduleLoading && (
        <Card>Загрузка сохранённого графика…</Card>
      )}
      {!loading && !error && scheduleError && (
        <Card className="border-red-200 bg-red-50 text-red-700">{scheduleError}</Card>
      )}
      {!loading && !error && scheduleMessage && (
        <Card className="border-emerald-200 bg-emerald-50 text-emerald-700">{scheduleMessage}</Card>
      )}

      {!loading && !error && !schedule && (
        <SavedSchedulesSection
          canManage={canManage}
          savedSchedules={derived.filteredSavedSchedules}
          positions={positions}
          positionFilter={positionFilter}
          onPositionFilterChange={setPositionFilter}
          onOpenSavedSchedule={savedScheduleActions.openSavedSchedule}
          onEditSavedSchedule={savedScheduleActions.editSavedSchedule}
          onDeleteSavedSchedule={savedScheduleActions.deleteSavedSchedule}
          onDownloadXlsx={exportActions.downloadXlsx}
          onDownloadJpg={exportActions.downloadJpg}
          downloadMenuFor={downloadMenuFor}
          onToggleDownloadMenu={setDownloadMenuFor}
          downloading={exportActions.downloading}
          selectedSavedId={savedScheduleActions.selectedSavedId}
          scheduleLoading={savedScheduleActions.scheduleLoading}
          hasPendingSavedSchedules={derived.hasPendingSavedSchedules}
          deletingId={savedScheduleActions.deletingId}
        />
      )}

      {!loading &&
        !error &&
        !canManage &&
        derived.filteredSavedSchedules.length === 0 &&
        !schedule &&
        !savedScheduleActions.scheduleLoading && (
          <Card>
            <div className="text-muted text-sm">
              Раздел доступен для просмотра. Как только менеджер сохранит график, он появится в списке выше.
            </div>
          </Card>
        )}

      {!loading &&
        !error &&
        canManage &&
        derived.filteredSavedSchedules.length === 0 &&
        !schedule &&
        !savedScheduleActions.scheduleLoading && (
          <Card>
            <div className="text-muted space-y-2 text-sm">
              <p>Пока график не создан. Нажмите «Создать график», чтобы настроить таблицу.</p>
              <p>Диапазон может включать не более 32 дней.</p>
            </div>
          </Card>
        )}

      {!loading && !error && schedule && !savedScheduleActions.scheduleLoading && (
        <div className="space-y-4">
          <ScheduleDetailHeader
            schedule={schedule}
            canManage={canManage}
            scheduleReadOnly={scheduleReadOnly}
            scheduleId={scheduleId}
            deleting={savedScheduleActions.deletingId === scheduleId}
            onEnterEditMode={handleEnterEditMode}
            onDelete={handleDeleteSchedule}
            onOpenOwnerDialog={ownerDialog.openDialog}
            downloadMenuFor={downloadMenuFor}
            onToggleDownloadMenu={setDownloadMenuFor}
            downloading={exportActions.downloading}
            onDownloadXlsx={exportActions.downloadXlsx}
            onDownloadJpg={exportActions.downloadJpg}
            canCreateShiftRequest={derived.canCreateShiftRequest}
            onOpenReplacement={shiftRequestDialogs.openReplacement}
            onOpenSwap={shiftRequestDialogs.openSwap}
          />

          <ScheduleTabsNav activeTab={activeTab} hasTodayShifts={derived.hasTodayShifts} onChange={setActiveTab} />

          {activeTab === "today" && derived.hasTodayShifts && (
            <TodayShiftsCard todaysShifts={derived.todaysShifts} currentMemberId={derived.currentMember?.id ?? null} />
          )}

          {activeTab === "table" && (
            <ScheduleTableSection
              schedule={schedule}
              scheduleReadOnly={scheduleReadOnly}
              scheduleId={scheduleId}
              saving={draftActions.saving}
              monthFallback={derived.monthFallback}
              canManage={canManage}
              loading={loading}
              error={error}
              scheduleLoading={savedScheduleActions.scheduleLoading}
              onCancelEdit={handleCancelEdit}
              onSave={draftActions.saveSchedule}
              onCellChange={cellEditing.changeCell}
            />
          )}

          {activeTab === "table" && scheduleReadOnly && <ScheduleHistoryBlock history={schedule.history} />}

          {activeTab === "requests" && (
            <ShiftRequestsSection
              canManage={canManage}
              loading={shiftRequests.loading}
              error={shiftRequests.error}
              requests={shiftRequests.sortedRequests}
              humanStatus={shiftRequests.humanStatus}
              shiftDisplay={derived.shiftDisplay}
              canCancelOwnRequest={shiftRequests.canCancelOwnRequest}
              onManagerDecision={shiftRequests.decide}
              onCancel={shiftRequests.cancel}
            />
          )}
        </div>
      )}

      {schedule && derived.currentMember && (
        <>
          <ShiftReplacementDialog
            open={shiftRequestDialogs.replacementOpen}
            onClose={shiftRequestDialogs.closeReplacement}
            schedule={schedule}
            currentMember={derived.currentMember}
            members={members}
            onSubmit={shiftRequestDialogs.submitReplacement}
          />
          <ShiftSwapDialog
            open={shiftRequestDialogs.swapOpen}
            onClose={shiftRequestDialogs.closeSwap}
            schedule={schedule}
            currentMember={derived.currentMember}
            members={members}
            onSubmit={shiftRequestDialogs.submitSwap}
          />
        </>
      )}

      <ChangeScheduleOwnerDialog
        open={ownerDialog.open}
        loading={ownerDialog.loading}
        saving={ownerDialog.saving}
        error={ownerDialog.error}
        candidates={ownerDialog.candidates}
        currentOwnerUserId={ownerDialog.currentOwnerUserId}
        selectedOwnerUserId={ownerDialog.selectedOwnerUserId}
        onSelect={ownerDialog.setSelectedOwnerUserId}
        onClose={ownerDialog.closeDialog}
        onSubmit={() => void ownerDialog.submit()}
      />

      <CreateScheduleDialog
        open={draftActions.dialogOpen}
        onClose={draftActions.closeDialog}
        positions={positions}
        defaultStart={lastRange?.start}
        defaultEnd={lastRange?.end}
        onSubmit={draftActions.createDraft}
      />
    </div>
  );
};

export default SchedulePage;

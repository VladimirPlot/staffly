import React from "react";

import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import { useAuth } from "../../../shared/providers/AuthProvider";

import CreateScheduleDialog from "../components/CreateScheduleDialog";
import ScheduleTable from "../components/ScheduleTable";
import type { ScheduleConfig, ScheduleData, ScheduleCellKey } from "../types";
import { daysBetween, formatDayNumber, formatWeekdayShort, monthLabelsBetween } from "../utils/date";
import { memberDisplayName } from "../utils/names";
import { normalizeCellValue } from "../utils/cellFormatting";
import { fetchMyRoleIn, listMembers, type MemberDto } from "../../employees/api";
import { listPositions, type PositionDto, type RestaurantRole } from "../../dictionaries/api";

function buildTitle(positionNames: string[], monthNames: string[]): string {
  const positionsPart = positionNames.join(" - ");
  const monthsPart = monthNames.join("/");
  if (positionsPart && monthsPart) return `${positionsPart} - ${monthsPart}`;
  return positionsPart || monthsPart || "График";
}

function sortMembers(
  members: MemberDto[],
  positionOrder: Map<number, number>,
  showFullName: boolean
): MemberDto[] {
  return [...members].sort((a, b) => {
    const orderA = positionOrder.get(a.positionId ?? -1) ?? Number.MAX_SAFE_INTEGER;
    const orderB = positionOrder.get(b.positionId ?? -1) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;

    const nameA = memberDisplayName(a, showFullName).toLocaleLowerCase("ru-RU");
    const nameB = memberDisplayName(b, showFullName).toLocaleLowerCase("ru-RU");
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
}

const SchedulePage: React.FC = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [myRole, setMyRole] = React.useState<RestaurantRole | null>(null);
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [members, setMembers] = React.useState<MemberDto[]>([]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [schedule, setSchedule] = React.useState<ScheduleData | null>(null);
  const [lastRange, setLastRange] = React.useState<{ start: string; end: string } | null>(null);

  React.useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      setError("Не выбран ресторан");
      setMyRole(null);
      setPositions([]);
      setMembers([]);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [role, posList, memList] = await Promise.all([
          fetchMyRoleIn(restaurantId),
          listPositions(restaurantId, { includeInactive: true }),
          listMembers(restaurantId),
        ]);
        if (!alive) return;
        setMyRole(role);
        setPositions(posList);
        setMembers(memList);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.response?.data?.message || e?.message || "Не удалось загрузить данные");
        setMyRole(null);
        setPositions([]);
        setMembers([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const canManage = myRole === "ADMIN" || myRole === "MANAGER";

  const handleCreateSchedule = React.useCallback(
    (config: ScheduleConfig) => {
      const dateList = daysBetween(config.startDate, config.endDate);
      const months = monthLabelsBetween(dateList);
      const selectedPositions = positions.filter((position) =>
        config.positionIds.includes(position.id)
      );
      const positionOrder = new Map<number, number>();
      config.positionIds.forEach((id, index) => {
        positionOrder.set(id, index);
      });

      const filteredMembers = members.filter(
        (member) => member.positionId != null && positionOrder.has(member.positionId)
      );
      const sortedMembers = sortMembers(filteredMembers, positionOrder, config.showFullName);

      const days = dateList.map((iso) => ({
        date: iso,
        weekdayLabel: formatWeekdayShort(iso),
        dayNumber: formatDayNumber(iso),
      }));

      const rows = sortedMembers.map((member) => ({
        member,
        displayName: memberDisplayName(member, config.showFullName),
        positionId: member.positionId,
        positionName: selectedPositions.find((p) => p.id === member.positionId)?.name ?? null,
      }));

      const title = buildTitle(
        selectedPositions.map((p) => p.name),
        months
      );

      setSchedule({
        title,
        config,
        days,
        rows,
        cellValues: {},
      });
      setLastRange({ start: config.startDate, end: config.endDate });
    },
    [members, positions]
  );

  const handleCellChange = React.useCallback(
    (key: ScheduleCellKey, value: string, options?: { commit?: boolean }) => {
      setSchedule((prev) => {
        if (!prev) return prev;
        const nextValues = { ...prev.cellValues };
        if (options?.commit) {
          const normalized = normalizeCellValue(value, prev.config.shiftMode);
          if (!normalized) {
            delete nextValues[key];
          } else {
            nextValues[key] = normalized;
          }
        } else {
          nextValues[key] = value;
        }
        return { ...prev, cellValues: nextValues };
      });
    },
    []
  );

  const openDialog = React.useCallback(() => {
    setDialogOpen(true);
  }, []);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
  }, []);

  const monthFallback = React.useMemo(() => {
    if (!schedule) return null;
    const months = monthLabelsBetween(schedule.days.map((day) => day.date));
    if (months.length > 0) return months.join("/");
    return null;
  }, [schedule]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackToHome />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">График</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Создавайте и редактируйте графики для выбранных должностей.
          </p>
        </div>
        {canManage && (
          <Button onClick={openDialog}>Создать график</Button>
        )}
      </div>

      {loading && <Card>Загрузка…</Card>}
      {!loading && error && <Card className="text-red-600">{error}</Card>}

      {!loading && !error && !canManage && (
        <Card>
          <div className="text-sm text-zinc-600">
            Раздел доступен только администраторам и менеджерам ресторана.
          </div>
        </Card>
      )}

      {!loading && !error && canManage && !schedule && (
        <Card>
          <div className="space-y-2 text-sm text-zinc-600">
            <p>Пока график не создан. Нажмите «Создать график», чтобы настроить таблицу.</p>
            <p>Диапазон может включать не более 32 дней.</p>
          </div>
        </Card>
      )}

      {!loading && !error && canManage && schedule && (
        <Card className="overflow-hidden">
          {schedule.rows.length === 0 ? (
            <div className="text-sm text-zinc-600">
              В выбранных должностях пока нет сотрудников. Попробуйте выбрать другие должности.
            </div>
          ) : (
            <ScheduleTable data={schedule} onChange={handleCellChange} />
          )}
          {schedule.rows.length > 0 && monthFallback && (
            <div className="mt-3 text-xs text-zinc-500">
              Период: {schedule.config.startDate} — {schedule.config.endDate} ({monthFallback})
            </div>
          )}
        </Card>
      )}

      <CreateScheduleDialog
        open={dialogOpen}
        onClose={closeDialog}
        positions={positions}
        defaultStart={lastRange?.start}
        defaultEnd={lastRange?.end}
        onSubmit={handleCreateSchedule}
      />
    </div>
  );
};

export default SchedulePage;

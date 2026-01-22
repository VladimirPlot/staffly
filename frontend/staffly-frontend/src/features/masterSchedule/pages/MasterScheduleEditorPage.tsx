import React from "react";
import { useParams } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import SelectField from "../../../shared/ui/SelectField";
import Input from "../../../shared/ui/Input";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Icon from "../../../shared/ui/Icon";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  batchUpdateMasterScheduleCells,
  createMasterScheduleRow,
  getMasterScheduleWeekTemplate,
  getMasterSchedule,
  updateMasterSchedule,
  updateMasterScheduleRow,
  deleteMasterScheduleRow,
  updateMasterScheduleWeekTemplate,
  addMasterScheduleWeekTemplatePosition,
  deleteMasterScheduleWeekTemplatePosition,
  applyMasterScheduleWeekTemplate,
} from "../api";
import type {
  MasterScheduleCellDto,
  MasterScheduleRowDto,
  MasterScheduleWeekTemplateCellDto,
  MasterScheduleWeekTemplateUpdatePayload,
} from "../types";
import { formatDayLabel, formatShortDate, getDateRange, getWeekdayToken } from "../utils/date";
import MasterScheduleToolbar from "../components/MasterScheduleToolbar";
import MasterScheduleTableView from "../components/MasterScheduleTableView";
import RowSettingsModal from "../components/RowSettingsModal";
import MasterScheduleWeekTemplateView, {
  type WeekTemplateDay,
} from "../components/MasterScheduleWeekTemplateView";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import { calcRowAmount } from "../utils/calc";
import { parseCellValue } from "../utils/parse";
import { formatNumber } from "../utils/format";
import { comparePositions } from "../utils/positionSort";

const DEBOUNCE_MS = 200;
const MAX_WAIT_MS = 1500;
const CELL_CHUNK_SIZE = 80;
const TEMPLATE_DEBOUNCE_MS = 300;
const DEFAULT_WEEK_DAYS: WeekTemplateDay[] = [
  { label: "Пн", weekday: "MONDAY" },
  { label: "Вт", weekday: "TUESDAY" },
  { label: "Ср", weekday: "WEDNESDAY" },
  { label: "Чт", weekday: "THURSDAY" },
  { label: "Пт", weekday: "FRIDAY" },
  { label: "Сб", weekday: "SATURDAY" },
  { label: "Вс", weekday: "SUNDAY" },
];

export default function MasterScheduleEditorPage() {
  const { id } = useParams();
  const scheduleId = Number(id);
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;

  const [rows, setRows] = React.useState<MasterScheduleRowDto[]>([]);
  const [cells, setCells] = React.useState<MasterScheduleCellDto[]>([]);
  const [dates, setDates] = React.useState<string[]>([]);
  const [scheduleName, setScheduleName] = React.useState("");
  const [plannedRevenue, setPlannedRevenue] = React.useState<number | null>(null);
  const [viewMode, setViewMode] = React.useState<"DETAILED" | "COMPACT">("DETAILED");
  const [overviewMode, setOverviewMode] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [positionToAdd, setPositionToAdd] = React.useState<number | "">("");
  const [rowSettings, setRowSettings] = React.useState<MasterScheduleRowDto | null>(null);
  const [cellErrors, setCellErrors] = React.useState<Record<string, string>>({});
  const [weekTemplateCells, setWeekTemplateCells] = React.useState<
    MasterScheduleWeekTemplateCellDto[]
  >([]);
  const [weekTemplateLoaded, setWeekTemplateLoaded] = React.useState(false);
  const pendingRef = React.useRef<Map<string, { rowId: number; workDate: string; valueRaw: string | null }>>(
    new Map()
  );
  const [pendingTick, setPendingTick] = React.useState(0);
  const debounceTimerRef = React.useRef<number | null>(null);
  const maxWaitTimerRef = React.useRef<number | null>(null);
  const templatePendingRef = React.useRef<Map<string, MasterScheduleWeekTemplateUpdatePayload>>(
    new Map()
  );
  const [templatePendingTick, setTemplatePendingTick] = React.useState(0);

  const load = React.useCallback(async () => {
    if (!restaurantId || !scheduleId) return;
    setLoading(true);
    setError(null);
    try {
      const [schedule, positionsData] = await Promise.all([
        getMasterSchedule(restaurantId, scheduleId),
        listPositions(restaurantId),
      ]);
      setRows(schedule.rows);
      setCells(schedule.cells);
      setDates(getDateRange(schedule.periodStart, schedule.periodEnd));
      setScheduleName(schedule.name);
      setPlannedRevenue(schedule.plannedRevenue ?? null);
      setPositions(positionsData);
      setPositionToAdd("");
      setCellErrors({});
      setWeekTemplateCells([]);
      setWeekTemplateLoaded(false);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, scheduleId]);

  React.useEffect(() => {
    if (restaurantId && scheduleId) void load();
  }, [restaurantId, scheduleId, load]);

  const loadWeekTemplate = React.useCallback(async () => {
    if (!restaurantId || !scheduleId) return;
    try {
      const template = await getMasterScheduleWeekTemplate(restaurantId, scheduleId);
      setWeekTemplateCells(template);
      setWeekTemplateLoaded(true);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка загрузки шаблона");
    }
  }, [restaurantId, scheduleId]);

  React.useEffect(() => {
    if (viewMode === "COMPACT" && !weekTemplateLoaded) {
      void loadWeekTemplate();
    }
  }, [viewMode, weekTemplateLoaded, loadWeekTemplate]);

  React.useEffect(() => {
    if (viewMode === "COMPACT") {
      setOverviewMode(false);
    }
  }, [viewMode]);

  const flushPendingCells = React.useCallback(async () => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current) {
      window.clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
    const items = Array.from(pendingRef.current.values());
    pendingRef.current.clear();
    if (!items.length || !restaurantId || !scheduleId) return;
    try {
      const updated: MasterScheduleCellDto[] = [];
      for (let i = 0; i < items.length; i += CELL_CHUNK_SIZE) {
        const chunk = items.slice(i, i + CELL_CHUNK_SIZE);
        const response = await batchUpdateMasterScheduleCells(restaurantId, scheduleId, chunk);
        updated.push(...response);
      }
      if (updated.length) {
        setCells((prev) => {
          const map = new Map(prev.map((cell) => [`${cell.rowId}:${cell.workDate}`, cell]));
          updated.forEach((cell) => map.set(`${cell.rowId}:${cell.workDate}`, cell));
          return Array.from(map.values());
        });
        setCellErrors((prev) => {
          const next = { ...prev };
          updated.forEach((cell) => {
            delete next[`${cell.rowId}:${cell.workDate}`];
          });
          return next;
        });
      }
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка сохранения ячеек");
    }
  }, [restaurantId, scheduleId]);

  React.useEffect(() => {
    if (pendingTick === 0) return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      void flushPendingCells();
    }, DEBOUNCE_MS);
    if (!maxWaitTimerRef.current) {
      maxWaitTimerRef.current = window.setTimeout(() => {
        void flushPendingCells();
      }, MAX_WAIT_MS);
    }
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [pendingTick, flushPendingCells]);

  React.useEffect(() => {
    if (templatePendingTick === 0) return;
    const timer = window.setTimeout(async () => {
      const items = Array.from(templatePendingRef.current.values());
      templatePendingRef.current.clear();
      if (!items.length || !restaurantId || !scheduleId) return;
      try {
        const updated = await updateMasterScheduleWeekTemplate(
          restaurantId,
          scheduleId,
          items
        );
        setWeekTemplateCells(updated);
      } catch (e: any) {
        setError(e?.friendlyMessage || "Ошибка сохранения шаблона");
      }
    }, TEMPLATE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [templatePendingTick, restaurantId, scheduleId]);

  const handleCellChange = (rowId: number, workDate: string, valueRaw: string) => {
    const trimmed = valueRaw.trim();
    const key = `${rowId}:${workDate}`;
    if (!trimmed) {
      setCells((prev) => prev.filter((cell) => `${cell.rowId}:${cell.workDate}` !== key));
      setCellErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      pendingRef.current.set(key, {
        rowId,
        workDate,
        valueRaw: null,
      });
      setPendingTick((v) => v + 1);
      return;
    }

    const parsed = parseCellValue(valueRaw);
    setCells((prev) => {
      const existingIndex = prev.findIndex(
        (cell) => cell.rowId === rowId && cell.workDate === workDate
      );
      if (existingIndex >= 0) {
        const next = [...prev];
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          valueRaw,
          valueNum: parsed.error ? existing.valueNum : parsed.valueNum,
          unitsCount: parsed.error ? existing.unitsCount : parsed.unitsCount,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: Math.random(),
          rowId,
          workDate,
          valueRaw,
          valueNum: parsed.error ? null : parsed.valueNum,
          unitsCount: parsed.error ? null : parsed.unitsCount,
        },
      ];
    });
    setCellErrors((prev) => {
      const next = { ...prev };
      if (parsed.error) {
        next[key] = parsed.error;
      } else {
        delete next[key];
      }
      return next;
    });
    if (parsed.error) {
      pendingRef.current.delete(key);
      return;
    }
    pendingRef.current.set(key, {
      rowId,
      workDate,
      valueRaw,
    });
    setPendingTick((v) => v + 1);
  };

  const handleTemplateCellChange = (
    positionId: number,
    weekday: MasterScheduleWeekTemplateUpdatePayload["weekday"],
    staffCount: number | null,
    units: number | null
  ) => {
    const key = `${positionId}:${weekday}`;
    setWeekTemplateCells((prev) => {
      const next = [...prev];
      const idx = next.findIndex(
        (cell) => cell.positionId === positionId && cell.weekday === weekday
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], staffCount, units };
        return next;
      }
      return [
        ...next,
        {
          id: Math.random(),
          positionId,
          weekday,
          staffCount,
          units,
        },
      ];
    });
    templatePendingRef.current.set(key, {
      positionId,
      weekday,
      staffCount,
      units,
    });
    setTemplatePendingTick((v) => v + 1);
  };

  const handleAddRow = async (positionId: number) => {
    if (!restaurantId || !scheduleId) return;
    try {
      const row = await createMasterScheduleRow(restaurantId, scheduleId, { positionId });
      setRows((prev) => [...prev, row]);
      setWeekTemplateLoaded(false);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка добавления строки");
    }
  };

  const handleDeleteRow = async (rowId: number) => {
    if (!restaurantId || !scheduleId) return;
    try {
      await deleteMasterScheduleRow(restaurantId, scheduleId, rowId);
      setRows((prev) => prev.filter((row) => row.id !== rowId));
      setCells((prev) => prev.filter((cell) => cell.rowId !== rowId));
      setWeekTemplateLoaded(false);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка удаления строки");
    }
  };

  const totalPayroll = React.useMemo(() => {
    const cellMap = new Map<string, MasterScheduleCellDto>();
    cells.forEach((cell) => cellMap.set(`${cell.rowId}:${cell.workDate}`, cell));
    return rows.reduce((sum, row) => {
      const rowCells = dates
        .map((date) => cellMap.get(`${row.id}:${date}`))
        .filter(Boolean) as MasterScheduleCellDto[];
      return sum + calcRowAmount(row, rowCells).amount;
    }, 0);
  }, [rows, cells, dates]);

  const sortedPositions = React.useMemo(
    () => [...positions].sort(comparePositions),
    [positions]
  );

  const availablePositions = React.useMemo(() => {
    if (viewMode === "COMPACT") {
      const existing = new Set(weekTemplateCells.map((cell) => cell.positionId));
      return sortedPositions.filter((pos) => !existing.has(pos.id));
    }
    return sortedPositions;
  }, [viewMode, sortedPositions, weekTemplateCells]);

  const positionMap = React.useMemo(() => {
    return new Map(sortedPositions.map((pos) => [pos.id, pos]));
  }, [sortedPositions]);

  const sortedRows = React.useMemo(() => {
    return [...rows].sort((a, b) => {
      const positionA = positionMap.get(a.positionId);
      const positionB = positionMap.get(b.positionId);
      if (positionA && positionB) {
        const positionCompare = comparePositions(positionA, positionB);
        if (positionCompare !== 0) return positionCompare;
      } else {
        const nameCompare = a.positionName.localeCompare(b.positionName, "ru", {
          sensitivity: "base",
        });
        if (nameCompare !== 0) return nameCompare;
      }
      return a.rowIndex - b.rowIndex;
    });
  }, [rows, positionMap]);

  const weekTemplateDays = React.useMemo<WeekTemplateDay[]>(() => {
    if (dates.length === 0) return DEFAULT_WEEK_DAYS;
    if (dates.length < 7) {
      return dates.map((date) => ({
        label: `${formatDayLabel(date).weekday} ${formatShortDate(date)}`,
        weekday: getWeekdayToken(date),
      }));
    }
    return DEFAULT_WEEK_DAYS;
  }, [dates]);

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>Сначала выберите ресторан.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-4">
      <Breadcrumbs
        items={[
          { label: "Мастер-графики", to: "/master-schedules" },
          { label: scheduleName || "Мастер-график" },
        ]}
      />
      <Card>
        {loading ? (
          <div>Загрузка…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold">{scheduleName}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SelectField
                  label="Добавить должность"
                  value={positionToAdd}
                  onChange={(e) =>
                    setPositionToAdd(e.target.value ? Number(e.target.value) : "")
                  }
                >
                  <option value="">Выберите должность</option>
                  {availablePositions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name}
                    </option>
                  ))}
                </SelectField>
                <Button
                  disabled={!positionToAdd}
                  onClick={() => {
                    if (!positionToAdd) return;
                    if (viewMode === "COMPACT") {
                      if (!restaurantId || !scheduleId) return;
                      void (async () => {
                        try {
                          const updated = await addMasterScheduleWeekTemplatePosition(
                            restaurantId,
                            scheduleId,
                            { positionId: Number(positionToAdd) }
                          );
                          setWeekTemplateCells(updated);
                          setWeekTemplateLoaded(true);
                          setPositionToAdd("");
                        } catch (e: any) {
                          setError(e?.friendlyMessage || "Ошибка добавления должности");
                        }
                      })();
                    } else {
                      void handleAddRow(Number(positionToAdd));
                    }
                  }}
                >
                  Добавить
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <MasterScheduleToolbar viewMode={viewMode} onToggleViewMode={setViewMode} />
              </div>
              {viewMode === "DETAILED" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOverviewMode((prev) => !prev)}
                  leftIcon={
                    <Icon
                      icon={overviewMode ? Minimize2 : Maximize2}
                      size="xs"
                    />
                  }
                >
                  {overviewMode ? "Обычный" : "Обзор"}
                </Button>
              )}
            </div>

            {viewMode === "COMPACT" ? (
              <MasterScheduleWeekTemplateView
                templateCells={weekTemplateCells}
                positions={sortedPositions}
                days={weekTemplateDays}
                onCellChange={handleTemplateCellChange}
                onRemovePosition={async (positionId) => {
                  if (!restaurantId || !scheduleId) return;
                  try {
                    await deleteMasterScheduleWeekTemplatePosition(
                      restaurantId,
                      scheduleId,
                      positionId
                    );
                    setWeekTemplateCells((prev) =>
                      prev.filter((cell) => cell.positionId !== positionId)
                    );
                    setWeekTemplateLoaded(true);
                  } catch (e: any) {
                    setError(e?.friendlyMessage || "Ошибка удаления должности");
                  }
                }}
                onApplyTemplate={async (overwriteExisting) => {
                  if (!restaurantId || !scheduleId) return;
                  try {
                    await applyMasterScheduleWeekTemplate(restaurantId, scheduleId, {
                      overwriteExisting,
                    });
                    await load();
                    setViewMode("DETAILED");
                  } catch (e: any) {
                    setError(e?.friendlyMessage || "Ошибка заполнения графика");
                  }
                }}
              />
            ) : (
              <MasterScheduleTableView
                rows={sortedRows}
                cells={cells}
                dates={dates}
                cellErrors={cellErrors}
                overviewMode={overviewMode}
                onCellChange={handleCellChange}
                onAddRow={handleAddRow}
                onDeleteRow={handleDeleteRow}
                onOpenSettings={(row) => setRowSettings(row)}
              />
            )}

            <div className="flex flex-wrap items-end justify-between gap-4 rounded-3xl border border-zinc-200 bg-white p-4">
              <div className="space-y-2">
                <div className="text-sm text-zinc-600">Planned revenue</div>
                <Input
                  label="Плановая выручка"
                  type="number"
                  inputMode="decimal"
                  value={plannedRevenue ?? ""}
                  onChange={(e) =>
                    setPlannedRevenue(e.target.value ? Number(e.target.value) : null)
                  }
                />
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!restaurantId || !scheduleId) return;
                    try {
                      await updateMasterSchedule(restaurantId, scheduleId, {
                        plannedRevenue,
                      });
                    } catch (e: any) {
                      setError(e?.friendlyMessage || "Ошибка сохранения выручки");
                    }
                  }}
                >
                  Сохранить выручку
                </Button>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-600">LC%</div>
                <div className="text-xl font-semibold text-zinc-900">
                  {plannedRevenue && plannedRevenue > 0
                    ? formatNumber((totalPayroll / plannedRevenue) * 100)
                    : "—"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-600">Общий ФОТ</div>
                <div className="text-xl font-semibold text-zinc-900">
                  {formatNumber(totalPayroll)}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <RowSettingsModal
        row={rowSettings}
        open={Boolean(rowSettings)}
        onClose={() => setRowSettings(null)}
        onSave={async (payload) => {
          if (!restaurantId || !scheduleId || !rowSettings) return;
          try {
            const updated = await updateMasterScheduleRow(
              restaurantId,
              scheduleId,
              rowSettings.id,
              payload
            );
            setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
            setRowSettings(null);
          } catch (e: any) {
            setError(e?.friendlyMessage || "Ошибка обновления строки");
          }
        }}
      />
    </div>
  );
}

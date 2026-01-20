import React from "react";
import { useParams } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import SelectField from "../../../shared/ui/SelectField";
import Input from "../../../shared/ui/Input";
import BackToHome from "../../../shared/ui/BackToHome";
import { useAuth } from "../../../shared/providers/AuthProvider";
import {
  batchUpdateMasterScheduleCells,
  copyMasterScheduleDay,
  copyMasterScheduleWeek,
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
import { getDateRange } from "../utils/date";
import MasterScheduleToolbar from "../components/MasterScheduleToolbar";
import CopyDialog from "../components/CopyDialog";
import MasterScheduleTableView from "../components/MasterScheduleTableView";
import MasterScheduleDayView from "../components/MasterScheduleDayView";
import RowSettingsModal from "../components/RowSettingsModal";
import MasterScheduleWeekTemplateView from "../components/MasterScheduleWeekTemplateView";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import { calcRowAmount } from "../utils/calc";
import { parseCellValue } from "../utils/parse";
import { formatNumber } from "../utils/format";

const DEBOUNCE_MS = 200;
const MAX_WAIT_MS = 1500;
const CELL_CHUNK_SIZE = 80;
const TEMPLATE_DEBOUNCE_MS = 300;

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
  const [mode, setMode] = React.useState<"DETAILED" | "COMPACT">("DETAILED");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"table" | "day">("table");
  const [selectedDate, setSelectedDate] = React.useState<string>("");
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [positionToAdd, setPositionToAdd] = React.useState<number | "">("");
  const [copyOpen, setCopyOpen] = React.useState(false);
  const [rowSettings, setRowSettings] = React.useState<MasterScheduleRowDto | null>(null);
  const [cellErrors, setCellErrors] = React.useState<Record<string, string>>({});
  const [weekTemplateCells, setWeekTemplateCells] = React.useState<
    MasterScheduleWeekTemplateCellDto[]
  >([]);
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
      const template =
        schedule.mode === "COMPACT"
          ? await getMasterScheduleWeekTemplate(restaurantId, scheduleId)
          : [];
      setRows(schedule.rows);
      setCells(schedule.cells);
      setMode(schedule.mode);
      setDates(getDateRange(schedule.periodStart, schedule.periodEnd));
      setScheduleName(schedule.name);
      setPlannedRevenue(schedule.plannedRevenue ?? null);
      setSelectedDate(schedule.periodStart);
      setPositions(positionsData);
      setPositionToAdd("");
      setWeekTemplateCells(template);
      setCellErrors({});
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, scheduleId]);

  React.useEffect(() => {
    if (restaurantId && scheduleId) void load();
  }, [restaurantId, scheduleId, load]);

  React.useEffect(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (isMobile) {
      setView("day");
    }
  }, []);

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
    employeesCount: number | null,
    units: number | null
  ) => {
    const key = `${positionId}:${weekday}`;
    setWeekTemplateCells((prev) => {
      const next = [...prev];
      const idx = next.findIndex(
        (cell) => cell.positionId === positionId && cell.weekday === weekday
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], employeesCount, units };
        return next;
      }
      return [
        ...next,
        {
          id: Math.random(),
          positionId,
          weekday,
          employeesCount,
          units,
        },
      ];
    });
    templatePendingRef.current.set(key, {
      positionId,
      weekday,
      employeesCount,
      units,
    });
    setTemplatePendingTick((v) => v + 1);
  };

  const handleAddRow = async (positionId: number) => {
    if (!restaurantId || !scheduleId) return;
    try {
      const row = await createMasterScheduleRow(restaurantId, scheduleId, { positionId });
      setRows((prev) => [...prev, row]);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка добавления строки");
    }
  };

  const handleDeleteRow = async (rowId: number) => {
    if (!restaurantId) return;
    try {
      await deleteMasterScheduleRow(restaurantId, rowId);
      setRows((prev) => prev.filter((row) => row.id !== rowId));
      setCells((prev) => prev.filter((cell) => cell.rowId !== rowId));
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

  const availablePositions = React.useMemo(() => {
    if (mode === "COMPACT") {
      const existing = new Set(weekTemplateCells.map((cell) => cell.positionId));
      return positions.filter((pos) => !existing.has(pos.id));
    }
    return positions;
  }, [mode, positions, weekTemplateCells]);

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>Сначала выберите ресторан.</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-4">
      <BackToHome />
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
                <div className="text-sm text-zinc-600">
                  Режим: {mode === "DETAILED" ? "DETAILED" : "COMPACT"}
                </div>
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
                    if (mode === "COMPACT") {
                      if (!restaurantId || !scheduleId) return;
                      void (async () => {
                        try {
                          const updated = await addMasterScheduleWeekTemplatePosition(
                            restaurantId,
                            scheduleId,
                            { positionId: Number(positionToAdd) }
                          );
                          setWeekTemplateCells(updated);
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

            {mode === "DETAILED" && (
              <MasterScheduleToolbar
                view={view}
                onToggleView={setView}
                onCopy={() => setCopyOpen(true)}
              />
            )}

            {mode === "COMPACT" ? (
              <MasterScheduleWeekTemplateView
                templateCells={weekTemplateCells}
                positions={positions}
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
                  } catch (e: any) {
                    setError(e?.friendlyMessage || "Ошибка заполнения графика");
                  }
                }}
              />
            ) : view === "table" ? (
              <MasterScheduleTableView
                rows={rows}
                cells={cells}
                dates={dates}
                cellErrors={cellErrors}
                onCellChange={handleCellChange}
                onAddRow={handleAddRow}
                onDeleteRow={handleDeleteRow}
                onOpenSettings={(row) => setRowSettings(row)}
              />
            ) : (
              <MasterScheduleDayView
                rows={rows}
                cells={cells}
                cellErrors={cellErrors}
                date={selectedDate}
                onDateChange={setSelectedDate}
                onCellChange={handleCellChange}
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

      {mode === "DETAILED" && (
        <CopyDialog
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          minDate={dates[0]}
          maxDate={dates[dates.length - 1]}
          onCopyDay={async (source, target) => {
            if (!restaurantId || !scheduleId) return;
            await copyMasterScheduleDay(restaurantId, scheduleId, {
              sourceDate: source,
              targetDate: target,
            });
            await load();
            setCopyOpen(false);
          }}
          onCopyWeek={async (source, target) => {
            if (!restaurantId || !scheduleId) return;
            await copyMasterScheduleWeek(restaurantId, scheduleId, {
              sourceWeekStart: source,
              targetWeekStart: target,
            });
            await load();
            setCopyOpen(false);
          }}
        />
      )}

      <RowSettingsModal
        row={rowSettings}
        open={Boolean(rowSettings)}
        onClose={() => setRowSettings(null)}
        onSave={async (payload) => {
          if (!restaurantId || !rowSettings) return;
          try {
            const updated = await updateMasterScheduleRow(restaurantId, rowSettings.id, payload);
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

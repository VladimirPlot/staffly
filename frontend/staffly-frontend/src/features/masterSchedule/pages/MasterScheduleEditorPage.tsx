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
  getMasterSchedule,
  updateMasterSchedule,
  updateMasterScheduleRow,
  deleteMasterScheduleRow,
} from "../api";
import type { MasterScheduleCellDto, MasterScheduleRowDto } from "../types";
import { getDateRange } from "../utils/date";
import MasterScheduleToolbar from "../components/MasterScheduleToolbar";
import CopyDialog from "../components/CopyDialog";
import MasterScheduleTableView from "../components/MasterScheduleTableView";
import MasterScheduleDayView from "../components/MasterScheduleDayView";
import RowSettingsModal from "../components/RowSettingsModal";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import { calcRowAmount } from "../utils/calc";

const DEBOUNCE_MS = 200;

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
  const pendingRef = React.useRef<Map<string, { rowId: number; workDate: string; valueRaw: string | null }>>(
    new Map()
  );
  const [pendingTick, setPendingTick] = React.useState(0);

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
      setMode(schedule.mode);
      setDates(getDateRange(schedule.periodStart, schedule.periodEnd));
      setScheduleName(schedule.name);
      setPlannedRevenue(schedule.plannedRevenue ?? null);
      setSelectedDate(schedule.periodStart);
      setPositions(positionsData);
      setPositionToAdd("");
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

  React.useEffect(() => {
    if (pendingTick === 0) return;
    const timer = window.setTimeout(async () => {
      const items = Array.from(pendingRef.current.values());
      pendingRef.current.clear();
      if (!items.length || !restaurantId || !scheduleId) return;
      try {
        await batchUpdateMasterScheduleCells(restaurantId, scheduleId, items);
      } catch (e: any) {
        setError(e?.friendlyMessage || "Ошибка сохранения ячеек");
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [pendingTick, restaurantId, scheduleId]);

  const handleCellChange = (rowId: number, workDate: string, valueRaw: string) => {
    setCells((prev) => {
      const existingIndex = prev.findIndex(
        (cell) => cell.rowId === rowId && cell.workDate === workDate
      );
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          valueRaw,
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
          valueNum: null,
          unitsCount: null,
        },
      ];
    });
    pendingRef.current.set(`${rowId}:${workDate}`, {
      rowId,
      workDate,
      valueRaw: valueRaw.trim() ? valueRaw : null,
    });
    setPendingTick((v) => v + 1);
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
      const existing = new Set(rows.map((row) => row.positionId));
      return positions.filter((pos) => !existing.has(pos.id));
    }
    return positions;
  }, [mode, positions, rows]);

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
                    void handleAddRow(Number(positionToAdd));
                  }}
                >
                  Добавить
                </Button>
              </div>
            </div>

            <MasterScheduleToolbar
              view={view}
              onToggleView={setView}
              onCopy={() => setCopyOpen(true)}
            />

            {view === "table" ? (
              <MasterScheduleTableView
                rows={rows}
                cells={cells}
                dates={dates}
                mode={mode}
                onCellChange={handleCellChange}
                onAddRow={handleAddRow}
                onDeleteRow={handleDeleteRow}
                onOpenSettings={(row) => setRowSettings(row)}
              />
            ) : (
              <MasterScheduleDayView
                rows={rows}
                cells={cells}
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
                    ? ((totalPayroll / plannedRevenue) * 100).toFixed(2)
                    : "—"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-600">Общий ФОТ</div>
                <div className="text-xl font-semibold text-zinc-900">
                  {totalPayroll.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

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

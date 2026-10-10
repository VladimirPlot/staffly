import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, LayoutGrid, List, RefreshCw, Search, CheckCheck, X } from "lucide-react";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import PageLoader from "../../../shared/ui/PageLoader";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import { fetchMyRoleIn, listMembers, type MemberDto } from "../../employees/api";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import { fetchRestaurant } from "../../restaurants/api";
import BoardTaskCard from "../components/BoardTaskCard";
import TaskEditor from "../components/TaskEditor";
import TaskDetails from "../components/TaskDetails";
import AnnouncementRecipientPicker from "../../announcements/AnnouncementRecipientPicker";
import {
  completeTask,
  createTask,
  deleteTask,
  fetchTask,
  listTasks,
  updateTask,
  undoTaskCompletion,
  reopenTask,
  type TaskDto,
  type TaskCreateRequest,
  type TaskScope,
} from "../api";
import {
  isTaskOverdue,
  inTaskPeriod,
  isUnassignedTask,
  nearestTaskPeriod,
  restaurantToday,
  type TaskPeriod,
} from "../utils";

function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function message(e: unknown) {
  return (e as { friendlyMessage?: string }).friendlyMessage ?? "Не удалось выполнить действие. Попробуйте ещё раз.";
}

export default function TasksBoardPage() {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId;
  const [role, setRole] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [scope, setScope] = useState<TaskScope>("MINE");
  const [period, setPeriod] = useState<TaskPeriod>("TODAY");
  const [view, setView] = useState<"grid" | "list">(() => (stored("tasks:view", "grid") === "list" ? "list" : "grid"));
  const [query, setQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState<number[]>([]);
  const [positionFilter, setPositionFilter] = useState<number[]>([]);
  const [unassigned, setUnassigned] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dictionaryError, setDictionaryError] = useState<string | null>(null);
  const [dictionariesReady, setDictionariesReady] = useState(false);
  const [selected, setSelected] = useState<TaskDto | null>(null);
  const [editor, setEditor] = useState<TaskDto | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskDto | null>(null);
  const [reopenTarget, setReopenTarget] = useState<TaskDto | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const generation = useRef(0);
  const initialPeriodChosen = useRef(false);
  const canManage = resolveRestaurantAccess(user?.roles, role).isManagerLike;
  useEffect(() => {
    initialPeriodChosen.current = false;
    setScope("MINE");
    setPeriod("TODAY");
  }, [restaurantId, user?.id]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let alive = true;
    if (!restaurantId) return;
    setTimezone(null);
    Promise.all([fetchRestaurant(restaurantId), fetchMyRoleIn(restaurantId)])
      .then(([r, role]) => {
        if (alive) {
          setTimezone(r.timezone);
          setRole(role);
        }
      })
      .catch((e) => {
        if (alive) setError(message(e));
      });
    return () => {
      alive = false;
    };
  }, [restaurantId]);
  const loadDictionaries = useCallback(async () => {
    if (!restaurantId || !canManage) return;
    setDictionaryError(null);
    setDictionariesReady(false);
    try {
      const [p, m] = await Promise.all([
        listPositions(restaurantId, { includeInactive: false }),
        listMembers(restaurantId),
      ]);
      setPositions(p.filter((x) => x.active));
      setMembers(m);
      setDictionariesReady(true);
    } catch (e) {
      setDictionaryError(message(e));
    }
  }, [restaurantId, canManage]);
  useEffect(() => {
    void loadDictionaries();
  }, [loadDictionaries]);
  const reload = useCallback(async () => {
    if (!restaurantId) return;
    const id = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const settings = await fetchRestaurant(restaurantId);
      if (id === generation.current) setTimezone(settings.timezone);
      const data = await listTasks(restaurantId, { scope: canManage ? scope : "MINE" });
      if (id === generation.current) {
        setTasks(data);
        if (!initialPeriodChosen.current && scope === "MINE") {
          initialPeriodChosen.current = true;
          setPeriod(nearestTaskPeriod(data, restaurantToday(settings.timezone)));
        }
      }
    } catch (e) {
      if (id === generation.current) setError(message(e));
    } finally {
      if (id === generation.current) setLoading(false);
    }
  }, [restaurantId, scope, canManage, user?.id]);
  useEffect(() => {
    setSelected(null);
    setEditor(null);
    void reload();
    return () => {
      generation.current++;
    };
  }, [reload]);
  const update = (task: TaskDto) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    setSelected((prev) => (prev?.id === task.id ? task : prev));
  };
  async function action(task: TaskDto, operation: () => Promise<TaskDto>) {
    if (busy != null) return;
    setBusy(task.id);
    setError(null);
    try {
      update(await operation());
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }
  async function open(task: TaskDto) {
    setSelected(task);
    try {
      update(await fetchTask(task.id));
    } catch (e) {
      setError(message(e));
    }
  }
  async function save(payload: TaskCreateRequest) {
    if (!restaurantId) return;
    if (editor && editor !== "new") {
      update(await updateTask(editor.id, payload));
    } else {
      await createTask(restaurantId, payload);
      setScope("ALL");
      setPeriod("ALL");
      await reload();
    }
  }
  const filteredMembers = members.filter(
    (m) => !positionFilter.length || (m.positionId != null && positionFilter.includes(m.positionId)),
  );
  const changePositions = (ids: number[]) => {
    setPositionFilter(ids);
    setMemberFilter((prev) =>
      prev.filter((id) =>
        members.some((m) => m.id === id && (!ids.length || (m.positionId != null && ids.includes(m.positionId)))),
      ),
    );
  };
  const resetFilters = () => {
    setQuery("");
    setPositionFilter([]);
    setMemberFilter([]);
    setUnassigned(false);
  };
  const today = timezone ? restaurantToday(timezone, now) : "";
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ru");
    return tasks
      .filter((t) => inTaskPeriod(t, period, today))
      .filter((t) => !unassigned || isUnassignedTask(t))
      .filter((t) => !memberFilter.length || t.participants.some((p) => p.active && memberFilter.includes(p.memberId)))
      .filter(
        (t) =>
          !positionFilter.length ||
          t.positionIds.some((id) => positionFilter.includes(id)) ||
          t.participants.some(
            (p) =>
              p.active &&
              members.some((m) => m.id === p.memberId && m.positionId != null && positionFilter.includes(m.positionId)),
          ),
      )
      .filter(
        (t) =>
          !q ||
          [t.title, t.description, t.setter?.fullName, ...t.participants.map((p) => p.name)]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("ru")
            .includes(q),
      )
      .sort(
        (a, b) =>
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
          (a.dueTime ?? "24:00").localeCompare(b.dueTime ?? "24:00") ||
          { HIGH: 0, MEDIUM: 1, LOW: 2 }[a.priority] - { HIGH: 0, MEDIUM: 1, LOW: 2 }[b.priority],
      );
  }, [tasks, period, today, unassigned, memberFilter, positionFilter, members, query]);
  const overdue = filtered.filter((t) => isTaskOverdue(t, now) && !t.myCompleted);
  const active = filtered.filter((t) => t.status === "ACTIVE" && !isTaskOverdue(t, now) && !t.myCompleted);
  const mineDone = filtered.filter((t) => t.status === "ACTIVE" && t.myCompleted);
  const completed = filtered.filter((t) => t.status === "COMPLETED");
  const groups = [
    { title: "Требуют внимания", hint: "Срок уже прошёл", items: overdue, alert: true },
    {
      title: period === "TODAY" ? "На сегодня" : period === "WEEK" ? "На ближайшие 7 дней" : "Открытые задачи",
      hint: "",
      items: active,
      alert: false,
    },
    { title: "Вы выполнили", hint: "Ожидаем остальных участников", items: mineDone, alert: false },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <BackToHome />
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-strong text-2xl font-semibold">Задачи</h2>
        </div>
        <div className="ml-auto flex shrink-0 gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Обновить задачи"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw size={18} />
          </Button>
          {canManage && (
            <Button
              onClick={() => setEditor("new")}
              disabled={!timezone || !dictionariesReady || !!dictionaryError}
              leftIcon={<Plus size={18} />}
              className="px-3 sm:px-4"
            >
              Новая задача
            </Button>
          )}
        </div>
      </div>
      <div className="border-subtle bg-surface grid gap-3 rounded-3xl border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid w-full grid-cols-3 gap-1 sm:flex sm:w-auto sm:flex-wrap">
            {(["TODAY", "WEEK", "ALL"] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                className="!px-1 !text-xs sm:!px-3 sm:!text-sm"
                variant={period === p ? "primary" : "ghost"}
                onClick={() => {
                  initialPeriodChosen.current = true;
                  setPeriod(p);
                }}
              >
                {p === "TODAY" ? "Сегодня" : p === "WEEK" ? "Неделя" : "Весь период"}
              </Button>
            ))}
          </div>
          <div
            className={`${canManage ? "flex" : "hidden sm:flex"} w-full items-center justify-between gap-2 sm:w-auto sm:justify-start`}
          >
            {canManage && (
              <div className="flex gap-1">
                {(["MINE", "ALL"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={scope === s ? "outline" : "ghost"}
                    onClick={() => {
                      initialPeriodChosen.current = true;
                      setScope(s);
                    }}
                  >
                    {s === "MINE" ? "Мои" : "Все"}
                  </Button>
                ))}
              </div>
            )}
            <div className="ml-auto flex gap-2 sm:ml-0">
              {(["grid", "list"] as const).map((v) => (
                <Button
                  key={v}
                  variant={view === v ? "outline" : "ghost"}
                  size="icon"
                  aria-label={v === "grid" ? "Сетка карточек" : "Список задач"}
                  aria-pressed={view === v}
                  onClick={() => {
                    setView(v);
                    try {
                      localStorage.setItem("tasks:view", v);
                    } catch {
                      /* Preference storage is optional. */
                    }
                  }}
                >
                  {v === "grid" ? <LayoutGrid size={18} /> : <List size={18} />}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div
          className={
            canManage
              ? "grid grid-cols-2 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_auto]"
              : "flex items-end gap-1 sm:block"
          }
        >
          <label className={canManage ? "col-span-2 min-w-0 lg:col-span-1" : "min-w-0 flex-1 sm:block"}>
            <span className="text-muted mb-2 hidden text-sm lg:block">Поиск</span>
            <span className="relative block">
              <Search size={16} className="text-muted absolute top-2.5 left-3" />
              <input
                aria-label="Поиск задач"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти задачу…"
                className={`border-subtle bg-app h-9 w-full rounded-xl border pl-9 ${canManage ? "pr-3 text-sm" : "pr-9 text-xs sm:text-sm"}`}
              />
              {!canManage && query.length > 0 && (
                <button
                  type="button"
                  aria-label="Очистить поиск"
                  className="text-muted hover:text-strong absolute top-0 right-0 flex h-9 w-9 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] focus-visible:outline-none"
                  onClick={(e) => {
                    setQuery("");
                    e.currentTarget.parentElement?.querySelector("input")?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </span>
          </label>
          {canManage && (
            <>
              <AnnouncementRecipientPicker
                compact
                label="Должности"
                placeholder="Все должности"
                options={positions.map((p) => ({ id: p.id, name: p.name }))}
                selectedIds={positionFilter}
                onChange={changePositions}
                disabled={!dictionariesReady}
                resetOption={{
                  label: "Все должности",
                  selected: !positionFilter.length,
                  onSelect: () => changePositions([]),
                }}
              />
              <AnnouncementRecipientPicker
                compact
                label="Исполнители"
                placeholder="Все исполнители"
                options={filteredMembers.map((m) => ({
                  id: m.id,
                  name: m.fullName ?? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim(),
                  detail: m.positionName ?? "",
                }))}
                selectedIds={memberFilter}
                onChange={setMemberFilter}
                disabled={!dictionariesReady}
                resetOption={{
                  label: "Все исполнители",
                  selected: !memberFilter.length,
                  onSelect: () => setMemberFilter([]),
                }}
              />
            </>
          )}
          <div
            className={`col-span-2 flex h-9 items-center justify-between lg:col-span-1 lg:justify-end ${canManage ? "gap-3" : "shrink-0 gap-1 sm:hidden"}`}
          >
            {canManage ? (
              <label className="flex items-center gap-2 text-sm whitespace-nowrap">
                <input type="checkbox" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} />
                Без исполнителей
              </label>
            ) : null}
            {canManage && (
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                Сбросить
              </Button>
            )}
            {!canManage && (
              <div className="flex gap-1 sm:hidden">
                {(["grid", "list"] as const).map((v) => (
                  <Button
                    key={v}
                    size="icon"
                    variant={view === v ? "outline" : "ghost"}
                    className="!h-9 !w-9"
                    aria-label={v === "grid" ? "Сетка карточек" : "Список задач"}
                    aria-pressed={view === v}
                    onClick={() => {
                      setView(v);
                      try {
                        localStorage.setItem("tasks:view", v);
                      } catch {
                        /* Optional preference. */
                      }
                    }}
                  >
                    {v === "grid" ? <LayoutGrid size={16} /> : <List size={16} />}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {dictionaryError && (
        <div role="alert" className="border-subtle rounded-2xl border p-4 text-sm">
          Не удалось загрузить сотрудников и должности.{" "}
          <Button size="sm" variant="outline" onClick={() => void loadDictionaries()}>
            Повторить
          </Button>
        </div>
      )}
      {error && (
        <div role="alert" className="bg-surface rounded-2xl border border-red-200 p-4 text-sm text-red-600">
          {error}{" "}
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Обновить
          </Button>
        </div>
      )}
      {loading ? (
        <PageLoader />
      ) : (
        timezone && (
          <>
            {groups
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <section key={g.title} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold ${g.alert ? "text-red-600" : "text-strong"}`}>{g.title}</h3>
                    <span className="bg-surface text-muted rounded-full px-2 py-0.5 text-xs">{g.items.length}</span>
                    {g.hint && <span className="text-muted hidden text-xs sm:inline">{g.hint}</span>}
                  </div>
                  <div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>
                    {g.items.map((t) => (
                      <BoardTaskCard
                        key={t.id}
                        task={t}
                        today={today}
                        now={now}
                        layout={view}
                        busy={busy === t.id}
                        onOpen={() => void open(t)}
                        onComplete={() => void action(t, () => completeTask(t.id))}
                      />
                    ))}
                  </div>
                </section>
              ))}
            {!groups.some((g) => g.items.length) && !error && (
              <div className="border-subtle rounded-3xl border border-dashed p-10 text-center">
                <CheckCheck className="text-muted mx-auto mb-3" />
                <p className="font-medium">Открытых задач в этом периоде нет</p>
                <p className="text-muted mt-1 text-sm">Выберите другой период или измените фильтры.</p>
              </div>
            )}
            <div className="border-subtle border-t pt-4">
              <Button variant="ghost" onClick={() => setShowCompleted((v) => !v)} aria-expanded={showCompleted}>
                Выполненные · {completed.length}
              </Button>
              {showCompleted && (
                <div className={view === "grid" ? "mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "mt-3 space-y-2"}>
                  {completed.length ? (
                    completed.map((t) => (
                      <BoardTaskCard
                        key={t.id}
                        task={t}
                        today={today}
                        layout={view}
                        busy={false}
                        onOpen={() => void open(t)}
                        onComplete={() => {}}
                      />
                    ))
                  ) : (
                    <p className="text-muted p-3 text-sm">Выполненных задач в этом периоде нет.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )
      )}
      <TaskEditor
        open={editor != null}
        task={editor === "new" ? null : editor}
        timezone={timezone ?? "Europe/Moscow"}
        positions={positions}
        members={members}
        onClose={() => setEditor(null)}
        onSave={save}
      />
      {selected && (
        <TaskDetails
          task={selected}
          canManage={canManage}
          busy={busy === selected.id}
          error={error}
          onClose={() => setSelected(null)}
          onComplete={() => void action(selected, () => completeTask(selected.id))}
          onUndo={() => void action(selected, () => undoTaskCompletion(selected.id))}
          onEdit={() => {
            setEditor(selected);
            setSelected(null);
          }}
          onDelete={() => setDeleteTarget(selected)}
          onReopen={() => setReopenTarget(selected)}
        />
      )}
      <ConfirmDialog
        open={deleteTarget != null}
        title="Удалить задачу?"
        description="Задача исчезнет с доски. Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setError(null);
          try {
            await deleteTask(deleteTarget.id);
            setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
            setSelected(null);
            setDeleteTarget(null);
          } catch (e) {
            setDeleteTarget(null);
            setError(message(e));
          }
        }}
      />
      <ConfirmDialog
        open={reopenTarget != null}
        title="Вернуть задачу в работу?"
        description="Текущие отметки выполнения будут сброшены. Предыдущие события останутся в истории."
        confirmText="Вернуть в работу"
        cancelText="Отмена"
        onCancel={() => setReopenTarget(null)}
        onConfirm={async () => {
          if (!reopenTarget) return;
          await action(reopenTarget, () => reopenTask(reopenTarget.id, reopenTarget.version));
          setReopenTarget(null);
        }}
      />
    </div>
  );
}

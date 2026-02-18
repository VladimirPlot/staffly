import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Icon from "../../../shared/ui/Icon";
import PageLoader from "../../../shared/ui/PageLoader";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import { fetchMyRoleIn, listMembers, type MemberDto } from "../../employees/api";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import TaskCard from "../components/TaskCard";
import TaskCreateModal from "../components/TaskCreateModal";
import TaskDetailModal from "../components/TaskDetailModal";
import TaskGroup from "../components/TaskGroup";
import {
  completeTask,
  createTask,
  deleteTask,
  listTaskComments,
  listTasks,
  createTaskComment,
  type TaskCommentDto,
  type TaskCommentPageDto,
  type TaskDto,
  type TaskScope,
} from "../api";
import { isOverdue, sortTasks } from "../utils";

const COMMENTS_PAGE_SIZE = 10;

const readStoredGroupState = (key: string) => {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(key);
  return stored === "true";
};

const writeStoredGroupState = (key: string, value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value ? "true" : "false");
};

const TasksPage = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = useState<string | null>(null);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [scope, setScope] = useState<TaskScope>("MINE");
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDto | null>(null);
  const [comments, setComments] = useState<TaskCommentDto[]>([]);
  const [commentPage, setCommentPage] = useState(0);
  const [commentHasNext, setCommentHasNext] = useState(false);
  const [commentLoadingMore, setCommentLoadingMore] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskDto | null>(null);
  const [activeOpen, setActiveOpen] = useState(() => readStoredGroupState("tasks:groupOpen:active"));
  const [overdueOpen, setOverdueOpen] = useState(() => readStoredGroupState("tasks:groupOpen:overdue"));
  const [completedOpen, setCompletedOpen] = useState(() => readStoredGroupState("tasks:groupOpen:completed"));

  const access = useMemo(() => resolveRestaurantAccess(user?.roles, myRole), [user?.roles, myRole]);
  const canManage = access.isManagerLike;

  useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setMyRole(null);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        const role = await fetchMyRoleIn(restaurantId);
        if (alive) setMyRole(role);
      } catch {
        if (alive) setMyRole(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!canManage) {
      setScope("MINE");
    }
  }, [canManage]);

  useEffect(() => {
    let alive = true;
    if (!restaurantId) {
      setTasks([]);
      return () => {
        alive = false;
      };
    }
    setLoading(true);
    (async () => {
      try {
        const data = await listTasks(restaurantId, { scope });
        if (alive) setTasks(data);
      } catch (err) {
        console.error("Failed to load tasks", err);
        if (alive) setTasks([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId, scope]);

  useEffect(() => {
    let alive = true;
    if (!restaurantId || !canManage) {
      setPositions([]);
      setMembers([]);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        const [positionsData, membersData] = await Promise.all([
          listPositions(restaurantId, { includeInactive: false }),
          listMembers(restaurantId),
        ]);
        if (!alive) return;
        setPositions(positionsData.filter((position) => position.active));
        setMembers(membersData);
      } catch (err) {
        console.error("Failed to load task dictionaries", err);
        if (!alive) return;
        setPositions([]);
        setMembers([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [restaurantId, canManage]);

  const reloadTasks = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const data = await listTasks(restaurantId, { scope });
      setTasks(data);
    } catch (err) {
      console.error("Failed to reload tasks", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, scope]);

  const handleComplete = useCallback(async (task: TaskDto) => {
    try {
      const updated = await completeTask(task.id);
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
      setSelectedTask((prev) => (prev?.id === task.id ? updated : prev));
    } catch (err) {
      console.error("Failed to complete task", err);
    }
  }, []);

  const handleDelete = useCallback(async (task: TaskDto) => {
    setDeleteTarget(task);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteTask(deleteTarget.id);
      setTasks((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      if (selectedTask?.id === deleteTarget.id) {
        setSelectedTask(null);
      }
    } catch (err) {
      console.error("Failed to delete task", err);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, selectedTask?.id]);

  const handleOpenTask = useCallback((task: TaskDto) => {
    setSelectedTask(task);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!selectedTask) {
      setComments([]);
      setCommentPage(0);
      setCommentHasNext(false);
      setCommentValue("");
      return;
    }
    (async () => {
      try {
        const data = await listTaskComments(selectedTask.id, { page: 0, size: COMMENTS_PAGE_SIZE });
        if (!alive) return;
        setComments(data.items);
        setCommentPage(data.page);
        setCommentHasNext(data.hasNext);
      } catch (err) {
        console.error("Failed to load comments", err);
        if (!alive) return;
        setComments([]);
        setCommentPage(0);
        setCommentHasNext(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedTask]);

  const handleAddComment = useCallback(async () => {
    if (!selectedTask || !commentValue.trim()) return;
    setCommentLoading(true);
    try {
      const comment = await createTaskComment(selectedTask.id, { text: commentValue });
      setComments((prev) => [...prev, comment]);
      setCommentValue("");
    } catch (err) {
      console.error("Failed to add comment", err);
    } finally {
      setCommentLoading(false);
    }
  }, [selectedTask, commentValue]);

  const handleLoadMoreComments = useCallback(async () => {
    if (!selectedTask || !commentHasNext || commentLoadingMore) return;
    setCommentLoadingMore(true);
    try {
      const nextPage = commentPage + 1;
      const data: TaskCommentPageDto = await listTaskComments(selectedTask.id, {
        page: nextPage,
        size: COMMENTS_PAGE_SIZE,
      });
      setComments((prev) => [...prev, ...data.items]);
      setCommentPage(data.page);
      setCommentHasNext(data.hasNext);
    } catch (err) {
      console.error("Failed to load more comments", err);
    } finally {
      setCommentLoadingMore(false);
    }
  }, [selectedTask, commentHasNext, commentLoadingMore, commentPage]);

  const activeTasks = useMemo(
    () => sortTasks(tasks.filter((task) => task.status === "ACTIVE" && !isOverdue(task.dueDate))),
    [tasks]
  );

  const overdueTasks = useMemo(
    () => sortTasks(tasks.filter((task) => task.status === "ACTIVE" && isOverdue(task.dueDate))),
    [tasks]
  );

  const completedTasks = useMemo(
    () => sortTasks(tasks.filter((task) => task.status === "COMPLETED")),
    [tasks]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="mb-3">
        <BackToHome />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">Задачи</h2>
          <p className="text-sm text-muted">Доска задач ресторана.</p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant={scope === "MINE" ? "primary" : "outline"}
              onClick={() => setScope("MINE")}
            >
              Мои
            </Button>
            <Button
              type="button"
              variant={scope === "ALL" ? "primary" : "outline"}
              onClick={() => setScope("ALL")}
            >
              Все
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={() => setCreateOpen(true)}
              aria-label="Создать задачу"
              leftIcon={<Icon icon={Plus} size="sm" />}
            />
          </div>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-4">
          <TaskGroup
            title="Активные"
            count={activeTasks.length}
            defaultOpen={false}
            open={activeOpen}
            onToggle={(openValue) => {
              setActiveOpen(openValue);
              writeStoredGroupState("tasks:groupOpen:active", openValue);
            }}
          >
            {activeTasks.length === 0 ? (
              <div className="rounded-2xl border border-subtle bg-surface p-4 text-sm text-muted">
                Активных задач нет.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {activeTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={handleOpenTask}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    canDelete={canManage}
                  />
                ))}
              </div>
            )}
          </TaskGroup>

          <TaskGroup
            title="Просрочено"
            count={overdueTasks.length}
            defaultOpen={false}
            open={overdueOpen}
            onToggle={(openValue) => {
              setOverdueOpen(openValue);
              writeStoredGroupState("tasks:groupOpen:overdue", openValue);
            }}
          >
            {overdueTasks.length === 0 ? (
              <div className="rounded-2xl border border-subtle bg-surface p-4 text-sm text-muted">
                Просроченных задач нет.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {overdueTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={handleOpenTask}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    canDelete={canManage}
                  />
                ))}
              </div>
            )}
          </TaskGroup>

          <TaskGroup
            title="Выполнено"
            count={completedTasks.length}
            defaultOpen={false}
            open={completedOpen}
            onToggle={(openValue) => {
              setCompletedOpen(openValue);
              writeStoredGroupState("tasks:groupOpen:completed", openValue);
            }}
          >
            {completedTasks.length === 0 ? (
              <div className="rounded-2xl border border-subtle bg-surface p-4 text-sm text-muted">
                Выполненных задач нет.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={handleOpenTask}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    canDelete={canManage}
                  />
                ))}
              </div>
            )}
          </TaskGroup>
        </div>
      )}

      <TaskCreateModal
        open={createOpen}
        positions={positions}
        members={members}
        onClose={() => setCreateOpen(false)}
        onCreate={async (payload) => {
          if (!restaurantId) return;
          await createTask(restaurantId, payload);
          await reloadTasks();
        }}
      />

      <TaskDetailModal
        open={Boolean(selectedTask)}
        task={selectedTask}
        comments={comments}
        commentValue={commentValue}
        commentLoading={commentLoading}
        commentHasNext={commentHasNext}
        commentLoadingMore={commentLoadingMore}
        onCommentChange={setCommentValue}
        onAddComment={handleAddComment}
        onLoadMoreComments={handleLoadMoreComments}
        onComplete={handleComplete}
        onDelete={handleDelete}
        onClose={() => setSelectedTask(null)}
        canDelete={canManage}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить задачу?"
        description="Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default TasksPage;

import React from "react";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
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
  type TaskDto,
  type TaskScope,
} from "../api";
import { isOverdue, sortTasks } from "../utils";

const TasksPage: React.FC = () => {
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const [myRole, setMyRole] = React.useState<string | null>(null);
  const [positions, setPositions] = React.useState<PositionDto[]>([]);
  const [members, setMembers] = React.useState<MemberDto[]>([]);
  const [scope, setScope] = React.useState<TaskScope>("MINE");
  const [tasks, setTasks] = React.useState<TaskDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<TaskDto | null>(null);
  const [comments, setComments] = React.useState<TaskCommentDto[]>([]);
  const [commentValue, setCommentValue] = React.useState("");
  const [commentLoading, setCommentLoading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<TaskDto | null>(null);

  const access = React.useMemo(
    () => resolveRestaurantAccess(user?.roles, myRole),
    [user?.roles, myRole]
  );
  const canManage = access.isManagerLike;

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (!canManage) {
      setScope("MINE");
    }
  }, [canManage]);

  React.useEffect(() => {
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

  React.useEffect(() => {
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

  const reloadTasks = React.useCallback(async () => {
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

  const handleComplete = React.useCallback(
    async (task: TaskDto) => {
      try {
        const updated = await completeTask(task.id);
        setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
        setSelectedTask((prev) => (prev?.id === task.id ? updated : prev));
      } catch (err) {
        console.error("Failed to complete task", err);
      }
    },
    []
  );

  const handleDelete = React.useCallback(
    async (task: TaskDto) => {
      setDeleteTarget(task);
    },
    []
  );

  const confirmDelete = React.useCallback(async () => {
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

  const handleOpenTask = React.useCallback((task: TaskDto) => {
    setSelectedTask(task);
  }, []);

  React.useEffect(() => {
    let alive = true;
    if (!selectedTask) {
      setComments([]);
      setCommentValue("");
      return;
    }
    (async () => {
      try {
        const data = await listTaskComments(selectedTask.id);
        if (alive) setComments(data);
      } catch (err) {
        console.error("Failed to load comments", err);
        if (alive) setComments([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedTask]);

  const handleAddComment = React.useCallback(async () => {
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

  const activeTasks = React.useMemo(
    () =>
      sortTasks(tasks.filter((task) => task.status === "ACTIVE" && !isOverdue(task.dueDate))),
    [tasks]
  );

  const overdueTasks = React.useMemo(
    () => sortTasks(tasks.filter((task) => task.status === "ACTIVE" && isOverdue(task.dueDate))),
    [tasks]
  );

  const completedTasks = React.useMemo(
    () => sortTasks(tasks.filter((task) => task.status === "COMPLETED")),
    [tasks]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="mb-3">
        <BackToHome />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Задачи</h2>
          <p className="text-sm text-zinc-600">Доска задач ресторана.</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} aria-label="Создать задачу">
            +
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canManage ? (
          <>
            <Button variant={scope === "MINE" ? "primary" : "outline"} onClick={() => setScope("MINE")}>
              Мои
            </Button>
            <Button variant={scope === "ALL" ? "primary" : "outline"} onClick={() => setScope("ALL")}>
              Все
            </Button>
          </>
        ) : (
          <span className="text-sm text-zinc-500">Мои задачи</span>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-zinc-500">Загружаем задачи…</div>
      ) : (
        <div className="space-y-4">
          <TaskGroup title="Активные" count={activeTasks.length}>
            {activeTasks.length === 0 ? (
              <div className="text-sm text-zinc-500">Активных задач нет.</div>
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

          <TaskGroup title="Просрочено" count={overdueTasks.length}>
            {overdueTasks.length === 0 ? (
              <div className="text-sm text-zinc-500">Просроченных задач нет.</div>
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

          <TaskGroup title="Выполнено" count={completedTasks.length}>
            {completedTasks.length === 0 ? (
              <div className="text-sm text-zinc-500">Выполненных задач нет.</div>
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
        onCommentChange={setCommentValue}
        onAddComment={handleAddComment}
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

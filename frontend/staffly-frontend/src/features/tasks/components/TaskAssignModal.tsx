import { useEffect, useState } from "react";
import Modal from "../../../shared/ui/Modal";
import Button from "../../../shared/ui/Button";
import SelectField from "../../../shared/ui/SelectField";
import { listMembers, type MemberDto } from "../../employees/api";
import { assignTask, fetchTask, type TaskDto } from "../api";
import { isUnassignedTask } from "../utils";

type Props = {
  task: TaskDto;
  onClose: () => void;
  onTaskUpdated: (task: TaskDto) => void;
};

export default function TaskAssignModal({ task, onClose, onTaskUpdated }: Props) {
  const [currentTask, setCurrentTask] = useState<TaskDto | null>(null);
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [memberId, setMemberId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setMemberId("");
    setCurrentTask(null);
    setError(null);
    Promise.all([fetchTask(task.id), listMembers(task.restaurantId)])
      .then(([latest, candidates]) => {
        if (!alive) return;
        setCurrentTask(latest);
        onTaskUpdated(latest);
        setMembers([...candidates].sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? "", "ru")));
      })
      .catch(() => {
        if (alive) setError("Не удалось загрузить задачу и сотрудников. Попробуйте обновить список.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [task.id, task.restaurantId, revision, onTaskUpdated]);

  const canAssign = currentTask != null && isUnassignedTask(currentTask);
  const submit = async () => {
    if (!canAssign || !memberId || loading || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await assignTask(task.id, Number(memberId), currentTask.version);
      onTaskUpdated(updated);
      onClose();
    } catch (err: unknown) {
      const failure = err as { friendlyMessage?: string; response?: { status?: number } };
      setError(
        failure.response?.status === 409
          ? "Задача изменилась. Обновите список перед назначением."
          : failure.friendlyMessage || "Не удалось назначить исполнителя. Обновите список и попробуйте снова.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      title="Назначить исполнителя"
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={!canAssign || !memberId || loading || submitting}>
            {submitting ? "Назначаем…" : "Назначить"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-strong font-medium">{currentTask?.title ?? task.title}</p>
        <p className="text-muted text-sm">
          Выберите действующего сотрудника ресторана. Он получит уведомление о задаче.
        </p>
        {loading ? (
          <p className="text-muted text-sm">Загружаем…</p>
        ) : canAssign ? (
          <SelectField
            label="Исполнитель"
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            disabled={submitting}
          >
            <option value="">Выберите сотрудника</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName || `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() || member.phone}
                {member.positionName ? ` · ${member.positionName}` : ""}
              </option>
            ))}
          </SelectField>
        ) : (
          currentTask && <p className="text-muted text-sm">Задача уже назначена или завершена.</p>
        )}
        {!loading && canAssign && members.length === 0 && (
          <p className="text-muted text-sm">Нет доступных сотрудников.</p>
        )}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button variant="outline" onClick={() => setRevision((value) => value + 1)} disabled={loading || submitting}>
          Обновить список
        </Button>
      </div>
    </Modal>
  );
}

import React from "react";
import Modal from "../../../shared/ui/Modal";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import SelectField from "../../../shared/ui/SelectField";
import Button from "../../../shared/ui/Button";
import type { TaskCreateRequest, TaskPriority } from "../api";
import type { PositionDto } from "../../dictionaries/api";
import type { MemberDto } from "../../employees/api";

type TaskCreateModalProps = {
  open: boolean;
  positions: PositionDto[];
  members: MemberDto[];
  onClose: () => void;
  onCreate: (payload: TaskCreateRequest) => Promise<void>;
};

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: "HIGH", label: "Высокий" },
  { value: "MEDIUM", label: "Средний" },
  { value: "LOW", label: "Низкий" },
];

function formatMemberName(member: MemberDto): string {
  if (member.fullName) return member.fullName;
  const first = member.firstName ?? "";
  const last = member.lastName ?? "";
  return `${first} ${last}`.trim() || member.phone || "Сотрудник";
}

const TaskCreateModal: React.FC<TaskCreateModalProps> = ({ open, positions, members, onClose, onCreate }) => {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = React.useState("");
  const [assignee, setAssignee] = React.useState("none");
  const [positionId, setPositionId] = React.useState<number | null>(null);
  const [memberId, setMemberId] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setDueDate("");
    setAssignee("none");
    setPositionId(null);
    setMemberId(null);
    setError(null);
  }, [open]);

  const handleAssigneeChange = (value: string) => {
    setAssignee(value);
    if (value === "none" || value === "all") {
      setPositionId(null);
      setMemberId(null);
    } else if (value.startsWith("position:")) {
      const id = Number(value.replace("position:", ""));
      setPositionId(Number.isNaN(id) ? null : id);
      setMemberId(null);
    }
  };

  const filteredMembers = React.useMemo(() => {
    if (!positionId) return [];
    return members.filter((member) => member.positionId === positionId);
  }, [members, positionId]);

  const todayIso = React.useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, "0");
    const day = `${now.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Название обязательно");
      return;
    }
    if (!dueDate) {
      setError("Нужно указать срок");
      return;
    }
    const payload: TaskCreateRequest = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate,
    };

    if (assignee === "all") {
      payload.assignedToAll = true;
    } else if (assignee.startsWith("position:") && positionId) {
      if (memberId) {
        payload.assignedUserId = memberId;
      } else {
        payload.assignedPositionId = positionId;
      }
    }

    setSubmitting(true);
    try {
      await onCreate(payload);
      onClose();
    } catch (err) {
      console.error("Failed to create task", err);
      setError("Не удалось создать задачу");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Новая задача"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отменить
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Создаём…" : "Создать"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Название"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Например, проверить поставку"
          maxLength={200}
        />
        <Textarea
          label="Описание"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Опционально"
          rows={4}
        />

        <SelectField label="Кому" value={assignee} onChange={(event) => handleAssigneeChange(event.target.value)}>
          <option value="none">Никому</option>
          <option value="all">Всем</option>
          {positions.map((position) => (
            <option key={position.id} value={`position:${position.id}`}>
              {position.name}
            </option>
          ))}
        </SelectField>

        {assignee.startsWith("position:") && positionId && (
          <SelectField
            label="Выберите сотрудника"
            value={memberId ? String(memberId) : "all"}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "all") {
                setMemberId(null);
              } else {
                setMemberId(Number(value));
              }
            }}
          >
            <option value="all">Всем</option>
            {filteredMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {formatMemberName(member)}
              </option>
            ))}
          </SelectField>
        )}

        <Input
          label="Срок"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          min={todayIso}
        />

        <SelectField
          label="Приоритет"
          value={priority}
          onChange={(event) => setPriority(event.target.value as TaskPriority)}
        >
          {priorityOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectField>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </Modal>
  );
};

export default TaskCreateModal;

import { useEffect, useState } from "react";
import Modal from "../../../shared/ui/Modal";
import Input from "../../../shared/ui/Input";
import Textarea from "../../../shared/ui/Textarea";
import SelectField from "../../../shared/ui/SelectField";
import Button from "../../../shared/ui/Button";
import AnnouncementRecipientPicker from "../../announcements/AnnouncementRecipientPicker";
import type { TaskCreateRequest, TaskDto, TaskPriority } from "../api";
import type { PositionDto } from "../../dictionaries/api";
import type { MemberDto } from "../../employees/api";
import { priorityLabels, restaurantToday } from "../utils";

type Props = {
  open: boolean;
  task?: TaskDto | null;
  timezone: string;
  positions: PositionDto[];
  members: MemberDto[];
  onClose: () => void;
  onSave: (payload: TaskCreateRequest) => Promise<void>;
};

export default function TaskEditor({ open, task, timezone, positions, members, onClose, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [mode, setMode] = useState<TaskDto["completionMode"]>("ANY");
  const [audience, setAudience] = useState<TaskDto["audience"]>("NONE");
  const [positionIds, setPositionIds] = useState<number[]>([]);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [ownerId, setOwnerId] = useState<number | undefined>();
  const [reset, setReset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? "MEDIUM");
    setDueDate(task?.dueDate ?? restaurantToday(timezone));
    setDueTime(task?.dueTime?.slice(0, 5) ?? "");
    setMode(task?.completionMode ?? "ANY");
    setAudience(task?.audience ?? "NONE");
    setPositionIds(
      task?.positionIds.length
        ? task.positionIds
        : [
            ...new Set(
              task?.participants
                .filter((p) => p.active)
                .map((p) => members.find((m) => m.id === p.memberId)?.positionId)
                .filter((id): id is number => id != null) ?? [],
            ),
          ],
    );
    setMemberIds(task?.audience === "MEMBERS" ? task.participants.filter((p) => p.active).map((p) => p.memberId) : []);
    setOwnerId(task?.ownerMemberId);
    setReset(false);
    setError(null);
  }, [open, task, timezone, members]);
  const candidates = members.filter((m) => m.positionId != null && positionIds.includes(m.positionId));
  const rosterChanged =
    task && (task.audience !== audience || [...task.positionIds].sort().join() !== [...positionIds].sort().join());
  const recipientCount =
    audience === "ALL"
      ? members.length
      : audience === "POSITIONS"
        ? candidates.length
        : audience === "MEMBERS"
          ? memberIds.length
          : 0;
  const instructionChanged =
    task &&
    (task.title !== title.trim() || (task.description ?? "") !== description.trim() || task.completionMode !== mode);
  const needsReset = instructionChanged && task.participants.some((p) => p.completedAt);
  async function submit() {
    if (!title.trim() || !dueDate) return setError("Укажите название и срок");
    if ((audience === "POSITIONS" && !positionIds.length) || (audience === "MEMBERS" && !memberIds.length))
      return setError("Выберите исполнителей");
    if (needsReset && !reset) return setError("Подтвердите сброс отметок после изменения инструкции");
    setSubmitting(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate,
        dueTime: dueTime || null,
        completionMode: mode,
        audience,
        positionIds: audience === "POSITIONS" || audience === "MEMBERS" ? positionIds : [],
        memberIds: audience === "MEMBERS" ? memberIds : [],
        ownerMemberId: ownerId,
        expectedVersion: task?.version,
        confirmResetProgress: reset,
      });
      onClose();
    } catch (e) {
      setError((e as { friendlyMessage?: string }).friendlyMessage ?? "Не удалось сохранить задачу");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Modal
      open={open}
      title={task ? "Редактировать задачу" : "Новая задача"}
      onClose={() => {
        if (!submitting) onClose();
      }}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Сохраняем…" : "Сохранить"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Например, провести инвентаризацию бара"
          disabled={submitting}
        />
        <Textarea
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={20000}
          disabled={submitting}
        />
        <SelectField
          label="Кому назначить"
          value={audience === "MEMBERS" ? "POSITIONS" : audience}
          disabled={submitting}
          onChange={(e) => {
            setAudience(e.target.value as TaskDto["audience"]);
            setPositionIds([]);
            setMemberIds([]);
          }}
        >
          <option value="NONE">Без исполнителей</option>
          <option value="ALL">Всем сотрудникам ресторана</option>
          <option value="POSITIONS">Выбрать должности и участников</option>
        </SelectField>
        {(audience === "POSITIONS" || audience === "MEMBERS") && (
          <>
            <AnnouncementRecipientPicker
              label="Должности"
              options={positions.map((p) => ({ id: p.id, name: p.name }))}
              selectedIds={positionIds}
              placeholder="Выберите должности"
              disabled={submitting}
              onChange={(ids) => {
                setPositionIds(ids);
                setMemberIds((prev) =>
                  prev.filter((id) =>
                    members.some((m) => m.id === id && m.positionId != null && ids.includes(m.positionId)),
                  ),
                );
              }}
            />
            {!!positionIds.length && (
              <AnnouncementRecipientPicker
                label="Участники"
                options={candidates.map((m) => ({
                  id: m.id,
                  name: m.fullName ?? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim(),
                  detail: m.positionName ?? "",
                }))}
                selectedIds={memberIds}
                placeholder={audience === "POSITIONS" ? "Все сотрудники выбранных должностей" : "Выберите сотрудников"}
                disabled={submitting}
                onChange={(ids) => {
                  setAudience("MEMBERS");
                  setMemberIds(ids);
                }}
                resetOption={{
                  label: "Все сотрудники выбранных должностей",
                  selected: audience === "POSITIONS",
                  onSelect: () => {
                    setAudience("POSITIONS");
                    setMemberIds([]);
                  },
                }}
              />
            )}
          </>
        )}
        <p className="text-muted text-sm">
          {task?.completionMode === "EACH" && mode === "EACH" && !rosterChanged && audience !== "MEMBERS"
            ? `Текущий состав: ${task.participantCount} сотрудников. Новые участники добавляются через кадровые операции.`
            : `Исполнителей: ${recipientCount}`}
        </p>
        <fieldset className="border-subtle space-y-2 rounded-2xl border p-3">
          <legend className="px-1 text-sm">Условие выполнения</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="task-mode"
              checked={mode === "ANY"}
              disabled={submitting}
              onChange={() => setMode("ANY")}
            />
            <span>
              Достаточно одного исполнителя
              <span className="text-muted block text-xs">Один сотрудник завершает общую задачу</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="task-mode"
              checked={mode === "EACH"}
              disabled={submitting}
              onChange={() => setMode("EACH")}
            />
            <span>
              Должен выполнить каждый<span className="text-muted block text-xs">Каждый отмечает свой результат</span>
            </span>
          </label>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Дата выполнения"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={submitting}
          />
          <SelectField
            label="Время выполнения"
            value={dueTime ? "CUSTOM" : "END_OF_DAY"}
            onChange={(e) => setDueTime(e.target.value === "END_OF_DAY" ? "" : "12:00")}
            disabled={submitting}
          >
            <option value="END_OF_DAY">До конца дня</option>
            <option value="CUSTOM">Указать время</option>
          </SelectField>
          {dueTime && (
            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
              <SelectField
                label="Часы"
                value={dueTime.split(":")[0]}
                onChange={(e) => setDueTime(`${e.target.value}:${dueTime.split(":")[1]}`)}
                disabled={submitting}
              >
                {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Минуты"
                value={dueTime.split(":")[1]}
                onChange={(e) => setDueTime(`${dueTime.split(":")[0]}:${e.target.value}`)}
                disabled={submitting}
              >
                {["00", "15", "30", "45"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </SelectField>
            </div>
          )}
          <SelectField
            label="Приоритет"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            disabled={submitting}
          >
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        {task && (
          <SelectField
            label="Владелец задачи"
            value={ownerId ?? ""}
            onChange={(e) => setOwnerId(Number(e.target.value))}
            disabled={submitting}
          >
            {members
              .filter((m) => m.role === "ADMIN" || m.role === "MANAGER")
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
          </SelectField>
        )}
        {needsReset && (
          <label className="bg-app flex gap-2 rounded-xl p-3 text-sm">
            <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} disabled={submitting} />
            Изменение инструкции или режима сбросит отметки выполнения. Подтверждаю сброс.
          </label>
        )}
        {rosterChanged && task.completionMode === "EACH" && (
          <p className="text-muted text-sm">
            Состав будет пересчитан. Результаты исключённых сотрудников сохранятся в истории.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

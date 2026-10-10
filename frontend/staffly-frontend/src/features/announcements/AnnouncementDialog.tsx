import { useEffect, useRef, useState } from "react";
import Modal from "../../shared/ui/Modal";
import Textarea from "../../shared/ui/Textarea";
import Button from "../../shared/ui/Button";
import SelectField from "../../shared/ui/SelectField";
import type { AnnouncementAudience, AnnouncementAudienceOptionsDto, AnnouncementRequest } from "./api";
import AnnouncementRecipientPicker from "./AnnouncementRecipientPicker";
import {
  announcementRecipients,
  announcementSubmissionKey,
  membersForPositions,
  reconcileSelectedMembers,
} from "./audience";

type Props = {
  open: boolean;
  options: AnnouncementAudienceOptionsDto | null;
  loading: boolean;
  loadingError: string | null;
  submitting: boolean;
  error?: string | null;
  onReload: () => void;
  onClose: () => void;
  onSubmit: (payload: AnnouncementRequest) => void;
};

export default function AnnouncementDialog({
  open,
  options,
  loading,
  loadingError,
  submitting,
  error,
  onReload,
  onClose,
  onSubmit,
}: Props) {
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("ALL");
  const [positionIds, setPositionIds] = useState<number[]>([]);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const submission = useRef<{ key: string; operationId: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setContent("");
    setAudience("ALL");
    setPositionIds([]);
    setMemberIds([]);
    setLocalError(null);
    submission.current = null;
  }, [open]);

  const members = options?.members ?? [];
  const candidates = membersForPositions(members, positionIds);
  const recipients = announcementRecipients(audience, members, positionIds, memberIds);
  const selectedUnavailable = audience === "MEMBERS" && recipients.length !== memberIds.length;
  const positionsUnavailable =
    audience !== "ALL" && positionIds.some((id) => !options?.positions.some((position) => position.id === id));
  const ready = Boolean(options) && !loading && !loadingError;
  const positionOptions = (options?.positions ?? []).map((position) => ({
    id: position.id,
    name: position.name,
    detail: position.active ? undefined : "Неактивна",
  }));
  for (const id of positionIds) {
    if (!positionOptions.some((position) => position.id === id)) {
      positionOptions.push({ id, name: "Недоступная должность", detail: "Уберите из выбора" });
    }
  }
  const memberOptions = candidates.map((member) => ({ id: member.id, name: member.name, detail: member.positionName }));
  for (const id of memberIds) {
    if (!memberOptions.some((member) => member.id === id)) {
      memberOptions.push({ id, name: "Недоступный участник", detail: "Уберите из выбора" });
    }
  }

  function changePositions(ids: number[]) {
    setPositionIds(ids);
    setMemberIds(reconcileSelectedMembers(members, ids, memberIds));
    setLocalError(null);
    // Keep MEMBERS even if its last selected person disappears; never silently broaden a send.
  }

  function submit() {
    const text = content.trim();
    if (!text) {
      setLocalError("Добавьте текст объявления");
      return;
    }
    if (audience !== "ALL" && positionIds.length === 0) {
      setLocalError("Выберите хотя бы одну должность");
      return;
    }
    if (!ready || selectedUnavailable || positionsUnavailable) {
      setLocalError("Обновите список и проверьте выбранных получателей");
      return;
    }
    if (recipients.length === 0) {
      setLocalError("Выберите получателей объявления");
      return;
    }
    setLocalError(null);
    const payload = {
      content: text,
      audience,
      positionIds: audience === "ALL" ? [] : positionIds,
      memberIds: audience === "MEMBERS" ? memberIds : [],
    };
    const key = announcementSubmissionKey(payload);
    if (!submission.current || submission.current.key !== key) {
      submission.current = { key, operationId: crypto.randomUUID() };
    }
    onSubmit({ ...payload, operationId: submission.current.operationId });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать объявление"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || !ready || recipients.length === 0 || selectedUnavailable || positionsUnavailable}
          >
            {submitting ? "Отправляем…" : "Отправить"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SelectField
          label="Получатели"
          value={audience === "ALL" ? "ALL" : "POSITIONS"}
          disabled={submitting || !ready}
          onChange={(event) => {
            setAudience(event.target.value as "ALL" | "POSITIONS");
            setPositionIds([]);
            setMemberIds([]);
            setLocalError(null);
          }}
        >
          <option value="ALL">Всем участникам ресторана</option>
          <option value="POSITIONS">Выбрать должности и участников</option>
        </SelectField>
        {loading && (
          <div className="text-muted text-sm" role="status">
            Загружаем получателей…
          </div>
        )}
        {loadingError && (
          <div className="space-y-2 text-sm text-red-600" role="alert">
            <div>{loadingError}</div>
            <Button variant="outline" onClick={onReload} disabled={loading || submitting}>
              Повторить
            </Button>
          </div>
        )}
        {audience !== "ALL" && ready && (
          <AnnouncementRecipientPicker
            label="Должности"
            options={positionOptions}
            selectedIds={positionIds}
            placeholder="Выберите должности"
            disabled={submitting}
            onChange={changePositions}
          />
        )}
        {audience !== "ALL" && positionIds.length > 0 && ready && (
          <AnnouncementRecipientPicker
            label="Участники"
            options={memberOptions}
            selectedIds={memberIds}
            placeholder={audience === "POSITIONS" ? "Все участники выбранных должностей" : "Выберите участников"}
            disabled={submitting}
            onChange={(ids) => {
              setAudience("MEMBERS");
              setMemberIds(ids);
              setLocalError(null);
            }}
            resetOption={{
              label: "Все участники выбранных должностей",
              selected: audience === "POSITIONS",
              onSelect: () => {
                setAudience("POSITIONS");
                setMemberIds([]);
                setLocalError(null);
              },
            }}
          />
        )}
        {ready && (
          <div className="text-muted text-sm" aria-live="polite">
            Получателей: {recipients.length}
          </div>
        )}
        {ready && (selectedUnavailable || positionsUnavailable) && (
          <div className="text-sm text-red-600" role="alert">
            Состав участников изменился. Проверьте выбранных получателей.
          </div>
        )}
        {ready && recipients.length === 0 && <div className="text-muted text-sm">Нет выбранных получателей.</div>}
        {ready && (
          <Button variant="ghost" onClick={onReload} disabled={submitting}>
            Обновить получателей
          </Button>
        )}
        <Textarea
          label="Объявление"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={6}
          maxLength={2000}
          hint={`${content.length} / 2000`}
          disabled={submitting}
          className="resize-y"
        />
        {(error || localError) && (
          <div className="text-sm text-red-600" role="alert">
            {error || localError}
          </div>
        )}
      </div>
    </Modal>
  );
}

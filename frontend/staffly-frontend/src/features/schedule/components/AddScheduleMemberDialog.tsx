import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import type { AddableScheduleMember } from "../api";

type AddScheduleMemberDialogProps = {
  open: boolean;
  members: AddableScheduleMember[];
  addingMemberId: number | null;
  error: string | null;
  onClose: () => void;
  onAdd: (memberId: number) => void;
};

export default function AddScheduleMemberDialog({
  open,
  members,
  addingMemberId,
  error,
  onClose,
  onAdd,
}: AddScheduleMemberDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить сотрудника"
      description="Выберите сотрудника подходящей должности, которого ещё нет в этом графике."
      footer={
        <Button variant="outline" onClick={onClose} disabled={addingMemberId != null}>
          Отмена
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="border-subtle divide-subtle divide-y overflow-hidden rounded-xl border">
          {members.map((member) => (
            <button
              key={member.memberId}
              type="button"
              className="hover:bg-surface-muted focus-visible:ring-brand flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
              disabled={addingMemberId != null}
              onClick={() => onAdd(member.memberId)}
            >
              <span className="min-w-0">
                <span className="text-strong block truncate text-sm font-medium">
                  {member.displayName || "Без имени"}
                </span>
                <span className="text-muted block truncate text-xs">{member.positionName}</span>
              </span>
              {addingMemberId === member.memberId && <span className="text-muted text-xs">Добавление…</span>}
            </button>
          ))}
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      </div>
    </Modal>
  );
}

import { Pencil, Trash2 } from "lucide-react";
import Avatar from "../../../shared/ui/Avatar";
import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import type { MemberDto } from "../api";
import { displayNameOf, formatBirthday, ROLE_LABEL } from "../utils/memberUtils";

type MemberRowProps = {
  member: MemberDto;
  canEditMembers: boolean;
  canRemove: boolean;
  isSavingEdit: boolean;
  isRemoving: boolean;
  onEdit: (member: MemberDto) => void;
  onRemove: (member: MemberDto) => void;
};

export default function MemberRow({
  member,
  canEditMembers,
  canRemove,
  isSavingEdit,
  isRemoving,
  onEdit,
  onRemove,
}: MemberRowProps) {
  return (
    <div className="relative flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3 pr-24 sm:pr-0">
        <Avatar name={displayNameOf(member)} imageUrl={member.avatarUrl ?? undefined} className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-medium">{displayNameOf(member)}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span className="rounded-full border border-subtle px-2 py-0.5">
              {member.positionName || ROLE_LABEL[member.role]}
            </span>
          </div>
        </div>
      </div>
      <div className="min-w-0 text-sm text-default sm:mr-3">
        <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
          <span>
            Дата рождения: <span className="font-medium">{formatBirthday(member.birthDate)}</span>
          </span>
          <span className="text-muted">•</span>
          <span className="min-w-0 truncate">
            Тел: <span className="font-medium">{member.phone || "—"}</span>
          </span>
        </div>
      </div>
      <div className="absolute right-0 top-3 flex items-center gap-2 sm:static">
        {canEditMembers && (
          <Button
            variant="outline"
            size="icon"
            aria-label="Редактировать должность"
            onClick={() => onEdit(member)}
            disabled={isSavingEdit}
            leftIcon={<Icon icon={Pencil} size="sm" decorative={false} title="Редактировать" />}
          />
        )}
        {canRemove && (
          <Button
            variant="outline"
            size="icon"
            aria-label="Исключить"
            onClick={() => onRemove(member)}
            disabled={isRemoving}
            leftIcon={<Icon icon={Trash2} size="sm" decorative={false} title="Исключить" />}
          />
        )}
      </div>
    </div>
  );
}

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
  onAvatarClick?: (member: MemberDto) => void;
  onEdit: (member: MemberDto) => void;
  onRemove: (member: MemberDto) => void;
};

export default function MemberRow({
  member,
  canEditMembers,
  canRemove,
  isSavingEdit,
  isRemoving,
  onAvatarClick,
  onEdit,
  onRemove,
}: MemberRowProps) {
  return (
    <div className="relative flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3 pr-24 sm:pr-0">
        <button
          type="button"
          className={`shrink-0 rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--staffly-surface)] ${
            onAvatarClick ? "cursor-zoom-in hover:scale-[1.03]" : "cursor-default"
          }`}
          onClick={onAvatarClick ? () => onAvatarClick(member) : undefined}
          disabled={!onAvatarClick}
          aria-label={`Открыть аватар ${displayNameOf(member)}`}
          title="Открыть увеличенный аватар"
        >
          <Avatar
            name={displayNameOf(member)}
            imageUrl={member.avatarUrl ?? undefined}
            className="flex-shrink-0"
          />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-medium">{displayNameOf(member)}</div>
          <div className="text-muted mt-1 flex items-center gap-2 text-xs">
            <span className="border-subtle rounded-full border px-2 py-0.5">
              {member.positionName || ROLE_LABEL[member.role]}
            </span>
          </div>
        </div>
      </div>
      <div className="text-default min-w-0 text-sm sm:mr-3">
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
      <div className="absolute top-3 right-0 flex items-center gap-2 sm:static">
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

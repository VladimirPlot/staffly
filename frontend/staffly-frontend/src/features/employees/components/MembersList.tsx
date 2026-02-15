import Card from "../../../shared/ui/Card";
import type { MemberDto } from "../api";
import MemberRow from "./MemberRow";

type MembersListProps = {
  members: MemberDto[];
  totalMembers: number;
  loading: boolean;
  error: string | null;
  canEditMembers: boolean;
  isSavingEditMemberId: number | null;
  isRemovingMemberId: number | null;
  canRemoveMember: (member: MemberDto) => boolean;
  onEdit: (member: MemberDto) => void;
  onRemove: (member: MemberDto) => void;
};

export default function MembersList({
  members,
  totalMembers,
  loading,
  error,
  canEditMembers,
  isSavingEditMemberId,
  isRemovingMemberId,
  canRemoveMember,
  onEdit,
  onRemove,
}: MembersListProps) {
  if (loading) return <Card className="text-sm text-muted">Загрузка участников…</Card>;
  if (error) return <Card className="text-sm text-red-600">{error}</Card>;
  if (members.length === 0) {
    return (
      <Card className="text-sm text-muted">
        {totalMembers === 0 ? "Пока нет участников." : "Нет участников с выбранной должностью."}
      </Card>
    );
  }

  return (
    <div className="divide-y divide-subtle">
      {members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          canEditMembers={canEditMembers}
          canRemove={canRemoveMember(member)}
          isSavingEdit={isSavingEditMemberId === member.id}
          isRemoving={isRemovingMemberId === member.id}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

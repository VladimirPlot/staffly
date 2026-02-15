import { useMemo, useState } from "react";
import type { MemberDto } from "../api";
import { displayNameOf } from "../utils/memberUtils";

type AccessFlags = {
  isAdminLike: boolean;
  isCreator: boolean;
  isManagerLike: boolean;
};

type UseMemberRemovalParams = {
  restaurantId: number | null;
  access: AccessFlags;
  currentUserId: number | null;
  members: MemberDto[];
  myRole: MemberDto["role"] | null;
  removeMember: (memberId: number) => Promise<void>;
  onSelfRemoved: () => void;
};

export function useMemberRemoval({
  restaurantId,
  access,
  currentUserId,
  members,
  myRole,
  removeMember,
  onSelfRemoved,
}: UseMemberRemovalParams) {
  const [memberToRemove, setMemberToRemove] = useState<MemberDto | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminsCount = useMemo(
    () => members.filter((member) => member.role === "ADMIN").length,
    [members]
  );

  const isStaffInCurrentRestaurant = myRole === "STAFF";

  const canRemoveMember = (member: MemberDto) => {
    if (!currentUserId) return false;
    const isSelf = member.userId === currentUserId;

    if (!access.isManagerLike || isStaffInCurrentRestaurant) {
      return isSelf;
    }

    if (access.isAdminLike) {
      if (!access.isCreator && isSelf && member.role === "ADMIN" && adminsCount <= 1) {
        return false;
      }
      return true;
    }

    if (isSelf) return true;
    return member.role === "STAFF";
  };

  const open = (member: MemberDto) => {
    setError(null);
    setMemberToRemove(member);
  };

  const close = () => {
    if (removing) return;
    setMemberToRemove(null);
    setError(null);
  };

  const confirmRemove = async () => {
    if (!restaurantId || !memberToRemove) return;
    setRemoving(true);
    setError(null);
    try {
      await removeMember(memberToRemove.id);
      if (memberToRemove.userId === currentUserId) {
        onSelfRemoved();
      }
      setMemberToRemove(null);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Не удалось исключить участника");
    } finally {
      setRemoving(false);
    }
  };

  const title = memberToRemove
    ? currentUserId != null && memberToRemove.userId === currentUserId
      ? "Покинуть ресторан?"
      : "Исключить участника?"
    : "";

  const confirmText = memberToRemove
    ? currentUserId != null && memberToRemove.userId === currentUserId
      ? "Покинуть"
      : "Исключить"
    : "Исключить";

  const description = !memberToRemove ? null : (
    <div className="space-y-3">
      <p>
        {currentUserId != null && memberToRemove.userId === currentUserId
          ? "Вы действительно хотите покинуть ресторан? После подтверждения вы потеряете доступ к его данным."
          : `Вы действительно хотите исключить ${displayNameOf(memberToRemove)} из ресторана?`}
      </p>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );

  return {
    memberToRemove,
    removing,
    error,
    canRemoveMember,
    open,
    close,
    confirmRemove,
    title,
    confirmText,
    description,
  };
}

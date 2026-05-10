import { useMemo, useState } from "react";
import {
  getMemberResponsibilityHandoffOptions,
  submitMemberResponsibilityHandoff,
  type MemberDto,
  type MemberResponsibilityHandoffOptionsDto,
  type MemberResponsibilityHandoffRequest,
} from "../api";
import { getMemberResponsibilityItemKey } from "../components/MemberResponsibilityHandoffDialog";
import { displayNameOf } from "../utils/memberUtils";

type FriendlyError = {
  friendlyMessage?: unknown;
  message?: unknown;
  response?: {
    status?: unknown;
    data?: {
      message?: unknown;
      error?: unknown;
    };
  };
};

function asFriendlyError(error: unknown): FriendlyError {
  return typeof error === "object" && error != null ? (error as FriendlyError) : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function getFriendlyMessage(error: unknown, fallback: string): string {
  const maybeError = asFriendlyError(error);
  return (
    firstString(
      maybeError.friendlyMessage,
      maybeError.response?.data?.message,
      maybeError.response?.data?.error,
      maybeError.message,
    ) ?? fallback
  );
}

function getErrorStatus(error: unknown): unknown {
  return asFriendlyError(error).response?.status;
}

function hasHandoffItems(options: MemberResponsibilityHandoffOptionsDto): boolean {
  return options.groups.some((group) => group.items.length > 0);
}

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
  const [pendingHandoffMember, setPendingHandoffMember] = useState<MemberDto | null>(null);
  const [handoffOptions, setHandoffOptions] = useState<MemberResponsibilityHandoffOptionsDto | null>(null);
  const [handoffSelections, setHandoffSelections] = useState<Record<string, number | null>>({});
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffSaving, setHandoffSaving] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const adminsCount = useMemo(() => members.filter((member) => member.role === "ADMIN").length, [members]);

  const isStaffInCurrentRestaurant = myRole === "STAFF";

  const resetHandoff = () => {
    setPendingHandoffMember(null);
    setHandoffOptions(null);
    setHandoffSelections({});
    setHandoffError(null);
  };

  const resetRemovalState = () => {
    setMemberToRemove(null);
    setError(null);
    resetHandoff();
  };

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

  const closeHandoff = () => {
    if (handoffLoading || handoffSaving || removing) return;
    resetHandoff();
  };

  const openResponsibilityHandoff = async (member: MemberDto, originalError: unknown) => {
    if (!restaurantId) {
      setError("Не удалось открыть переназначение: ресторан не выбран");
      return;
    }

    resetHandoff();
    setHandoffLoading(true);
    try {
      const options = await getMemberResponsibilityHandoffOptions(restaurantId, member.id);
      if (!hasHandoffItems(options)) {
        setError(getFriendlyMessage(originalError, "Не удалось исключить участника"));
        return;
      }

      setMemberToRemove(null);
      setPendingHandoffMember(member);
      setHandoffOptions(options);
      setHandoffSelections(
        options.groups.reduce<Record<string, number | null>>((acc, group) => {
          for (const item of group.items) {
            acc[getMemberResponsibilityItemKey(group.type, item.id)] = item.candidates[0]?.userId ?? null;
          }
          return acc;
        }, {}),
      );
    } catch (handoffLoadError: unknown) {
      resetHandoff();
      setError(
        getFriendlyMessage(handoffLoadError, getFriendlyMessage(originalError, "Не удалось исключить участника")),
      );
    } finally {
      setHandoffLoading(false);
    }
  };

  const runRemove = async (member: MemberDto, handleResponsibilityConflict: boolean) => {
    setRemoving(true);
    setError(null);
    try {
      await removeMember(member.id);
      if (member.userId === currentUserId) {
        onSelfRemoved();
      }
      resetRemovalState();
    } catch (removeError: unknown) {
      if (handleResponsibilityConflict && getErrorStatus(removeError) === 409) {
        await openResponsibilityHandoff(member, removeError);
      } else if (handleResponsibilityConflict) {
        setError(getFriendlyMessage(removeError, "Не удалось исключить участника"));
      } else {
        setHandoffError(
          "Ответственные переназначены, но удалить участника автоматически не удалось. Повторите удаление вручную.",
        );
      }
    } finally {
      setRemoving(false);
    }
  };

  const confirmRemove = async () => {
    if (!restaurantId || !memberToRemove) return;
    await runRemove(memberToRemove, true);
  };

  const selectHandoffOwner = (key: string, ownerUserId: number | null) => {
    setHandoffSelections((prev) => ({ ...prev, [key]: ownerUserId }));
  };

  const confirmHandoff = async () => {
    if (!restaurantId || !pendingHandoffMember || !handoffOptions) return;

    const payload: MemberResponsibilityHandoffRequest = { items: [] };
    for (const group of handoffOptions.groups) {
      for (const item of group.items) {
        const selectedOwnerUserId = handoffSelections[getMemberResponsibilityItemKey(group.type, item.id)];
        if (selectedOwnerUserId == null) {
          setHandoffError("Выберите нового ответственного для каждого объекта");
          return;
        }
        payload.items.push({
          type: group.type,
          resourceId: item.id,
          newOwnerUserId: selectedOwnerUserId,
        });
      }
    }

    setHandoffSaving(true);
    setHandoffError(null);
    try {
      await submitMemberResponsibilityHandoff(restaurantId, pendingHandoffMember.id, payload);
      await runRemove(pendingHandoffMember, false);
    } catch (handoffErrorValue: unknown) {
      setHandoffError(getFriendlyMessage(handoffErrorValue, "Не удалось переназначить ответственных"));
    } finally {
      setHandoffSaving(false);
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
    pendingHandoffMember,
    handoffOptions,
    handoffSelections,
    handoffLoading,
    handoffSaving,
    handoffError,
    closeHandoff,
    selectHandoffOwner,
    confirmHandoff,
  };
}

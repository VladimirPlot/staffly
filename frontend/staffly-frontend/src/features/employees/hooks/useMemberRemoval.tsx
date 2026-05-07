import { useMemo, useState } from "react";
import {
  getScheduleOwnerReassignmentOptions,
  reassignScheduleOwners,
  type ScheduleOwnerReassignmentOptionDto,
} from "../../schedule/api";
import type { MemberDto } from "../api";
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
  return firstString(
    maybeError.friendlyMessage,
    maybeError.response?.data?.message,
    maybeError.response?.data?.error,
    maybeError.message,
  ) ?? fallback;
}

export function isScheduleOwnershipConflict(error: unknown): boolean {
  const status = asFriendlyError(error).response?.status;
  const message = getFriendlyMessage(error, "").toLocaleLowerCase("ru-RU");

  return status === 409 && message.includes("ответственным за активные или будущие графики");
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
  const [pendingReassignmentMember, setPendingReassignmentMember] = useState<MemberDto | null>(null);
  const [reassignmentOptions, setReassignmentOptions] = useState<ScheduleOwnerReassignmentOptionDto[]>([]);
  const [reassignmentSelections, setReassignmentSelections] = useState<Record<number, number | null>>({});
  const [reassignmentLoading, setReassignmentLoading] = useState(false);
  const [reassignmentSaving, setReassignmentSaving] = useState(false);
  const [reassignmentError, setReassignmentError] = useState<string | null>(null);

  const adminsCount = useMemo(() => members.filter((member) => member.role === "ADMIN").length, [members]);

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

  const closeReassignment = () => {
    if (reassignmentLoading || reassignmentSaving) return;
    setPendingReassignmentMember(null);
    setReassignmentOptions([]);
    setReassignmentSelections({});
    setReassignmentError(null);
  };

  const openScheduleReassignment = async (member: MemberDto) => {
    if (!restaurantId || member.userId == null) {
      setError("Не удалось открыть переназначение: у участника нет userId");
      return;
    }

    setMemberToRemove(null);
    setPendingReassignmentMember(member);
    setReassignmentOptions([]);
    setReassignmentSelections({});
    setReassignmentError(null);
    setReassignmentLoading(true);
    try {
      const options = await getScheduleOwnerReassignmentOptions(restaurantId, member.userId);
      setReassignmentOptions(options);
      setReassignmentSelections(
        options.reduce<Record<number, number | null>>((acc, option) => {
          acc[option.scheduleId] = option.candidates[0]?.userId ?? null;
          return acc;
        }, {}),
      );
    } catch (e: unknown) {
      setReassignmentError(getFriendlyMessage(e, "Не удалось загрузить графики для переназначения"));
    } finally {
      setReassignmentLoading(false);
    }
  };

  const runRemove = async (member: MemberDto, handleScheduleConflict: boolean) => {
    setRemoving(true);
    setError(null);
    try {
      await removeMember(member.id);
      if (member.userId === currentUserId) {
        onSelfRemoved();
      }
      setMemberToRemove(null);
      setPendingReassignmentMember(null);
      setReassignmentOptions([]);
      setReassignmentSelections({});
      setReassignmentError(null);
    } catch (e: unknown) {
      if (handleScheduleConflict && isScheduleOwnershipConflict(e)) {
        await openScheduleReassignment(member);
      } else if (handleScheduleConflict) {
        setError(getFriendlyMessage(e, "Не удалось исключить участника"));
      } else {
        setReassignmentError(
          getFriendlyMessage(
            e,
            "Ответственные переназначены, но удалить участника автоматически не удалось. Повторите удаление вручную.",
          ),
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

  const selectReassignmentOwner = (scheduleId: number, ownerUserId: number | null) => {
    setReassignmentSelections((prev) => ({ ...prev, [scheduleId]: ownerUserId }));
  };

  const confirmReassignment = async () => {
    if (!restaurantId || !pendingReassignmentMember || pendingReassignmentMember.userId == null) return;

    const payload: Record<number, number> = {};
    for (const option of reassignmentOptions) {
      const selectedOwnerUserId = reassignmentSelections[option.scheduleId];
      if (selectedOwnerUserId == null) {
        setReassignmentError("Выберите нового ответственного для каждого графика");
        return;
      }
      payload[option.scheduleId] = selectedOwnerUserId;
    }

    setReassignmentSaving(true);
    setReassignmentError(null);
    try {
      await reassignScheduleOwners(restaurantId, pendingReassignmentMember.userId, payload);
      await runRemove(pendingReassignmentMember, false);
    } catch (e: unknown) {
      setReassignmentError(getFriendlyMessage(e, "Не удалось переназначить ответственных"));
    } finally {
      setReassignmentSaving(false);
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
    pendingReassignmentMember,
    reassignmentOptions,
    reassignmentSelections,
    reassignmentLoading,
    reassignmentSaving,
    reassignmentError,
    closeReassignment,
    selectReassignmentOwner,
    confirmReassignment,
  };
}

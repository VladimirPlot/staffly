import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import type { MemberDto } from "../api";
import type { PositionDto } from "../../dictionaries/api";
import EmployeeAvatarPreviewModal from "../components/EmployeeAvatarPreviewModal";
import EditMemberPositionModal from "../components/EditMemberPositionModal";
import InvitePanel from "../components/InvitePanel";
import MembersFilterByPosition from "../components/MembersFilterByPosition";
import MembersHeader from "../components/MembersHeader";
import MembersList from "../components/MembersList";
import RemoveMemberDialog from "../components/RemoveMemberDialog";
import ScheduleOwnerReassignmentDialog from "../../schedule/components/ScheduleOwnerReassignmentDialog";
import { useInviteForm } from "../hooks/useInviteForm";
import { useMemberEditPosition } from "../hooks/useMemberEditPosition";
import { useMemberFilteringSorting } from "../hooks/useMemberFilteringSorting";
import { useMemberRemoval } from "../hooks/useMemberRemoval";
import { useMembers } from "../hooks/useMembers";
import { usePositions } from "../hooks/usePositions";

export default function InvitePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const restaurantId = user?.restaurantId ?? null;
  const currentUserId = user?.id ?? null;
  const [avatarPreviewMember, setAvatarPreviewMember] = useState<MemberDto | null>(null);

  const membersState = useMembers(restaurantId);
  const positionsState = usePositions(restaurantId);

  const access = useMemo(
    () => resolveRestaurantAccess(user?.roles, membersState.myRole),
    [membersState.myRole, user?.roles],
  );

  const isStaffInCurrentRestaurant = membersState.myRole === "STAFF";
  const canInvite = access.isManagerLike && !isStaffInCurrentRestaurant;
  const canEditMembers = membersState.myRole === "ADMIN";

  const invitablePositions = useMemo(
    () =>
      positionsState.activePositions.filter((position: PositionDto) =>
        access.isAdminLike ? true : position.level === "STAFF",
      ),
    [access.isAdminLike, positionsState.activePositions],
  );

  const inviteForm = useInviteForm(
    restaurantId,
    { isManagerLike: canInvite },
    invitablePositions,
  );

  const { positionOptions, sortedMembers, positionFilter, setPositionFilter } =
    useMemberFilteringSorting(membersState.members);

  const editPositionState = useMemberEditPosition({
    restaurantId,
    allPositions: positionsState.allPositions,
    updateRole: membersState.patchMemberRole,
    updatePosition: membersState.patchMemberPosition,
  });

  const removalState = useMemberRemoval({
    restaurantId,
    access,
    currentUserId,
    members: membersState.members,
    myRole: membersState.myRole,
    removeMember: membersState.removeMember,
    onSelfRemoved: () => membersState.setMyRole(null),
  });

  const handleOpenAvatarPreview = useCallback((member: MemberDto) => {
    setAvatarPreviewMember(member);
  }, []);

  const handleCloseAvatarPreview = useCallback(() => {
    setAvatarPreviewMember(null);
  }, []);

  if (!restaurantId) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <div className="text-default text-sm">Сначала выберите ресторан.</div>
          <div className="mt-3">
            <Button variant="outline" onClick={() => navigate("/restaurants")}>
              К выбору ресторанов
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3">
        <BackToHome />
      </div>
      <Card className="mb-4">
        <MembersHeader
          canInvite={canInvite}
          inviteOpen={inviteForm.inviteOpen}
          onToggleInvite={() => inviteForm.setInviteOpen((value) => !value)}
        />

        {canInvite && (
          <InvitePanel
            open={inviteForm.inviteOpen}
            inviteDone={inviteForm.inviteDone}
            phone={inviteForm.phone}
            phoneCountry={inviteForm.phoneCountry}
            phoneCountryLocked={inviteForm.phoneCountryLocked}
            phoneError={inviteForm.phoneError}
            positions={inviteForm.positions}
            loadingPositions={positionsState.loading}
            positionId={inviteForm.positionId}
            error={inviteForm.error}
            submitting={inviteForm.submitting}
            isSubmitDisabled={inviteForm.isSubmitDisabled}
            onChangePhone={inviteForm.setPhone}
            onChangePhoneCountry={(country, meta) => {
              inviteForm.setPhoneCountry(country);
              inviteForm.setPhoneCountryLocked(meta?.locked || false);
            }}
            onChangePositionId={inviteForm.setPositionId}
            onSubmit={inviteForm.submit}
            onCancel={() => inviteForm.setInviteOpen(false)}
            onResetDone={() => inviteForm.resetForm()}
          />
        )}

        <MembersFilterByPosition
          options={positionOptions}
          value={positionFilter}
          onChange={setPositionFilter}
          onReset={() => setPositionFilter(null)}
        />

        <MembersList
          members={sortedMembers}
          totalMembers={membersState.members.length}
          loading={membersState.loading}
          error={membersState.error}
          canEditMembers={canEditMembers}
          isSavingEditMemberId={
            editPositionState.saving && editPositionState.memberToEdit
              ? editPositionState.memberToEdit.id
              : null
          }
          isRemovingMemberId={
            removalState.removing && removalState.memberToRemove
              ? removalState.memberToRemove.id
              : null
          }
          canRemoveMember={removalState.canRemoveMember}
          onAvatarClick={handleOpenAvatarPreview}
          onEdit={editPositionState.open}
          onRemove={removalState.open}
        />
      </Card>

      <EditMemberPositionModal
        open={Boolean(editPositionState.memberToEdit)}
        loading={positionsState.loading}
        positionsError={positionsState.error}
        options={editPositionState.editOptions}
        value={editPositionState.editPositionId}
        memberDescription={editPositionState.description}
        saving={editPositionState.saving}
        error={editPositionState.error}
        onClose={editPositionState.close}
        onSave={editPositionState.save}
        onChangeValue={editPositionState.setEditPositionId}
      />

      <RemoveMemberDialog
        open={Boolean(removalState.memberToRemove)}
        title={removalState.title}
        description={removalState.description}
        confirmText={removalState.confirmText}
        confirming={removalState.removing}
        onConfirm={removalState.confirmRemove}
        onCancel={removalState.close}
      />

      <ScheduleOwnerReassignmentDialog
        open={Boolean(removalState.pendingReassignmentMember)}
        loading={removalState.reassignmentLoading}
        saving={removalState.reassignmentSaving || removalState.removing}
        error={removalState.reassignmentError}
        options={removalState.reassignmentOptions}
        selectedOwnerUserIdsByScheduleId={removalState.reassignmentSelections}
        onSelect={removalState.selectReassignmentOwner}
        onClose={removalState.closeReassignment}
        onSubmit={removalState.confirmReassignment}
      />

      <EmployeeAvatarPreviewModal
        open={Boolean(avatarPreviewMember)}
        member={avatarPreviewMember}
        onClose={handleCloseAvatarPreview}
      />
    </div>
  );
}

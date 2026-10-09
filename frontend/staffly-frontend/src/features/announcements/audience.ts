import type { AnnouncementAudience, AnnouncementMemberDto } from "./api";

export function membersForPositions(members: AnnouncementMemberDto[], positionIds: number[]) {
  const selected = new Set(positionIds);
  return members.filter((member) => selected.has(member.positionId));
}

export function reconcileSelectedMembers(members: AnnouncementMemberDto[], positionIds: number[], memberIds: number[]) {
  const available = new Set(membersForPositions(members, positionIds).map((member) => member.id));
  return memberIds.filter((id) => available.has(id));
}

export function announcementRecipients(
  audience: AnnouncementAudience,
  members: AnnouncementMemberDto[],
  positionIds: number[],
  memberIds: number[],
) {
  if (audience === "ALL") return members;
  const candidates = membersForPositions(members, positionIds);
  if (audience === "POSITIONS") return candidates;
  const selected = new Set(memberIds);
  return candidates.filter((member) => selected.has(member.id));
}

export function announcementAudienceLabel(announcement: {
  audience: AnnouncementAudience;
  positions: { name: string }[];
  recipients: { name: string }[];
}) {
  if (announcement.audience === "ALL") return "Всем участникам ресторана";
  if (announcement.audience === "MEMBERS") return announcement.recipients.map((member) => member.name).join(", ");
  return announcement.positions.map((position) => position.name).join(", ") || "По должностям";
}

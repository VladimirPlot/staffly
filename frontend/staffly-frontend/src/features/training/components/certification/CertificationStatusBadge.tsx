import type { CertificationAssignmentStatus } from "../../api/types";
import { getCertificationAssignmentStatusLabel } from "../../utils/certificationAssignment";

type Props = {
  status: CertificationAssignmentStatus;
};

const statusClassByStatus: Record<CertificationAssignmentStatus, string> = {
  ASSIGNED: "bg-zinc-100 text-zinc-700",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  PASSED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-amber-100 text-amber-700",
  EXHAUSTED: "bg-rose-100 text-rose-700",
  ARCHIVED: "bg-violet-100 text-violet-700",
};

export default function CertificationStatusBadge({ status }: Props) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${statusClassByStatus[status]}`}>
      {getCertificationAssignmentStatusLabel(status)}
    </span>
  );
}

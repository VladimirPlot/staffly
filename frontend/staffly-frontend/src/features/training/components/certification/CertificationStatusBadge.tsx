import type { CertificationAnalyticsStatus, CertificationAssignmentStatus } from "../../api/types";
import { getCertificationAnalyticsStatusLabel, mapCertificationLifecycleToAnalyticsStatus } from "../../utils/certificationAssignment";

type Props = {
  status: CertificationAnalyticsStatus | CertificationAssignmentStatus;
};

const statusClassByStatus: Record<CertificationAnalyticsStatus, string> = {
  NOT_STARTED: "bg-zinc-100 text-zinc-700",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  PASSED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-amber-100 text-amber-700",
};

function isAnalyticsStatus(status: CertificationAnalyticsStatus | CertificationAssignmentStatus): status is CertificationAnalyticsStatus {
  return status === "NOT_STARTED" || status === "IN_PROGRESS" || status === "PASSED" || status === "FAILED";
}

export default function CertificationStatusBadge({ status }: Props) {
  const normalizedStatus: CertificationAnalyticsStatus = isAnalyticsStatus(status) ? status : mapCertificationLifecycleToAnalyticsStatus(status);
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${statusClassByStatus[normalizedStatus]}`}>
      {getCertificationAnalyticsStatusLabel(normalizedStatus)}
    </span>
  );
}
